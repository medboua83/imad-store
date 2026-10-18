import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error(err);

    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            error: "Validation error",
            details: err.issues,
        });
        return;
    }

    const status = (err as any).status ?? 500;
    res.status(status).json({
        success: false,
        error: err.message ?? "Internal server error",
    });
}

export class AppError extends Error {
    constructor(public message: string, public status: number = 400) {
        super(message);
    }
}
