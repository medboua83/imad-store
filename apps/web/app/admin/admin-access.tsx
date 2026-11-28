"use client";
import { createContext, useContext } from "react";
import { canAdmin, type AdminAccess, type AdminPermission } from "@imad-store/shared";
export const AdminAccessContext = createContext<AdminAccess>({ role: "ADMIN", permissions: [] });
export function useAdminPermission(permission: AdminPermission) { return canAdmin(useContext(AdminAccessContext), permission); }
function presentationPayload(value: string | null) {
    if (!value) throw new Error("Missing presentation");
    return value.startsWith("{") ? JSON.parse(value) : JSON.parse(atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
}
export function presentationAccess(token: string | null): AdminAccess {
    // Display preferences only. Every API request independently checks the current database account.
    // Unstructured legacy tokens retain the existing login-screen presentation until the API rejects them.
    try {
        const payload = presentationPayload(token);
        return { role: payload.role, permissions: Array.isArray(payload.permissions) ? payload.permissions : [] };
    } catch { return { role: "ADMIN", permissions: [] }; }
}
export function presentationSessionKey(token: string | null): string | null {
    try {
        const payload = presentationPayload(token);
        if (typeof payload.id !== "string" || !/^[a-f0-9]{24}$/.test(payload.id)) return null;
        return JSON.stringify([payload.id, payload.role, payload.sv ?? 0, [...(payload.permissions ?? [])].sort()]);
    } catch { return null; }
}
export function allowedAdminTab(access: AdminAccess, tab: string) {
    if (tab === "pos") return canAdmin(access, "pos.sell") || canAdmin(access, "pos.read");
    if (tab === "account") return ["ADMIN", "STAFF"].includes(access.role);
    if (access.role === "ADMIN") return true;
    const permissions: Record<string, AdminPermission> = { orders: "orders.read", notifications: "orders.read",
        products: "catalogue.manage", inventory: "catalogue.manage", categories: "catalogue.manage",
        analytics: "analytics.read", media: "media.read", content: "content.manage", commerce: "settings.manage", deskcomm: "crm.manage" };
    return !!permissions[tab] && canAdmin(access, permissions[tab]);
}
