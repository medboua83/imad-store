/** Olivraison Partners API v1. Production URL is fixed; credentials never reach the browser. */
export const OLIVRAISON_ORIGIN = "https://partners.olivraison.com";
export class CarrierError extends Error {
  constructor(
    public reason: string,
    public retryable = false,
  ) {
    super(reason);
  }
}
export type CarrierRequest = (path: string, method?: string, body?: unknown) => Promise<any>;
export function documentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, OLIVRAISON_ORIGIN);
    return url.origin === OLIVRAISON_ORIGIN && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function normalizeCity(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}
export function resolveCity(
  city: string,
  cities: { name: string }[],
  mapping: Record<string, string>,
) {
  const target = mapping[city] || city;
  const matches = cities.filter((c) => normalizeCity(c.name) === normalizeCity(target));
  if (matches.length !== 1)
    throw new CarrierError(
      "Ville non reconnue : compléter la correspondance des villes dans les paramètres.",
    );
  return matches[0].name;
}
export function packagePayload(order: any, city: string, pickupAddress: unknown) {
  const name = order.fullName || order.customerName || "";
  const phone = (order.phone || order.customerPhone || "").replace(/[\s()-]/g, "");
  const streetAddress = order.street || "";
  if (
    name.length < 3 ||
    name.length > 124 ||
    !/^\+?\d{9,12}$/.test(phone) ||
    streetAddress.length < 3 ||
    streetAddress.length > 124
  )
    throw new CarrierError(
      "Coordonnées incompatibles avec Olivraison : vérifier nom, téléphone et adresse.",
    );
  if (
    order.paymentMethod !== "COD" ||
    order.paymentStatus !== "PENDING" ||
    !Number.isFinite(order.totalAmount) ||
    order.totalAmount <= 0
  )
    throw new CarrierError(
      "Commande hors paiement à la livraison en attente : vérifier le montant à encaisser.",
    );
  return {
    orderId: order.id,
    partnerTrackingID: order.id,
    price: Math.round(order.totalAmount * 100) / 100,
    description: order.items
      .map((i: any) => `${i.quantity} × ${i.product?.nameFr || "Produit"}`)
      .join("; ")
      .slice(0, 1000),
    destination: { name, phone, city, streetAddress },
    pickup_address: pickupAddress,
    inventory: false,
    exchange: false,
    noOpen: false,
  };
}
export function createCarrierClient(
  credentials: { apiKey: string; secretKey: string },
  gate: () => Promise<void>,
  transport: typeof fetch = fetch,
): CarrierRequest {
  let token: string | undefined;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    authenticated = true,
  ): Promise<any> {
    await gate();
    let response: Response;
    try {
      response = await transport(`${OLIVRAISON_ORIGIN}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/json",
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CarrierError("Olivraison indisponible ou délai dépassé", true);
    }
    if (!response.ok) {
      if (response.status === 401) token = undefined;
      throw new CarrierError(
        `Olivraison HTTP ${response.status}`,
        response.status === 401 || response.status === 429 || response.status >= 500,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new CarrierError("Réponse Olivraison illisible", true);
    }
  }
  return async (path, method, body) => {
    if (!token) {
      const auth = await call("/auth/login", "POST", credentials, false);
      if (typeof auth.token !== "string" || !auth.token)
        throw new CarrierError("Authentification Olivraison refusée");
      token = auth.token;
    }
    return call(path, method, body);
  };
}
