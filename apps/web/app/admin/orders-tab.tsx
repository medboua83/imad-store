"use client";
import { useAdminLocale } from "./admin-locale";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { initialOrderListFilters, type OrderListFilters } from "./order-list-context";
import { ArrowUpRight, Package, RefreshCw, Search, X } from "lucide-react";
import { type AdminOrder, updateOrderStatus, trashOrders } from "@/lib/api";
import { OrderTrash } from "./order-trash";
import { OrderHistory } from "./order-history";
import { allowedActions, filterOrders, money, statusLabels } from "./admin-utils";
import { orderAmounts, orderDate, paymentLabels, refineOrders } from "./order-utils";
const actionLabels: Record<string, string> = {
    CONFIRMED: "Confirmer",
    SHIPPED: "Marquer expédiée",
    DELIVERED: "Marquer livrée",
    CANCELLED: "Annuler la commande",
};
const steps = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
export function OrdersTab({
    orders,
    total,
    onRefresh,
    filters,
    setFilters,
    selected,
    onSelect,
}: {
    orders: AdminOrder[];
    total: number;
    onRefresh: () => Promise<void>;
    filters: OrderListFilters;
    setFilters: Dispatch<SetStateAction<OrderListFilters>>;
    selected: string | null;
    onSelect: (id: string | null) => void;
}) {
    const { t, locale } = useAdminLocale();
    const [showTrash, setShowTrash] = useState(false);
    const { search, status, payment, from, to, sort } = filters;
    const setFilter = (key: keyof OrderListFilters, value: string) =>
        setFilters((previous) => ({ ...previous, [key]: value }));
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState(""),
        [error, setError] = useState(false),
        [reloadRequired, setReloadRequired] = useState(false);
    const lock = useRef(false),
        dialog = useRef<HTMLDialogElement>(null);
    const invalidDates = !!from && !!to && from > to;
    const filtered = useMemo(
        () =>
            invalidDates
                ? []
                : refineOrders(filterOrders(orders, search, status), payment, from, to, sort),
        [orders, search, status, payment, from, to, sort, invalidDates],
    );
    const order = orders.find((o) => o.id === selected);
    useEffect(() => {
        const el = dialog.current;
        if (selected && el && !el.open) {
            el.showModal();
            el.scrollTop = 0;
        }
        if (!selected && el?.open) el.close();
        if (!selected) return;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = old;
        };
    }, [selected]);
    async function refresh() {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
            await onRefresh();
            setReloadRequired(false);
            setError(false);
            setMessage("Commandes actualisées.");
        } catch {
            setError(true);
            setMessage("Actualisation impossible. Les données précédentes restent affichées.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function change(o: AdminOrder, next: string) {
        if (lock.current || reloadRequired) return;
        const consequence =
            next === "CANCELLED"
                ? t(" Le stock réservé sera restitué uniquement si sa réservation est vérifiée.")
                : "";
        if (
            !confirm(
                `${t(actionLabels[next])} : #${o.id.slice(-8).toUpperCase()} · ${o.customerName || o.fullName || t("Client invité")} · ${money(o.totalAmount)} ?${consequence}`,
            )
        )
            return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        try {
            await updateOrderStatus(o.id, next);
            try {
                await onRefresh();
                setError(false);
                setMessage(`Commande #${o.id.slice(-8).toUpperCase()} : ${statusLabels[next]}.`);
            } catch {
                setReloadRequired(true);
                setError(true);
                setMessage(
                    "Statut enregistré, mais la liste n’a pas pu être actualisée. Actualisez avant une nouvelle action.",
                );
            }
        } catch (e) {
            setError(true);
            setMessage(
                (e as { response?: { data?: { error?: string } } }).response?.data?.error ||
                    "Mise à jour non confirmée. Actualisez pour vérifier le statut avant de réessayer.",
            );
            setReloadRequired(true);
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function remove(ids: string[]) {
        if (lock.current || reloadRequired || !ids.length) return;
        if (
            !confirm(
                t(
                    "Déplacer {count} commande(s) annulée(s) dans la corbeille ? Elles seront retirées des listes et compteurs de commandes. Restauration possible depuis la corbeille.",
                    { count: ids.length },
                ),
            )
        )
            return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        try {
            const result = await trashOrders(ids);
            await onRefresh();
            setError(false);
            setMessage(`${result.count} commande(s) déplacée(s) dans la corbeille.`);
        } catch {
            setError(true);
            setReloadRequired(true);
            setMessage(
                "Suppression ou actualisation non confirmée. Actualisez avant de réessayer.",
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (showTrash) return <OrderTrash onBack={() => setShowTrash(false)} onRefresh={onRefresh} />;
    const removable = filtered.filter((o) => o.status === "CANCELLED");
    const feedback = message && (
        <p className={error ? "admin-alert" : "admin-feedback"} role={error ? "alert" : "status"}>
            {t(message)}
        </p>
    );
    return (
        <section className="admin-panel">
            <div className="admin-panel-heading">
                <div>
                    <h2>{t("Suivi des commandes")}</h2>
                    <p>
                        {orders.length}
                        {t(" dernières commandes chargées sur ")}
                        {total}
                        {t(". Recherche, compteurs et filtres sur cette sélection.")}
                    </p>
                </div>
                <button className="admin-button" disabled={busy} onClick={refresh}>
                    <RefreshCw size={16} />
                    {t("Actualiser")}
                </button>
            </div>
            <div className="admin-toolbar">
                <button className="admin-button" disabled={busy} onClick={() => setShowTrash(true)}>
                    {t("Corbeille")}
                </button>
                <button
                    className="admin-button"
                    disabled={busy || reloadRequired || !removable.length}
                    onClick={() => remove(removable.map((o) => o.id))}
                >
                    {t("Supprimer les annulées affichées (")}
                    {removable.length})
                </button>
                <p>
                    {t(
                        "Suppression réversible. Seules les commandes annulées de la sélection affichée sont concernées.",
                    )}
                </p>
            </div>
            <div className="order-quick-filters" aria-label={t("Filtrer par statut")}>
                {[["ALL", "Toutes"], ...Object.entries(statusLabels)].map(([key, label]) => (
                    <button
                        key={key}
                        className="order-filter"
                        aria-pressed={status === key}
                        onClick={() => setFilter("status", key)}
                    >
                        {t(label)}
                        <span>
                            {key === "ALL"
                                ? orders.length
                                : orders.filter((o) => o.status === key).length}
                        </span>
                    </button>
                ))}
            </div>
            <div className="admin-toolbar">
                <label className="admin-search">
                    <span>{t("Rechercher une commande")}</span>
                    <div>
                        <Search size={17} />
                        <input
                            dir="auto"
                            type="search"
                            placeholder={t("Nom, téléphone, ville ou référence")}
                            value={search}
                            onChange={(e) => setFilter("search", e.target.value)}
                        />
                    </div>
                </label>
                <label>
                    {t("Trier par")}
                    <select value={sort} onChange={(e) => setFilter("sort", e.target.value)}>
                        <option value="newest">{t("Plus récentes")}</option>
                        <option value="oldest">{t("Plus anciennes")}</option>
                        <option value="amount">{t("Montant décroissant")}</option>
                    </select>
                </label>
            </div>
            <details className="order-extra-filters">
                <summary>
                    {t("Dates et paiement")}
                    {from || to || payment !== "ALL" ? t(" · filtres actifs") : ""}
                </summary>
                <div className="order-filter-fields">
                    <label>
                        {t("Du")}
                        <input
                            dir="auto"
                            type="date"
                            value={from}
                            onInput={(e) => setFilter("from", e.currentTarget.value)}
                        />
                    </label>
                    <label>
                        {t("Au")}
                        <input
                            dir="auto"
                            type="date"
                            value={to}
                            onInput={(e) => setFilter("to", e.currentTarget.value)}
                        />
                    </label>
                    <label>
                        {t("Paiement")}
                        <select
                            value={payment}
                            onChange={(e) => setFilter("payment", e.target.value)}
                        >
                            <option value="ALL">{t("Tous les paiements")}</option>
                            {Object.entries(paymentLabels).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {t(label)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <p>{t("Dates incluses · heure du Maroc.")}</p>
            </details>
            <div className="order-results">
                <p role="status">
                    {filtered.length}
                    {t(" résultat")}
                    {filtered.length !== 1 ? t("s") : ""}
                </p>
                <button
                    className="admin-text-button"
                    disabled={
                        !search &&
                        status === "ALL" &&
                        payment === "ALL" &&
                        !from &&
                        !to &&
                        sort === "newest"
                    }
                    onClick={() => setFilters(initialOrderListFilters)}
                >
                    {t("Réinitialiser les filtres")}
                </button>
            </div>
            {invalidDates && (
                <p role="alert" className="admin-alert">
                    {t("La date de fin doit être égale ou postérieure à la date de début.")}
                </p>
            )}
            {feedback}
            <div className="admin-order-grid">
                {filtered.map((o) => (
                    <article className="admin-order-card" key={o.id}>
                        <div className="admin-order-heading">
                            <div>
                                <strong>#{o.id.slice(-8).toUpperCase()}</strong>
                                <time dateTime={o.createdAt}>
                                    {orderDate(o.createdAt, locale === "ar" ? "ar-MA" : "fr-MA")}
                                </time>
                            </div>
                            <span className={`admin-status status-${o.status.toLowerCase()}`}>
                                {t(statusLabels[o.status] || o.status)}
                            </span>
                        </div>
                        {o.confirmationMethod === "SITE" && (
                            <p className="admin-feedback">{t("Confirmée sur le site")}</p>
                        )}
                        <div className="admin-order-customer">
                            <h3>{o.customerName || o.fullName || t("Client invité")}</h3>
                            <p>{o.city || t("Ville non renseignée")}</p>
                            <p dir="ltr">
                                {o.customerPhone || o.phone || t("Téléphone non renseigné")}
                            </p>
                        </div>
                        <div className="admin-order-amount">
                            <strong>{money(o.totalAmount)}</strong>
                            <span>{t(paymentLabels[o.paymentStatus] || o.paymentStatus)}</span>
                        </div>
                        <button
                            className="admin-button order-details-trigger"
                            aria-haspopup="dialog"
                            onClick={() => {
                                onSelect(o.id);
                                if (!reloadRequired) setMessage("");
                            }}
                        >
                            {t("Voir les détails")}{" "}
                            <span className="sr-only">#{o.id.slice(-8).toUpperCase()}</span>
                            <ArrowUpRight size={16} />
                        </button>
                        {o.status === "CANCELLED" && (
                            <button
                                className="admin-button"
                                disabled={busy || reloadRequired}
                                onClick={() => remove([o.id])}
                            >
                                {t("Supprimer dans la corbeille")}
                            </button>
                        )}
                        {
                            <OrderActions
                                order={o}
                                busy={busy}
                                reloadRequired={reloadRequired}
                                onChange={change}
                            />
                        }
                    </article>
                ))}
            </div>
            {!filtered.length && (
                <div className="admin-empty">
                    <Package size={30} />
                    <h3>{t("Aucune commande trouvée")}</h3>
                    <p>{t("Modifiez les filtres ou recherchez une autre référence.")}</p>
                </div>
            )}
            <dialog
                ref={dialog}
                className="order-detail-dialog"
                aria-labelledby="order-detail-title"
                onClose={() => onSelect(null)}
            >
                <header className="order-detail-header">
                    <div>
                        <p className="admin-eyebrow">{t("FICHE COMMANDE")}</p>
                        <h2 id="order-detail-title">
                            {order
                                ? `#${order.id.slice(-8).toUpperCase()}`
                                : t("Commande indisponible")}
                        </h2>
                    </div>
                    <button
                        className="admin-icon-button"
                        aria-label={t("Fermer les détails")}
                        onClick={() => dialog.current?.close()}
                    >
                        <X size={20} />
                    </button>
                </header>
                {order ? (
                    <OrderDetails
                        order={order}
                        feedback={feedback}
                        actions={
                            <OrderActions
                                order={order}
                                busy={busy}
                                reloadRequired={reloadRequired}
                                onChange={change}
                            />
                        }
                        refresh={
                            <button className="admin-text-button" disabled={busy} onClick={refresh}>
                                {t("Actualiser cette fiche")}
                            </button>
                        }
                    />
                ) : (
                    <p>
                        {t(
                            "Cette commande ne figure plus dans la sélection. Fermez la fiche et actualisez.",
                        )}
                    </p>
                )}
            </dialog>
        </section>
    );
}
function OrderDetails({
    order: o,
    feedback,
    actions,
    refresh,
}: {
    order: AdminOrder;
    feedback: React.ReactNode;
    actions: React.ReactNode;
    refresh: React.ReactNode;
}) {
    const { t, locale } = useAdminLocale();
    const amounts = orderAmounts(o),
        step = steps.indexOf(o.status);
    const address = [
        o.street || o.address?.street,
        o.city || o.address?.city,
        o.region || o.address?.region,
        o.postalCode || o.address?.postalCode,
    ].filter(Boolean);
    return (
        <div className="order-detail-body">
            <div className="order-detail-meta">
                <span className={`admin-status status-${o.status.toLowerCase()}`}>
                    {t(statusLabels[o.status] || o.status)}
                </span>
                <time dateTime={o.createdAt}>
                    {t("Reçue le ")}
                    {orderDate(o.createdAt, locale === "ar" ? "ar-MA" : "fr-MA")}
                </time>
                {refresh}
            </div>
            {o.confirmationMethod === "SITE" && (
                <section className="admin-feedback">
                    <h3>{t("Confirmée sur le site")}</h3>
                    <p>
                        {t("Méthode : site · ")}
                        {o.confirmedAt
                            ? orderDate(o.confirmedAt, locale === "ar" ? "ar-MA" : "fr-MA")
                            : t("Date non renseignée")}
                    </p>
                    <p>
                        {t(
                            "Confirmation du client au checkout, sans vérification du numéro ni garantie de livraison.",
                        )}
                    </p>
                </section>
            )}
            {o.status === "CANCELLED" ? (
                <p className="order-cancelled">{t("Commande annulée : le suivi s’arrête ici.")}</p>
            ) : (
                <ol className="order-progress" aria-label={t("Progression de la commande")}>
                    {steps.map((s, i) => (
                        <li
                            key={s}
                            className={i <= step ? "reached" : ""}
                            aria-current={s === o.status ? "step" : undefined}
                        >
                            <span>{i + 1}</span>
                            {t(statusLabels[s])}
                        </li>
                    ))}
                </ol>
            )}
            <OrderHistory orderId={o.id} status={o.status} />
            <div className="order-detail-columns">
                <section>
                    <h3>{t("Client et livraison")}</h3>
                    <strong>
                        {o.customerName || o.fullName || o.address?.fullName || t("Client invité")}
                    </strong>
                    <p dir="ltr">
                        {o.customerPhone ||
                            o.phone ||
                            o.address?.phone ||
                            t("Téléphone non renseigné")}
                    </p>
                    {o.customerEmail && <p>{o.customerEmail}</p>}
                    <address>
                        {address.length ? address.join(", ") : t("Adresse non renseignée")}
                    </address>
                </section>
                <section>
                    <h3>{t("Paiement")}</h3>
                    <p>
                        {o.paymentMethod === "COD" ? t("Paiement à la livraison") : o.paymentMethod}
                    </p>
                    <strong>{t(paymentLabels[o.paymentStatus] || o.paymentStatus)}</strong>
                    <p>
                        {t("Le statut de livraison ne constitue pas une confirmation de paiement.")}
                    </p>
                </section>
            </div>
            <section>
                <h3>{t("Articles commandés")}</h3>
                {o.items?.length ? (
                    <ul className="order-line-items">
                        {o.items.map((i) => (
                            <li key={i.id}>
                                <div>
                                    <strong>
                                        {i.product?.nameFr ||
                                            i.product?.nameAr ||
                                            i.product?.nameEn ||
                                            t("Article indisponible")}
                                    </strong>
                                    <p>
                                        {[
                                            i.variant?.colorNameFr || i.variant?.colorNameAr,
                                            i.variant?.size,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ") || t("Variante non renseignée")}
                                    </p>
                                    <span>
                                        {i.quantity}
                                        {t(" × ")}
                                        {money(i.unitPrice)}
                                    </span>
                                </div>
                                <strong>{money(i.quantity * i.unitPrice)}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>{t("Articles indisponibles pour cette commande.")}</p>
                )}
            </section>
            <dl className="order-totals">
                {o.items?.length ? (
                    <div>
                        <dt>{t("Sous-total des articles")}</dt>
                        <dd>{money(amounts.subtotal)}</dd>
                    </div>
                ) : null}
                <div>
                    <dt>{t("Livraison")}</dt>
                    <dd>
                        {amounts.shipping === undefined
                            ? t("Non renseignée")
                            : money(amounts.shipping)}
                    </dd>
                </div>
                <div className="order-grand-total">
                    <dt>{t("Total de la commande")}</dt>
                    <dd>{money(o.totalAmount)}</dd>
                </div>
            </dl>
            {!amounts.reconciled && (
                <p className="admin-scope">
                    {t(
                        "Le total enregistré fait foi. Le détail disponible ne permet pas de rapprocher complètement ce montant.",
                    )}
                </p>
            )}
            <section className="order-customer-note">
                <h3>{t("Note du client")}</h3>
                <p>{o.notes || t("Aucune note laissée.")}</p>
            </section>
            <details className="order-reference">
                <summary>{t("Référence complète")}</summary>
                <code>{o.id}</code>
            </details>
            <footer className="order-detail-footer">
                {feedback}
                {actions}
            </footer>
        </div>
    );
}

function OrderActions({
    order: o,
    busy,
    reloadRequired,
    onChange,
}: {
    order: AdminOrder;
    busy: boolean;
    reloadRequired: boolean;
    onChange: (order: AdminOrder, next: string) => void;
}) {
    const { t } = useAdminLocale();
    return (
        <div className="admin-order-actions">
            {(allowedActions[o.status] || []).length ? (
                (allowedActions[o.status] || []).map((next) => (
                    <button
                        key={next}
                        className={`admin-button ${next === "CANCELLED" ? "danger" : ""}`}
                        disabled={busy || reloadRequired}
                        onClick={() => onChange(o, next)}
                    >
                        {busy ? t("En cours…") : t(actionLabels[next])}
                    </button>
                ))
            ) : (
                <p>
                    {o.status === "CANCELLED"
                        ? t("Commande annulée.")
                        : o.status === "DELIVERED"
                          ? t("Commande livrée.")
                          : t("Statut non reconnu.")}{" "}
                    {t("Aucune action disponible.")}
                </p>
            )}
        </div>
    );
}
