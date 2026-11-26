import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "./prisma";
import { readStoreBranding } from "./store-branding";
import { readPublicContent } from "./public-content";
import { storeIdentity } from "./store-installation";
import { decryptDeskcommValue } from "./deskcomm-config";
import { readOpenCarrierIncidentCount } from "./carrier-incident-closure";

export type ReadinessCheck = { id: string; ready: boolean; label: string; detail: string; href: string | null };
const receiptSchema = z.object({
    completedAt: z.string().datetime({ offset: true }), verified: z.literal(true),
    encryptedSha256: z.string().regex(/^[a-f0-9]{64}$/), tables: z.number().int().min(10), photos: z.number().int().min(0),
}).strict();

export async function readOffsiteReceipt() {
    const path = process.env.IMAD_OFFSITE_STATUS_FILE;
    if (!path) return { fresh: false, completedAt: null };
    let file;
    try {
        if (!path.startsWith("/")) return { fresh: false, completedAt: null };
        file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        const info = await file.stat();
        if (!info.isFile() || info.size > 4096 || info.mode & 0o022) return { fresh: false, completedAt: null };
        const data = await file.readFile("utf8");
        if (data.length > 4096) return { fresh: false, completedAt: null };
        const receipt = receiptSchema.parse(JSON.parse(data));
        const age = Date.now() - Date.parse(receipt.completedAt);
        return { fresh: age >= -300_000 && age <= 36 * 3600_000, completedAt: receipt.completedAt };
    } catch { return { fresh: false, completedAt: null }; }
    finally { await file?.close(); }
}

export async function readOperationalHealth() {
    const [backup, carrier, crm, mail] = await Promise.all([
        readOffsiteReceipt(), readOpenCarrierIncidentCount(),
        prisma.deskcommOutbox.count({ where: { status: "FAILED" } }),
        prisma.passwordReset.count({ where: { mailState: "FAILED", expiresAt: { gt: new Date() } } }),
    ]);
    // Deliberately no counts, customer data, credentials or filesystem paths in public health.
    return { status: backup.fresh && carrier + crm + mail === 0 ? "ok" : "attention",
        backupFresh: backup.fresh, hasFailedSends: carrier + crm + mail > 0, checkedAt: new Date().toISOString() };
}

export async function readStoreReadiness(userId: string, isAdmin: boolean) {
    const [identity, content, settings, gmail, mfa, backup, failedCarrier, failedCrm, failedMail] = await Promise.all([
        readStoreBranding(), readPublicContent(), prisma.storeSettings.findUnique({ where: { id: "settings" } }),
        prisma.gmailConfig.findUnique({ where: { id: "gmail" }, select: { enabled: true, passwordCiphertext: true } }),
        prisma.adminMfa.findUnique({ where: { userId }, select: { enabledAt: true } }), readOffsiteReceipt(),
        readOpenCarrierIncidentCount(),
        prisma.deskcommOutbox.count({ where: { status: "FAILED" } }),
        prisma.passwordReset.count({ where: { mailState: "FAILED", expiresAt: { gt: new Date() } } }),
    ]);
    const brand = identity.branding;
    const legal = content.data as unknown as Record<string, unknown>;
    let mailConfigured = !!gmail?.enabled && !!gmail.passwordCiphertext;
    if (mailConfigured) {
        try { decryptDeskcommValue(gmail!.passwordCiphertext!); } catch { mailConfigured = false; }
    }
    const text = (key: string) => typeof legal[key] === "string" && !!String(legal[key]).trim();
    const checks: ReadinessCheck[] = [
        { id: "identity", ready: !!(brand.name && brand.contactEmail && brand.contactPhone && brand.contactAddress), label: "Coordonnées publiques",
            detail: "Vérifiez le nom, l’e-mail, le téléphone et l’adresse de votre boutique.", href: "/admin?tab=commerce#branding-settings" },
        { id: "policies", ready: legal.policiesVerified === true && ["businessName", "businessAddress", "deliveryText", "returnsText", "privacyText"].every(text), label: "Informations et conditions commerciales",
            detail: "Les coordonnées juridiques et les trois textes doivent être complétés et validés par le marchand.", href: "/admin?tab=content" },
        { id: "delivery", ready: !!settings?.deliveryMaxDays && !!settings?.returnWindowDays && !!settings?.returnFeePayer, label: "Livraison et retours",
            detail: "Définissez les délais et la prise en charge des frais de retour. Les tarifs ne sont pas modifiés par ce contrôle.", href: "/admin?tab=commerce#shipping-settings" },
        { id: "mail", ready: mailConfigured, label: "Connexion SMTP enregistrée",
            detail: "Une configuration enregistrée ne prouve pas la réception des e-mails. Effectuez un essai de réception avant livraison.", href: isAdmin ? "/admin?tab=mail" : null },
        { id: "mfa", ready: !!mfa?.enabledAt, label: "Double authentification de votre compte",
            detail: "Activez votre application d’authentification et conservez vos codes de secours séparément.", href: "/admin?tab=account" },
        { id: "backup", ready: backup.fresh, label: "Sauvegarde hors serveur vérifiée",
            detail: "Le reçu d’une restauration réussie doit dater de moins de 36 heures. Sans reçu, le contrôle reste à terminer.", href: null },
        { id: "integrations", ready: failedCarrier + failedCrm + failedMail === 0, label: "Incidents d’envoi",
            detail: "Consultez les commandes et les connexions lorsqu’un envoi échoue. Aucune relance n’est effectuée ici.", href: "/admin?tab=orders" },
    ];
    const checkedAt = new Date();
    // The server is authoritative: older devices can have outdated Moroccan timezone rules.
    const checkedAtText = Object.fromEntries([['fr', 'fr-MA'], ['ar', 'ar-MA']].map(([language, locale]) => [
        language, new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(checkedAt),
    ]));
    return { checkedAt: checkedAt.toISOString(), checkedAtText, checks, completed: checks.filter(c => c.ready).length,
        total: checks.length, backupCompletedAt: backup.completedAt,
        incidents: { carrier: failedCarrier, crm: failedCrm, accessMail: failedMail },
        installationMode: storeIdentity()?.companyId === null ? "standalone" : storeIdentity() ? "crm" : "legacy",
        emailDeliveryVerified: false };
}
