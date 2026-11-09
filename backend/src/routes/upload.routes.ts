import express, { Router, IRouter } from "express";
import path from "node:path";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
const { resolveUploadDirectory, seedPublishedUploads } =
    require("../../../scripts/upload-storage.cjs") as {
        resolveUploadDirectory: (root: string) => string;
        seedPublishedUploads: (root: string, directory: string) => number;
    };
export const uploadDirectory = resolveUploadDirectory(path.resolve(__dirname, "../../.."));
seedPublishedUploads(path.resolve(__dirname, "../../.."), uploadDirectory);
export const uploadRoutes: IRouter = Router();

const previews = new Map<string, Buffer>();
const pendingPreviews = new Map<string, Promise<Buffer | null>>();

async function createPreview(name: string): Promise<Buffer | null> {
    try {
        const file = path.join(uploadDirectory, name);
        const info = await lstat(file);
        if (!info.isFile() || info.size > 6 * 1024 * 1024) return null;
        const original = await readFile(file);
        if (original.length <= 32 * 1024) return original;

        const preview = await sharp(original, { limitInputPixels: 20_000_000 })
            .rotate()
            .resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 76 })
            .toBuffer();
        return preview.length < original.length ? preview : original;
    } catch {
        return null;
    }
}

uploadRoutes.get(/^\/preview-v1\/([a-f0-9]{64}\.webp)$/, async (req, res) => {
    const name = req.params[0];
    let image = previews.get(name);
    if (!image) {
        let pending = pendingPreviews.get(name);
        if (!pending) {
            // Bound the work for uncached images and share concurrent requests for a photo.
            if (pendingPreviews.size >= 2) {
                return res.set("Cache-Control", "no-store").sendStatus(503);
            }
            pending = createPreview(name).then((result) => {
                pendingPreviews.delete(name);
                if (result && result.length <= 256 * 1024) {
                    if (previews.size >= 48) {
                        const oldest = previews.keys().next().value;
                        if (oldest) previews.delete(oldest);
                    }
                    previews.set(name, result);
                }
                return result;
            });
            pendingPreviews.set(name, pending);
        }
        image = (await pending) ?? undefined;
    }
    if (!image) return res.set("Cache-Control", "no-store").sendStatus(404);
    if (!req.headers.authorization)
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.type("webp").send(image);
});

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
