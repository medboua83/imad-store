"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { ADMIN_ORDERS_REFRESH_MS } from "@imad-store/shared";
import { type AdminOrder, getCustomerOrderHistory } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { money, statusLabels } from "./admin-utils";
import { orderDate, paymentLabels } from "./order-utils";

export function hasCancellationHistory(order: AdminOrder) {
    const summary = order.customerHistory;
    return summary?.available === true && Number.isSafeInteger(summary.priorCancelledCount) && summary.priorCancelledCount > 0;
}
export function CustomerCancellationAlert({ order, onOpen }: { order: AdminOrder; onOpen: () => void }) {
    const { t } = useAdminLocale();
    if (!hasCancellationHistory(order)) return null;
    return <section className="customer-cancellation-alert" aria-label={t("Anciennes commandes annulées")}>
        <p><AlertTriangle size={17} aria-hidden="true" />
            <strong>{t("{count} ancienne(s) commande(s) annulée(s) associée(s) à ce numéro.", { count: order.customerHistory!.priorCancelledCount })}</strong>
        </p>
        <button type="button" className="admin-text-button" onClick={onOpen}>{t("Voir l’historique du numéro")}</button>
    </section>;
}

export function CustomerOrderHistory({ orderId, onBack, onOrder }: { orderId: string; onBack: () => void; onOrder: (id: string) => void }) {
    const { t, locale } = useAdminLocale();
    const [page, setPage] = useState(1);
    const query = useQuery({
        queryKey: ["admin-customer-orders", orderId, page],
        queryFn: ({ signal }) => getCustomerOrderHistory(orderId, page, signal),
        retry: false, refetchInterval: ADMIN_ORDERS_REFRESH_MS,
    });
    const data = query.data;
    const date = (value: string) => orderDate(value, locale === "ar" ? "ar-MA" : "fr-MA");
    return <div className="order-detail-body customer-history-body">
        <button type="button" className="admin-button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t("Revenir à la commande")}</button>
        <p className="admin-scope">{t("Historique associé au même numéro, y compris la corbeille. En cas d’anciennes annulations, l’envoi automatique à Olivraison nécessite une validation manuelle.")}</p>
        {query.isPending ? <p role="status">{t("Chargement de l’historique…")}</p> : query.isError ? <div className="admin-alert" role="alert">
            <p>{t("Historique du numéro indisponible. Réessayez.")}</p>
            <button type="button" className="admin-button" onClick={() => void query.refetch()}>{t("Réessayer")}</button>
        </div> : data && <>
            <div className="customer-history-summary">
                <h3><bdi dir="ltr">{data.phone}</bdi></h3>
                <p role="status">{t("{count} commande(s) associée(s) à ce numéro.", { count: data.total })}</p>
                <p>{t("{count} commande(s) plus ancienne(s) actuellement annulée(s).", { count: data.priorCancelledCount })}</p>
            </div>
            {data.totalPages > 1 && <nav className="admin-inventory-pages" aria-label={t("Navigation de l’historique du numéro")}>
                <button type="button" className="admin-button" disabled={data.page <= 1 || query.isFetching} onClick={() => setPage(data.page - 1)}>{t("Page précédente")}</button>
                <span>{t("Page {page} sur {total}", { page: data.page, total: data.totalPages })}</span>
                <button type="button" className="admin-button" disabled={data.page >= data.totalPages || query.isFetching} onClick={() => setPage(data.page + 1)}>{t("Page suivante")}</button>
            </nav>}
            <ul className="customer-history-list">
                {data.data.map(row => <li key={row.id}>
                    <div className="customer-history-row">
                        <strong><bdi>#{row.id.slice(-8).toUpperCase()}</bdi></strong>
                        <span className={`admin-status status-${row.status.toLowerCase()}`}>{t(statusLabels[row.status])}</span>
                    </div>
                    <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
                    <div className="customer-history-row"><strong>{money(row.totalAmount)}</strong><span>{t(paymentLabels[row.paymentStatus])}</span></div>
                    {row.status === "CANCELLED" && <p>{row.cancelledAt ? t("Annulée le {date}", { date: date(row.cancelledAt) }) : t("Date d’annulation non renseignée")}</p>}
                    {row.deletedAt ? <p className="admin-scope">{t("Conservée dans la corbeille")}</p>
                        : row.id === orderId ? <p className="admin-scope">{t("Commande consultée")}</p>
                        : <button type="button" className="admin-text-button" onClick={() => onOrder(row.id)}>{t("Voir les détails")} <span className="sr-only">#{row.id.slice(-8).toUpperCase()}</span></button>}
                </li>)}
            </ul>
        </>}
    </div>;
}
