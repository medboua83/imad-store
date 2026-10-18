import https from "node:https";
import { prisma } from "./prisma";
import { generateAdminWhatsAppLink, generateWhatsAppLink } from "./whatsapp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderForBridge {
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    fullName: string | null;
    city: string | null;
    region: string | null;
    totalAmount: number;
    paymentMethod: string;
    items: { name: string; quantity: number; unitPrice: number }[];
    notes?: string | null;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

interface TelegramSendResult {
    ok: boolean;
    error?: string;
}

function sendTelegramRaw(botToken: string, payload: Record<string, string>): Promise<TelegramSendResult> {
    const postData = new URLSearchParams(payload).toString();
    const options = {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve({ ok: true });
                } else {
                    resolve({ ok: false, error: `HTTP ${res.statusCode}: ${body}` });
                }
            });
        });
        req.on("error", (err) => resolve({ ok: false, error: err.message }));
        req.write(postData);
        req.end();
    });
}

// ─── Message builders ─────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ["ar", "fr", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const ACK_TRANSLATIONS: Record<Locale, { title: string; body: string; cta: string }> = {
    ar: {
        title: "🌙 تم استلام طلبك",
        body: "شكراً لثقتك بنا. سيتم معالجة طلبك خلال ثوانٍ وسيتواصل معك أحد أعضاء فريقنا قريباً.\n\nبارك الله فيك",
        cta: "💬 تواصل عبر واتساب",
    },
    fr: {
        title: "🌙 Commande bien reçue",
        body: "Merci pour votre confiance. Votre commande est en cours de traitement et un membre de notre équipe vous contactera dans quelques instants.\n\nBarakallahoufik",
        cta: "💬 Contacter sur WhatsApp",
    },
    en: {
        title: "🌙 Order received",
        body: "Thank you for your order. We are processing it now and a team member will reach out shortly.\n\nBarakallahoufik",
        cta: "💬 Contact on WhatsApp",
    },
};

function buildCustomerAck(order: OrderForBridge, locale: Locale = "fr"): { message: string; waLink: string } {
    const t = ACK_TRANSLATIONS[locale];
    const ref = order.id.slice(-6).toUpperCase();
    const storePhone = process.env.STORE_WHATSAPP_PHONE ?? process.env.WHATSAPP_PHONE ?? "";

    const message = `${t.title} — *#${ref}*

Bonjour ${order.customerName ?? ""},
${t.body}

📦 *Récapitulatif* :
• Total : *${order.totalAmount.toFixed(2)} MAD*
• Articles : ${order.items.length}
• Réf : #${ref}

${t.cta} 👇
`;

    const waMessage = `Bonjour IMAD Mode, je viens de passer la commande #${ref} (${order.totalAmount.toFixed(2)} MAD).`;
    const waLink = storePhone ? generateWhatsAppLink(storePhone, waMessage) : "";

    return { message, waLink };
}

function buildAdminNotification(order: OrderForBridge): string {
    const ref = order.id.slice(-6).toUpperCase();
    const itemsText = order.items
        .map((item) => `• ${item.name} x${item.quantity} (${(item.unitPrice * item.quantity).toFixed(2)} MAD)`)
        .join("\n");

    return `🛍️ *Nouvelle commande IMAD Mode #${ref}*

👤 *Client:* ${order.customerName ?? "Inconnu"}
📱 *Téléphone:* ${order.customerPhone ?? "Non fourni"}
📧 *Email:* ${order.customerEmail ?? "Non fourni"}
📍 *Adresse:* ${order.fullName ?? ""}, ${order.city ?? ""}, ${order.region ?? ""}
💰 *Total:* *${order.totalAmount.toFixed(2)} MAD*
💳 *Paiement:* ${order.paymentMethod}

*Articles:*
${itemsText}

🕒 ${new Date().toLocaleString()}

_Pour répondre, ouvrez WhatsApp →_`;
}

function buildManualFallbackAlert(order: OrderForBridge, lastError: string): string {
    const ref = order.id.slice(-6).toUpperCase();
    return `⚠️ *Action manuelle requise — #${ref}*

Le bot a échoué sur une action automatisée.
Erreur : ${lastError}

Client : ${order.customerName} (${order.customerPhone})
Total : ${order.totalAmount.toFixed(2)} MAD
`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BridgeOptions {
    /** Customer's preferred locale for the acknowledgment */
    locale?: Locale;
    /** Set false to skip the customer auto-reply (e.g. for status changes) */
    acknowledgeCustomer?: boolean;
}

/**
 * Telegram → WhatsApp Bridge.
 * Notifies the admin via Telegram, then immediately sends an acknowledgment
 * to the customer. Telegram is the *hub* — the admin reads it on their phone
 * (with WhatsApp installed) and follows up via WhatsApp from the wa.me link
 * that the customer receives as a CTA.
 *
 * Never throws: every failure is caught, logged, and (when possible) the
 * admin is alerted so a human can complete the action manually.
 */
export async function bridgeOrderToAdmin(
    order: OrderForBridge,
    options: BridgeOptions = {}
): Promise<{ adminSent: boolean; customerSent: boolean; manualActionNeeded: boolean }> {
    const { locale = "fr", acknowledgeCustomer = true } = options;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // Support both TELEGRAM_ADMIN_CHAT_ID (preferred) and legacy TELEGRAM_CHAT_ID
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;

    // ── 1. Admin notification via Telegram ────────────────────────────────
    let adminSent = false;
    if (botToken && adminChatId) {
        const adminMsg = buildAdminNotification(order);
        const adminWaLink = generateAdminWhatsAppLink({
            id: order.id,
            customerName: order.customerName ?? "",
            customerPhone: order.customerPhone ?? "",
            city: order.city ?? "",
            region: order.region ?? "",
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            items: order.items,
        });
        const combined = `${adminMsg}\n${adminWaLink}`;

        const adminResult = await sendTelegramRaw(botToken, {
            chat_id: adminChatId,
            text: combined,
            parse_mode: "Markdown",
        });
        adminSent = adminResult.ok;
        if (!adminResult.ok) {
            console.error("❌ Telegram admin notification failed:", adminResult.error);
        }
    } else {
        console.log("⚠️ Telegram not configured. Bridge admin step skipped.");
    }

    // ── 2. Customer auto-acknowledgment ──────────────────────────────────
    let customerSent = false;
    if (acknowledgeCustomer && order.customerPhone) {
        const { message, waLink } = buildCustomerAck(order, locale);
        const customerMsg = waLink ? `${message}${waLink}` : message;

        // The bot sends the customer a Telegram DM if they've started a chat.
        // Their chat_id is stored at first contact (we look it up here).
        if (botToken) {
            const customerChatId = await prisma.telegramCustomer
                .findUnique({ where: { phone: order.customerPhone } })
                .then((c) => c?.verifiedAt ? c.chatId : null)
                .catch(() => null);

            if (customerChatId) {
                const result = await sendTelegramRaw(botToken, {
                    chat_id: customerChatId,
                    text: customerMsg,
                    parse_mode: "Markdown",
                });
                customerSent = result.ok;
                if (!result.ok) {
                    console.error("❌ Telegram customer ack failed:", result.error);
                }
            } else {
                console.log("ℹ️ Customer hasn't connected with the bot yet — wa.me link will reach them.");
            }
        }
    }

    // ── 3. Manual fallback alert ─────────────────────────────────────────
    const manualActionNeeded = !adminSent;
    if (manualActionNeeded && botToken && adminChatId) {
        const alert = buildManualFallbackAlert(order, "admin notification did not deliver");
        await sendTelegramRaw(botToken, {
            chat_id: adminChatId,
            text: alert,
            parse_mode: "Markdown",
        }).catch((err) => console.error("❌ Manual fallback alert failed:", err));
    }

    return { adminSent, customerSent, manualActionNeeded };
}

/**
 * Generates a wa.me link the customer can tap from the success page to
 * open WhatsApp directly with the store. Used as the customer fallback
 * when Telegram is not configured.
 */
export function getCustomerWhatsAppLink(order: OrderForBridge, locale: Locale = "fr"): string {
    const ref = order.id.slice(-6).toUpperCase();
    const storePhone = process.env.STORE_WHATSAPP_PHONE ?? process.env.WHATSAPP_PHONE ?? "";
    if (!storePhone) return "";

    const t = ACK_TRANSLATIONS[locale];
    const msg = `${t.body}\n\n_Réf: #${ref}_`;
    return generateWhatsAppLink(storePhone, msg);
}
