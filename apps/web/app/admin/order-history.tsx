"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrderHistory } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { statusLabels } from "./admin-utils";
import { orderDate } from "./order-utils";

const origins: Record<string, [string, string]> = {
    site: ["Site", "الموقع"],
    admin: ["Administration", "الإدارة"],
    crm: ["CRM", "CRM"],
    sheets: ["Google Sheets", "Google Sheets"],
    olivraison: ["Olivraison", "Olivraison"],
};
const eventNames: Record<string, [string, string]> = {
    created: ["Commande reçue", "تم استلام الطلب"],
    status_changed: ["Statut mis à jour", "تم تحديث الحالة"],
    restored: ["Commande restaurée", "تمت استعادة الطلب"],
    trashed: ["Déplacée dans la corbeille", "نُقل الطلب إلى سلة المهملات"],
};

export function OrderHistory({ orderId, status }: { orderId: string; status: string }) {
    const { t, locale } = useAdminLocale();
    const [open, setOpen] = useState(false);
    const history = useQuery({
        queryKey: ["admin-order-history", orderId, status],
        queryFn: ({ signal }) => getOrderHistory(orderId, signal),
        enabled: open,
        retry: false,
    });
    const ar = locale === "ar";
    const label = (fr: string, arabic: string) => ar ? arabic : fr;
    return (
        <details className="order-reference" onToggle={(event) => setOpen(event.currentTarget.open)}>
            <summary className="action">{label("Historique de la commande", "سجل الطلب")}</summary>
            {history.isPending ? (
                <p role="status">{label("Chargement de l’historique…", "جارٍ تحميل السجل…")}</p>
            ) : history.isError ? (
                <div role="status">
                    <p>{label("Historique indisponible.", "السجل غير متاح حالياً.")}</p>
                    <button type="button" className="admin-button" onClick={() => void history.refetch()}>
                        {t("Réessayer")}
                    </button>
                </div>
            ) : history.data.length ? (
                <ol className="space-y-2">
                    {history.data.map((event) => {
                        const origin = event.source && origins[event.source];
                        const eventName = eventNames[event.type];
                        return (
                            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <div>
                                    <strong>{event.status
                                        ? t(statusLabels[event.status] || event.status)
                                        : eventName ? label(...eventName) : label("Événement enregistré", "حدث مسجل")}</strong>
                                    {origin && <span className="admin-muted"> · {label(...origin)}</span>}
                                </div>
                                <time dateTime={event.createdAt}>{orderDate(event.createdAt, ar ? "ar-MA" : "fr-MA")}</time>
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <p>{label("Aucun événement enregistré pour cette commande.", "لا توجد أحداث مسجلة لهذا الطلب.")}</p>
            )}
        </details>
    );
}
