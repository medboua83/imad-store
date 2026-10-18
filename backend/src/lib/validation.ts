import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/error.middleware";

export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Identifiant invalide");
export const statusSchema = z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]);
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function validateObjectId(_req: Request, _res: Response, next: NextFunction, id: string) {
    if (!objectIdSchema.safeParse(id).success)
        return next(new AppError("Identifiant invalide", 400));
    next();
}
export function isPublishableImage(value: string): boolean {
    return (
        /^\/uploads\/[a-f0-9]{64}\.webp$/.test(value) ||
        (/^\/images\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes("..")) ||
        /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_/-]+\/(?:image\/upload\/)?[^\s]+$/.test(value)
    );
}
