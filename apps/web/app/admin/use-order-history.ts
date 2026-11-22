"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_ORDERS_REFRESH_MS } from "@imad-store/shared";
import { getAllOrders, getAdminOrder, type AdminOrder } from "@/lib/api";
import type { OrderListFilters } from "./order-list-context";
export const orderPageSize = 25;
type Page = { key: string; rows: AdminOrder[]; total: number; scopeTotal: number; counts: Record<string, number>; page: number; pages: number; detail?: AdminOrder };

/** The complete small collection stays local. Partial collections are always queried on the server. */
export function useOrderHistory(remote: boolean, filters: OrderListFilters, selected: string | null, missing: boolean) {
    const [data, setData] = useState<Page>();
    const [error, setError] = useState("");
    const [failedKey, setFailedKey] = useState("");
    const refreshRef = useRef<() => Promise<void>>(async () => {});
    const key = JSON.stringify([filters, selected]);
    const invalid = !!filters.from && !!filters.to && filters.from > filters.to;
    useEffect(() => {
        if ((!remote && !missing) || invalid) return;
        let alive = true, inFlight: Promise<void> | undefined;
        const controller = new AbortController();
        const load = (propagate = false): Promise<void> => {
            if (inFlight) return inFlight;
            const task = async () => {
                try {
                    const response = remote ? await getAllOrders({
                        limit: orderPageSize, page: filters.page, search: filters.search.trim() || undefined,
                        status: filters.status === "ALL" ? undefined : filters.status,
                        payment: filters.payment === "ALL" ? undefined : filters.payment,
                        from: filters.from || undefined, to: filters.to || undefined, sort: filters.sort,
                    }, controller.signal) : undefined;
                    if (response && (response.scopeTotal === undefined || !response.statusCounts || !Number.isFinite(response.page)))
                        throw new Error("History response missing global counts");
                    let detail = response?.data.find(row => row.id === selected);
                    if (selected && !detail) {
                        try { detail = await getAdminOrder(selected, controller.signal); }
                        catch (e) { if ((e as { response?: { status?: number } }).response?.status !== 404) throw e; }
                    }
                    if (!alive) return;
                    setData({ key, rows: response?.data ?? [], total: response?.total ?? 0,
                        scopeTotal: response?.scopeTotal ?? 0, counts: response?.statusCounts ?? {},
                        page: response?.page ?? 1, pages: response?.totalPages ?? 0, detail });
                    setError(""); setFailedKey("");
                } catch (e) {
                    if (!alive) return;
                    setFailedKey(key);
                    setError("Recherche dans l’historique impossible. Réessayez pour vérifier les résultats.");
                    if (propagate) throw e;
                } finally { inFlight = undefined; }
            };
            inFlight = task();
            return inFlight;
        };
        const refresh = async () => {
            await inFlight?.catch(() => {});
            if (alive) await load(true);
        };
        refreshRef.current = refresh;
        const timer = setTimeout(() => { if (!document.hidden) void load(); }, 300);
        const poll = () => { if (!document.hidden) void load(); };
        const interval = setInterval(poll, ADMIN_ORDERS_REFRESH_MS);
        const manual = () => { void refresh().catch(() => {}); };
        document.addEventListener("visibilitychange", poll);
        window.addEventListener("imad:sync", manual);
        return () => {
            alive = false; controller.abort(); clearTimeout(timer); clearInterval(interval);
            document.removeEventListener("visibilitychange", poll); window.removeEventListener("imad:sync", manual);
            if (refreshRef.current === refresh) refreshRef.current = async () => {};
        };
    }, [remote, missing, invalid, key, filters, selected]);
    const refresh = useCallback(() => refreshRef.current(), []);
    return { data: data?.key === key ? data : undefined,
        detail: data?.detail?.id === selected ? data.detail : undefined,
        loading: (remote || missing) && !invalid && data?.key !== key && failedKey !== key,
        error: failedKey === key ? error : "", refresh };
}
