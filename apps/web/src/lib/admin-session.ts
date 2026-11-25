// Presentation only. This value is not a credential and the server never trusts it.
export const ADMIN_PROFILE_KEY = "imad:admin:profile";
export type AdminBrowserIdentity = { id: string; role: "ADMIN" | "STAFF"; permissions: string[]; authVersion: number };
export function readAdminPresentation(): string | null {
    try { return localStorage.getItem(ADMIN_PROFILE_KEY) || localStorage.getItem("adminToken"); }
    catch { return null; }
}
export function hasBrowserProfile() {
    try { return Boolean(localStorage.getItem(ADMIN_PROFILE_KEY)); } catch { return false; }
}
export function storeBrowserIdentity(value: AdminBrowserIdentity) {
    if (!value || !/^[a-f0-9]{24}$/.test(value.id) || !["ADMIN", "STAFF"].includes(value.role)
        || !Number.isInteger(value.authVersion) || value.authVersion < 0 || !Array.isArray(value.permissions)
        || value.permissions.some(p => typeof p !== "string")) throw new Error("Invalid session identity");
    const profile = JSON.stringify({ id: value.id, role: value.role, permissions: value.permissions, sv: value.authVersion });
    const changed = localStorage.getItem(ADMIN_PROFILE_KEY) !== profile;
    localStorage.setItem(ADMIN_PROFILE_KEY, profile);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRefresh");
    if (changed) window.dispatchEvent(new Event("imad:session-changed"));
    return profile;
}
export function removeAdminPresentation() {
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRefresh");
}

export function adminPresentationBinding(): string | null {
    try {
        const value = readAdminPresentation();
        if (!value) return null;
        const payload = value.startsWith("{") ? JSON.parse(value) : JSON.parse(atob(value.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
        return /^[a-f0-9]{24}$/.test(payload.id) && Number.isInteger(payload.sv ?? 0) ? payload.id + ":" + (payload.sv ?? 0) : null;
    } catch { return null; }
}
