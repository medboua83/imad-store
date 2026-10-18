import { Router, IRouter } from "express";
import { z } from "zod";
import { defaultSiteContent } from "@imad-store/shared";
import { prisma } from "../lib/prisma";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { isPublishableImage } from "../lib/validation";
const text = z.string().trim().max(5000);
const contentSchema = z
    .object({
        heroTitle: z.string().trim().min(1).max(160),
        heroSubtitle: text,
        heroImage: z.string().refine(isPublishableImage),
        featuredTitle: z.string().trim().min(1).max(160),
        banners: z
            .array(
                z
                    .object({
                        title: z.string().trim().min(1).max(160),
                        image: z.string().refine(isPublishableImage),
                        href: z
                            .string()
                            .regex(/^\/(?!\/)[a-zA-Z0-9/?=&%_-]*$/)
                            .max(200),
                    })
                    .strict(),
            )
            .max(3),
        deliveryText: text,
        returnsText: text,
        privacyText: text,
        businessName: z.string().trim().min(1).max(160),
        businessAddress: text,
        policiesVerified: z.boolean(),
    })
    .strict();
export const contentRoutes: IRouter = Router();
contentRoutes.get("/", async (_req, res) => {
    const row = await prisma.siteContent.findUnique({ where: { id: "site" } });
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.json({
        success: true,
        data: row?.published || defaultSiteContent,
        revision: row?.revision || 0,
    });
});
contentRoutes.use(authenticate, requireAdmin);
contentRoutes.get("/admin", async (_req, res) => {
    const row = await prisma.siteContent.findUnique({ where: { id: "site" } });
    res.json({
        success: true,
        data: {
            draft: row?.draft || defaultSiteContent,
            published: row?.published || defaultSiteContent,
            revision: row?.revision || 0,
            canRollback: !!row?.previous,
        },
    });
});
contentRoutes.post("/:action", async (req, res) => {
    const action = z.enum(["draft", "publish", "rollback"]).parse(req.params.action);
    const body = z
        .object({ expectedRevision: z.number().int().min(0), content: contentSchema.optional() })
        .strict()
        .parse(req.body);
    await prisma.siteContent.upsert({
        where: { id: "site" },
        create: {
            id: "site",
            draft: defaultSiteContent as any,
            published: defaultSiteContent as any,
        },
        update: {},
    });
    const row = await prisma.siteContent.findUniqueOrThrow({ where: { id: "site" } });
    if (row.revision !== body.expectedRevision)
        throw new AppError("La configuration a changé. Rechargez avant de réessayer.", 409);
    let data: any = { revision: { increment: 1 } };
    if (action === "draft") {
        if (!body.content) throw new AppError("Brouillon requis", 400);
        data.draft = body.content;
    }
    if (action === "publish") {
        const draft = contentSchema.parse(row.draft);
        if (
            (draft.deliveryText ||
                draft.returnsText ||
                draft.privacyText ||
                draft.businessAddress) &&
            !draft.policiesVerified
        )
            throw new AppError("Validez les informations commerciales avant publication.", 400);
        data = { ...data, published: row.draft, previous: row.published, publishedAt: new Date() };
    }
    if (action === "rollback") {
        if (!row.previous) throw new AppError("Aucune version précédente", 409);
        data = {
            ...data,
            published: row.previous,
            previous: row.published,
            publishedAt: new Date(),
        };
    }
    const result = await prisma.siteContent.updateMany({
        where: { id: "site", revision: body.expectedRevision },
        data,
    });
    if (result.count !== 1)
        throw new AppError("Modification concurrente. Rechargez avant de réessayer.", 409);
    res.json({
        success: true,
        data: await prisma.siteContent.findUnique({ where: { id: "site" } }),
    });
});
