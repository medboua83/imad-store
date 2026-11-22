"use client";
import { useAdminLocale } from "./admin-locale";
import { useEffect, useRef, useState } from "react";
import { getAllOrders, trashOrders, type AdminOrder } from "@/lib/api";
import { money } from "./admin-utils";
import { orderDate } from "./order-utils";

const pageSize = 25;
export function OrderTrash({
    onBack,
    onRefresh,
}: {
    onBack: () => void;
    onRefresh: () => Promise<void>;
}) {
    const { t, locale } = useAdminLocale();
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [total, setTotal] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(true);
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    const [summaryStale, setSummaryStale] = useState(false);
    const lock = useRef(false);
    const mounted = useRef(false);
    function apply(result: Awaited<ReturnType<typeof getAllOrders>>, requested: number) {
        setOrders(result.data);
        setTotal(result.total);
        // The server can clamp a page after another administrator restores an order.
        setPage(
            result.page ?? Math.min(requested, Math.max(1, Math.ceil(result.total / pageSize))),
        );
    }
    useEffect(() => {
        mounted.current = true;
        const controller = new AbortController();
        getAllOrders({ trash: true, limit: pageSize, page: 1 }, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) apply(result, 1);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setFailed(true);
                    setMessage("Corbeille indisponible. Réessayez avec Actualiser.");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setBusy(false);
            });
        return () => {
            mounted.current = false;
            controller.abort();
        };
    }, []);
    async function run(nextPage = page, id?: string) {
        if (lock.current) return;
        if (
            id &&
            !confirm(
                t(
                    "Restaurer la commande #{reference} dans les commandes annulées ? Son statut restera inchangé.",
                    { reference: id.slice(-8).toUpperCase() },
                ),
            )
        )
            return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        setSummaryStale(false);
        let restored = false;
        let changed = false;
        try {
            if (id) {
                const result = await trashOrders([id], true);
                if (result.success !== true || ![0, 1].includes(result.count))
                    throw new Error("Unconfirmed restoration");
                restored = true;
                changed = result.count > 0;
                if (!mounted.current) return;
                setOrders((previous) => previous.filter((order) => order.id !== id));
                if (changed)
                    setTotal((previous) => (previous === null ? null : Math.max(0, previous - 1)));
            }
            const result = await getAllOrders({ trash: true, limit: pageSize, page: nextPage });
            if (!mounted.current) return;
            apply(result, nextPage);
            setFailed(false);
            if (restored)
                setMessage(
                    changed ? "Commande restaurée." : "Cette commande a déjà été restaurée.",
                );
        } catch {
            if (!mounted.current) return;
            setFailed(true);
            setMessage(
                restored
                    ? "Commande restaurée. La liste n’a pas pu être actualisée. Utilisez Actualiser, sans relancer la restauration."
                    : id
                      ? "Restauration non confirmée. Actualisez la corbeille avant de réessayer."
                      : "Corbeille indisponible. Réessayez avec Actualiser.",
            );
        } finally {
            // A confirmed mutation must stay confirmed even if the parent list cannot refresh.
            if (restored) {
                try {
                    await onRefresh();
                } catch {
                    if (mounted.current) setSummaryStale(true);
                }
            }
            lock.current = false;
            if (mounted.current) setBusy(false);
        }
    }
    const pages = Math.max(1, Math.ceil((total ?? 0) / pageSize));
    const pagination = pages > 1 && (
        <nav
            className="admin-inventory-pages order-pagination"
            aria-label={t("Navigation de la corbeille")}
        >
            <button
                type="button"
                className="admin-button"
                disabled={busy || failed || page <= 1}
                onClick={() => void run(page - 1)}
            >
                {t("Page précédente")}
            </button>
            <span>{t("Page {page} sur {total}", { page, total: pages })}</span>
            <button
                type="button"
                className="admin-button"
                disabled={busy || failed || page >= pages}
                onClick={() => void run(page + 1)}
            >
                {t("Page suivante")}
            </button>
        </nav>
    );
    return (
        <section className="admin-panel order-trash" aria-busy={busy}>
            <div className="admin-panel-heading">
                <div>
                    <h2>{t("Corbeille des commandes")}</h2>
                    <p>{t("Les commandes restent récupérables et leur statut ne change pas.")}</p>
                    {total !== null && (
                        <p role="status">
                            {t("{shown} sur {total} commandes", { shown: orders.length, total })}
                        </p>
                    )}
                </div>
            </div>
            <div className="admin-toolbar">
                <button type="button" className="admin-button" disabled={busy} onClick={onBack}>
                    {t("Retour aux commandes")}
                </button>
                <button
                    type="button"
                    className="admin-button"
                    disabled={busy}
                    onClick={() => void run()}
                >
                    {t("Actualiser")}
                </button>
            </div>
            {message && (
                <p
                    className={failed ? "admin-alert" : "admin-feedback"}
                    role={failed ? "alert" : "status"}
                >
                    {t(message)}
                </p>
            )}
            {summaryStale && (
                <p className="admin-feedback" role="status">
                    {t("Le résumé des commandes sera actualisé à votre retour.")}
                </p>
            )}
            {busy && <p role="status">{t("Chargement…")}</p>}
            {!busy && !failed && !orders.length && <p>{t("La corbeille est vide.")}</p>}
            {pagination}
            <div className="admin-order-grid">
                {orders.map((order) => (
                    <article className="admin-order-card" key={order.id}>
                        <strong>#{order.id.slice(-8).toUpperCase()}</strong>
                        <h3>{order.customerName || order.fullName || t("Client invité")}</h3>
                        <p className="admin-muted">
                            <time dateTime={order.createdAt}>
                                {orderDate(order.createdAt, locale === "ar" ? "ar-MA" : "fr-MA")}
                            </time>
                            {order.city ? ` · ${order.city}` : ""}
                        </p>
                        <p>
                            {t("Annulée · ")}
                            {money(order.totalAmount)}
                        </p>
                        <button
                            type="button"
                            className="admin-button"
                            disabled={busy || failed}
                            aria-label={t("Restaurer la commande #{reference}", {
                                reference: order.id.slice(-8).toUpperCase(),
                            })}
                            onClick={() => void run(page, order.id)}
                        >
                            {t("Restaurer")}
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
}
