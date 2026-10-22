import { createHmac } from "node:crypto";
import { ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";
import { prisma } from "./prisma";
import { decryptDeskcommValue } from "./deskcomm-config";
/** Server-only DeskcommCRM adapter. Additional fields require CRM-side mapping. */
export interface DeskcommOrder {
  id: string;
  captureVersion?: 1;
  confirmationMethod?: "SITE";
  confirmedAt?: string;
  confirmationRequired?: false;
  aiServiceConsent?: boolean;
  aiServiceConsentVersion?: string;
  name: string;
  phone: string;
  email?: string;
  street: string;
  city: string;
  region: string;
  totalAmount: number;
  shippingCost: number;
  status: string;
  paymentMethod: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}

/** The published HTML form establishes nome, telefone, email only. */
export function encodeDeskcommForm(order: DeskcommOrder): URLSearchParams {
  const lines = order.items.map(
    (item, i) =>
      `${i + 1}. ${item.quantity} x ${item.name} — ${(item.quantity * item.unitPrice).toFixed(2)} MAD`,
  );
  const details = [
    `Commande ${process.env.STORE_DISPLAY_NAME || "Imad Store"} #${order.id.slice(-8).toUpperCase()}`,
    `Client de la commande: ${order.name}`,
    ...lines,
    `Total: ${order.totalAmount.toFixed(2)} MAD`,
    `Livraison: ${order.shippingCost.toFixed(2)} MAD`,
    `Paiement: ${order.paymentMethod}`,
    `Statut: ${order.status}`,
    `Adresse de livraison: ${order.street}`,
    `Ville: ${order.city}`,
    `Région: ${order.region}`,
  ].join("\n");
  const form = new URLSearchParams();
  form.set("nome", order.name);
  // Checkout accepts Moroccan local numbers. Make the country explicit for the CRM.
  form.set("telefone", order.phone.replace(/^0([5-7]\d{8})$/, "+212$1"));
  if (order.email) form.set("email", order.email);
  // Optional custom fields; their persistence in CRM has NOT been validated.
  form.set("pedido_id", order.id);
  form.set("produto", order.items.map((i) => i.name).join(", "));
  form.set("quantidade", String(order.items.reduce((n, i) => n + i.quantity, 0)));
  form.set("valor_total", order.totalAmount.toFixed(2));
  form.set("moeda", "MAD");
  form.set("origem", process.env.STORE_DISPLAY_NAME || "Imad Store");
  if (process.env.STORE_INSTANCE_ID) form.set("boutique_id", process.env.STORE_INSTANCE_ID);
  if (process.env.CRM_COMPANY_ID) form.set("entreprise_id", process.env.CRM_COMPANY_ID);
  form.set("message", details);
  if (order.confirmationMethod === "SITE") {
    form.set("confirmation_method", "SITE");
    if (order.confirmedAt) form.set("confirmed_at", order.confirmedAt);
    form.set("confirmation_required", "false");
    form.set("ai_service_consent", "false");
  }
  // These flags are informational only; no opt-in was collected.
  form.set("aiConsent", "false");
  form.set("marketingConsent", "false");
  return form;
}

import { resolveDeskcommWebhookUrl } from "./deskcomm-config";

export async function sendOrderToDeskcomm(order: DeskcommOrder): Promise<void> {
  const url = await resolveDeskcommWebhookUrl();
  if (!url) throw new Error("DeskcommCRM webhook not configured or disabled");
  const parsed = new URL(url);
  if (process.env.NODE_ENV === "test" && !["127.0.0.1", "localhost"].includes(parsed.hostname))
    throw new Error("Tests require a local CRM simulator");
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (
    parsed.protocol !== "https:" &&
    !isLocalDev &&
    !(process.env.NODE_ENV !== "production" && process.env.DESKCOMM_ALLOW_HTTP_DEV === "true")
  ) {
    throw new Error("DeskcommCRM requires HTTPS except for local testing");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const cfg = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    // A signed JSON body preserves real booleans required by the CRM authorization gate.
    // Legacy unsigned integrations keep their established form encoding.
    const form = encodeDeskcommForm(order);
    const modernCapture = order.captureVersion === 1;
    if (modernCapture)
      form.set(
        "external_id",
        process.env.STORE_INSTANCE_ID
          ? `store-${process.env.STORE_INSTANCE_ID}-${order.id}`
          : `imad-store-${order.id}`,
      );
    const consent =
      order.confirmationMethod !== "SITE" &&
      order.aiServiceConsent === true &&
      order.aiServiceConsentVersion === ORDER_WHATSAPP_NOTICE_VERSION &&
      /^\+212[5-7]\d{8}$/.test(order.phone);
    const payload = {
      ...Object.fromEntries(form),
      external_id: process.env.STORE_INSTANCE_ID
        ? `store-${process.env.STORE_INSTANCE_ID}-${order.id}`
        : `imad-store-${order.id}`,
      submission_status: "completed",
      ...(order.confirmationMethod === "SITE" ? { confirmation_required: false } : {}),
      aiConsent: consent,
      ai_service_consent: consent,
      ...(consent ? { ai_service_consent_version: order.aiServiceConsentVersion } : {}),
    };
    const jsonBody = Boolean(cfg?.signingCiphertext && modernCapture);
    const body = jsonBody ? JSON.stringify(payload) : form.toString();
    const signature = cfg?.signingCiphertext
      ? createHmac("sha256", decryptDeskcommValue(cfg.signingCiphertext)).update(body).digest("hex")
      : null;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": jsonBody
          ? "application/json; charset=UTF-8"
          : "application/x-www-form-urlencoded; charset=UTF-8",
        ...(signature ? { "x-deskcomm-signature": signature } : {}),
        "Idempotency-Key": process.env.STORE_INSTANCE_ID
          ? `store-${process.env.STORE_INSTANCE_ID}-${order.id}`
          : `imad-store-${order.id}`,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DeskcommCRM HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}
