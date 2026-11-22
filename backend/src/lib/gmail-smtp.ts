import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { decryptDeskcommValue, encryptDeskcommValue } from "./deskcomm-config";
import { AppError } from "../middleware/error.middleware";

export function encryptMail(value: string) {
    try { return encryptDeskcommValue(value); }
    catch { throw new AppError("Le chiffrement des e-mails doit être configuré sur le serveur.", 503); }
}
export async function gmailTransport() {
    const config = await prisma.gmailConfig.findUnique({ where: { id: "gmail" } });
    if (!config?.enabled || !config.passwordCiphertext) throw new AppError("Configurez et activez Gmail SMTP.", 409);
    let password: string;
    try { password = decryptDeskcommValue(config.passwordCiphertext); }
    catch { throw new AppError("La connexion Gmail doit être reconfigurée.", 503); }
    const transport = nodemailer.createTransport({
        host: "smtp.gmail.com", port: config.port, secure: config.port === 465,
        requireTLS: true, auth: { user: config.gmailUser, pass: password },
        tls: { minVersion: "TLSv1.2", servername: "smtp.gmail.com" },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
        disableFileAccess: true, disableUrlAccess: true,
    });
    return { transport, from: { name: "IMAD Mode", address: config.gmailUser } };
}
export async function sendAccessMail(to: string, token: string, kind: string, tokenHash: string) {
    const base = new URL(process.env.SITE_URL || "http://localhost:3000");
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/"
        || base.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(base.hostname)))
        throw new Error("Invalid trusted store URL");
    // Fragment is not transmitted in HTTP logs or Referer headers.
    const link = new URL("/admin/password", base); link.hash = new URLSearchParams({ token }).toString();
    const { transport, from } = await gmailTransport();
    try {
        await transport.sendMail({ from, to, messageId: `<access-${tokenHash}@${base.hostname}>`,
            subject: kind === "INVITE" ? "Votre accès à IMAD Mode" : "Réinitialiser votre mot de passe IMAD Mode",
            text: `Pour définir votre mot de passe :\n${link.href}\n\nCe lien expire dans 30 minutes et ne fonctionne qu'une fois. Si vous n'avez pas fait cette demande, ignorez cet e-mail.`,
        });
    } finally { transport.close(); }
}
