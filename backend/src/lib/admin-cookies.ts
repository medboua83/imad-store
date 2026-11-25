import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../middleware/error.middleware";

export const browserSessionRequested = (req: Request) => req.get("X-Imad-Admin-Session") === "cookie";
export function adminCookieNames() {
    const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";
    return { access: prefix + "imad_admin_access", refresh: prefix + "imad_admin_refresh" };
}
export function readAdminCookie(req: Request, kind: "access" | "refresh") {
    const name = adminCookieNames()[kind];
    const parts = (req.headers.cookie ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(name + "="));
    if (parts.length !== 1) return null;
    const value = parts[0].slice(name.length + 1);
    return /^[A-Za-z0-9_.-]{1,4096}$/.test(value) ? value : null;
}
export function hasAdminCookie(req: Request) {
    return Object.values(adminCookieNames()).some(name => (req.headers.cookie ?? "").split(";").some(p => p.trim().startsWith(name + "=")));
}
export function assertBrowserRequest(req: Request) {
    // The custom header disallows simple forms. Origin and Fetch Metadata also
    // reject same-site sibling subdomains; SameSite alone does not stop them.
    if (!browserSessionRequested(req)) throw new AppError("Requête de session refusée.", 403);
    const origins = (process.env.SITE_URL ? [process.env.SITE_URL] : (process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")).split(","))
        .filter((v): v is string => !!v).flatMap(value => {
            try { const u = new URL(value.trim()); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? [u.origin] : []; }
            catch { return []; }
        });
    const origin = req.get("Origin"), site = req.get("Sec-Fetch-Site");
    let referringOrigin: string | undefined;
    try { referringOrigin = new URL(req.get("Referer") ?? "").origin; } catch { /* Missing referrer is allowed only with same-origin Fetch Metadata. */ }
    if (site === "cross-site" || origin && !origins.includes(origin)
        || !origin && (referringOrigin ? !origins.includes(referringOrigin) : site !== "same-origin"))
        throw new AppError("Origine de la session refusée.", 403);
}
function cookieOptions() {
    return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };
}
export function setAdminCookies(res: Response, access: string, refresh: string, expiresAt: Date) {
    const names = adminCookieNames(), options = cookieOptions();
    const accessExpiry = (jwt.decode(access) as jwt.JwtPayload).exp! * 1000;
    res.cookie(names.access, access, { ...options, expires: new Date(accessExpiry) });
    res.cookie(names.refresh, refresh, { ...options, expires: expiresAt });
    res.setHeader("Cache-Control", "private, no-store");
}
export function clearAdminCookies(res: Response) {
    for (const name of Object.values(adminCookieNames())) res.clearCookie(name, cookieOptions());
    res.setHeader("Cache-Control", "private, no-store");
}
