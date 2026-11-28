export const adminPermissions = ["pos.sell", "pos.read", "pos.returns", "orders.read", "orders.write", "orders.export", "catalogue.manage", "analytics.read", "media.read", "content.manage", "settings.manage", "crm.manage"] as const;
export type AdminPermission = typeof adminPermissions[number];
export type AdminAccess = { role: string; permissions: string[] };
export function canAdmin(access: AdminAccess, permission: AdminPermission) {
    return access.role === "ADMIN" || access.role === "STAFF" && access.permissions.includes(permission);
}
