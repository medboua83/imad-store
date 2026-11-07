export type AdminResource = "orders" | "products" | "categories" | "notifications";
export type AdminReadState = {
    session: number;
    sequence: number;
    applied: Record<AdminResource, number>;
};
export function startAdminRead(state: AdminReadState) {
    return { session: state.session, sequence: ++state.sequence };
}
/** Keep the newest successful response, including while a newer request is pending. */
export function acceptAdminRead(
    state: AdminReadState,
    resource: AdminResource,
    request: ReturnType<typeof startAdminRead>,
) {
    if (request.session !== state.session || request.sequence < state.applied[resource])
        return false;
    state.applied[resource] = request.sequence;
    return true;
}
