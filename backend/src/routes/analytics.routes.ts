import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { recordPage, readAnalytics } from "../lib/store-analytics";

export const analyticsRoutes = Router();
const eventSchema = z
    .object({
        session: z.string().uuid(),
        page: z
            .string()
            .max(180)
            .regex(/^\/(?:shop|checkout|contact|delivery|returns|privacy|products\/[a-z0-9-]+)?$/),
        test: z.boolean().default(false),
    })
    .strict();
analyticsRoutes.post(
    "/events",
    rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        if (req.header("Sec-Fetch-Site") === "cross-site") return res.sendStatus(403);
        const origin = req.header("Origin");
        if (
            origin &&
            !(process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").includes(origin)
        )
            return res.sendStatus(403);
        const body = eventSchema.parse(req.body);
        if (
            req.header("Authorization") ||
            req.header("DNT") === "1" ||
            req.header("Sec-GPC") === "1" ||
            /bot|crawler|spider|lighthouse|headless/i.test(req.header("User-Agent") ?? "")
        )
            return res.status(202).json({ success: true, recorded: false });
        const recorded = await recordPage(body.session, body.page, body.test);
        return res.status(202).json({ success: true, recorded });
    },
);
analyticsRoutes.get("/summary", authenticate, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const { days } = z
        .object({ days: z.enum(["7", "30", "90"]).default("7") })
        .strict()
        .parse(req.query);
    res.json({ success: true, data: await readAnalytics(Number(days)) });
});
