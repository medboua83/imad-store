import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
    constructor(
        public message: string,
        public status: number = 400,
    ) {
        super(message);
    }
}
export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    res.setHeader("Cache-Control", "no-store");
    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            error: "Vérifiez les champs indiqués",
            details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        });
        return;
    }
    if (err instanceof AppError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
    }
    const code = (err as { code?: string }).code;
    if (code === "P2034") {
        res.status(409).json({
            success: false,
            error: "Modification concurrente. Actualisez et réessayez.",
        });
        return;
    }
    if (code === "P2002") {
        res.status(409).json({ success: false, error: "Cet identifiant ou SKU existe déjà" });
        return;
    }
    if (code === "P2025") {
        res.status(404).json({ success: false, error: "Élément introuvable" });
        return;
    }
    if ((err as { type?: string }).type === "entity.too.large") {
        res.status(413).json({ success: false, error: "Le fichier dépasse la taille autorisée" });
        return;
    }
    if ((err as { type?: string }).type === "entity.parse.failed") {
        res.status(400).json({ success: false, error: "Requête invalide" });
        return;
    }
    console.error("Request failed", { type: err.name, code });
    res.status(500).json({
        success: false,
        error: "Impossible de terminer la demande. Réessayez.",
    });
}
