import { Router, IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";

export const telegramRoutes: IRouter = Router();
telegramRoutes.post("/webhook", async (req, res) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) throw new AppError("Notifications Telegram non configurées", 503);
    const supplied = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
    const expectedBytes = Buffer.from(secret),
        suppliedBytes = Buffer.from(supplied);
    if (
        expectedBytes.length !== suppliedBytes.length ||
        !timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
        throw new AppError("Accès refusé", 403);
    }
    const message = req.body?.message;
    if (!message) return res.sendStatus(200);
    if (
        message.chat?.type !== "private" ||
        !Number.isSafeInteger(message.from?.id) ||
        message.chat.id !== message.from.id
    ) {
        throw new AppError("Conversation privée requise", 400);
    }
    const contact = message.contact;
    if (contact) {
        if (contact.user_id !== message.from.id || typeof contact.phone_number !== "string") {
            throw new AppError("Partagez votre propre contact", 400);
        }
        const digits = contact.phone_number.replace(/[\s+()-]/g, "");
        if (!/^\d{8,15}$/.test(digits)) throw new AppError("Numéro invalide", 400);
        const phone = `+${digits}`;
        const data = {
            chatId: String(message.chat.id),
            firstName: String(message.from.first_name || "").slice(0, 120),
            verifiedAt: new Date(),
        };
        await prisma.telegramCustomer.upsert({
            where: { phone },
            create: { phone, ...data },
            update: data,
        });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && process.env.NODE_ENV !== "test") {
        const reply = contact
            ? {
                  text: "Votre compte est lié. Vous recevrez vos confirmations ici.",
                  reply_markup: { remove_keyboard: true },
              }
            : {
                  text: "Pour activer vos confirmations, partagez votre propre numéro avec le bouton ci-dessous.",
                  reply_markup: {
                      keyboard: [[{ text: "Partager mon numéro", request_contact: true }]],
                      resize_keyboard: true,
                      one_time_keyboard: true,
                  },
              };
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: message.chat.id, ...reply }),
            signal: AbortSignal.timeout(5000),
        }).catch(() => undefined);
    }
    res.sendStatus(200);
});
