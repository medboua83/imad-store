"use client";
import { useAdminLocale } from "./admin-locale";

import { useEffect, useRef, useState } from "react";
import { getAllOrders, trashOrders, type AdminOrder } from "@/lib/api";
import { money } from "./admin-utils";

export function OrderTrash({
    onBack,
    onRefresh,
}: {
    onBack: () => void;
    onRefresh: () => Promise<void>;
}) {
    const { t } = useAdminLocale();
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(true);
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    const lock = useRef(false);
    async function load(nextPage = 1) {
        const result = await getAllOrders({ trash: true, limit: 100, page: nextPage });
        setOrders((previous) => (nextPage === 1 ? result.data : [...previous, ...result.data]));
        setTotal(result.total);
        setPage(nextPage);
    }
    useEffect(() => {
        let active = true;
        getAllOrders({ trash: true, limit: 100 })
            .then((result) => {
                if (active) {
                    setOrders(result.data);
                    setTotal(result.total);
                }
            })
            .catch(() => {
                if (active) {
                    setFailed(true);
                    setMessage("Corbeille indisponible. Réessayez avec Actualiser.");
                }
            })
            .finally(() => {
                if (active) setBusy(false);
            });
        return () => {
            active = false;
        };
    }, []);
    async function run(id?: string, more = false) {
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
        try {
            if (id) await trashOrders([id], true);
            await load(more ? page + 1 : 1);
            await onRefresh();
            setFailed(false);
            if (id) setMessage("Commande restaurée.");
        } catch {
            setFailed(true);
            setMessage("Action ou actualisation non confirmée. Actualisez avant de réessayer.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="admin-panel">
            <div className="admin-panel-heading">
                <div>
                    <h2>{t("Corbeille des commandes")}</h2>
                    <p>
                        {orders.length}
                        {t(" sur ")}
                        {total}
                        {t(
                            " commandes. Les commandes restent récupérables et leur statut ne change pas.",
                        )}
                    </p>
                </div>
            </div>
            <div className="admin-toolbar">
                <button className="admin-button" disabled={busy} onClick={onBack}>
                    {t("Retour aux commandes")}
                </button>
                <button className="admin-button" disabled={busy} onClick={() => run()}>
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
            {busy && <p role="status">{t("Chargement…")}</p>}
            {!busy && !failed && !orders.length && <p>{t("La corbeille est vide.")}</p>}
            <div className="admin-order-grid">
                {orders.map((order) => (
                    <article className="admin-order-card" key={order.id}>
                        <strong>#{order.id.slice(-8).toUpperCase()}</strong>
                        <h3>{order.customerName || order.fullName || t("Client invité")}</h3>
                        <p>
                            {t("Annulée · ")}
                            {money(order.totalAmount)}
                        </p>
                        <button
                            className="admin-button"
                            disabled={busy || failed}
                            onClick={() => run(order.id)}
                        >
                            {t("Restaurer")}
                        </button>
                    </article>
                ))}
            </div>
            {orders.length < total && (
                <button
                    className="admin-button"
                    disabled={busy || failed}
                    onClick={() => run(undefined, true)}
                >
                    {t("Charger la suite")}
                </button>
            )}
        </section>
    );
}
