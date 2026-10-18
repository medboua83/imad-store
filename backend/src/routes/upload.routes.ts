import express, { Router, IRouter } from "express";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
export const uploadDirectory = process.env.UPLOAD_DIR || path.resolve(__dirname, "../../uploads");
export const uploadRoutes: IRouter = Router();
uploadRoutes.post(
    "/",
    authenticate,
    requireAdmin,
    express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "5mb" }),
    async (req, res) => {
        if (!Buffer.isBuffer(req.body) || !req.body.length)
            throw new AppError("Choisissez une image PNG, JPEG ou WebP (5 Mo maximum)", 400);
        let output: Buffer;
        try {
            const image = sharp(req.body, { limitInputPixels: 20_000_000, animated: false });
            const metadata = await image.metadata();
            const formats: Record<string, string> = {
                "image/png": "png",
                "image/jpeg": "jpeg",
                "image/webp": "webp",
            };
            if (
                metadata.format !== formats[req.get("Content-Type")?.split(";")[0] || ""] ||
                (metadata.pages || 1) > 1
            )
                throw new Error("format");
            output = await image
                .rotate()
                .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();
        } catch {
            throw new AppError("Image invalide ou trop volumineuse", 400);
        }
        const name = `${createHash("sha256").update(output).digest("hex")}.webp`;
        await mkdir(uploadDirectory, { recursive: true });
        await writeFile(path.join(uploadDirectory, name), output, { flag: "wx" }).catch((error) => {
            if (error.code !== "EEXIST") throw error;
        });
        res.status(201).json({ success: true, data: { url: `/uploads/${name}` } });
    },
);
