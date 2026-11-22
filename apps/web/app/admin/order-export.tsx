"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { exportOrders } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import type { OrderListFilters } from "./order-list-context";

export function OrderExport({ filters, disabled }: { filters: OrderListFilters; disabled: boolean }) {
    const { t, locale } = useAdminLocale();
    const { search, status, payment, tracking, from, to, sort } = filters;
    const params = { search: search.trim() || undefined, status: status === "ALL" ? undefined : status,
        payment: payment === "ALL" ? undefined : payment, tracking: tracking === "ALL" ? undefined : tracking,
        from: from || undefined, to: to || undefined, sort, locale };
    const key = JSON.stringify(params);
    const [state, setState] = useState({ key: "", message: "", error: false, busy: false, count: 0 });
    const request = useRef<AbortController | null>(null);
    // A changed selection or closed tab must never download the previous selection later.
    useEffect(() => () => { request.current?.abort(); request.current = null; }, [key]);
    const current = state.key === key;
    async function download() {
        if (request.current || disabled) return;
        const controller = new AbortController();
        request.current = controller;
        setState({ key, message: "Préparation de l’export…", error: false, busy: true, count: 0 });
        try {
            const result = await exportOrders(params, controller.signal);
            if (controller.signal.aborted) return;
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `imad-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            // Leave time for mobile browsers to take ownership of the file.
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            setState({ key, message: "Export prêt : {count} commande(s).", count: result.count, error: false, busy: false });
        } catch (error) {
            if (controller.signal.aborted) return;
            setState({ key, message: (error as { response?: { status?: number } }).response?.status === 422
                ? "Plus de 10 000 commandes. Précisez les dates ou les filtres avant d’exporter."
                : "Export impossible. Vos filtres sont conservés. Réessayez.", count: 0, error: true, busy: false });
        } finally {
            if (request.current === controller) request.current = null;
        }
    }
    return <section className="order-export" aria-label={t("Export des commandes")}>
        <div className="order-export-toolbar">
            <p>{t("Toutes les pages filtrées · hors corbeille · 10 000 commandes maximum.")}</p>
            <button type="button" className="admin-button" disabled={disabled || current && state.busy} onClick={() => void download()}>
                <Download size={16} aria-hidden="true" />
                {current && state.busy ? t("Préparation de l’export…") : t("Exporter CSV")}
            </button>
        </div>
        {current && state.message && <p className={state.error ? "admin-alert" : "admin-feedback"} role={state.error ? "alert" : "status"}>
            {t(state.message, { count: state.count })}
        </p>}
    </section>;
}
