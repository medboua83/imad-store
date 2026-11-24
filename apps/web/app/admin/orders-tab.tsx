"use client";
import { useOrderHistory, orderPageSize } from "./use-order-history";
import { useAdminLocale } from "./admin-locale";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import { orderTrackingMatches, productVariantImages } from "@imad-store/shared";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { initialOrderListFilters, type OrderListFilters } from "./order-list-context";
import { ArrowUpRight, Package, RefreshCw, Search, X } from "lucide-react";
import { type AdminOrder, updateOrderStatus, trashOrders, syncOrderCarrierStatus, approveOrderCarrierDispatch } from "@/lib/api";
import { OrderCarrierStatus } from "./order-carrier-status";
import { OrderTrash } from "./order-trash";
import { OrderHistory } from "./order-history";
import { useAdminPermission } from "./admin-access";
import { OrderExport } from "./order-export";
import { CustomerCancellationAlert, CustomerOrderHistory, hasCancellationHistory } from "./customer-order-history";
import { CustomerDispatchBlacklist } from "./customer-dispatch-blacklist";
import { allowedActions, filterOrders, money, statusLabels } from "./admin-utils";
import { orderAmounts, orderDate, paymentLabels, refineOrders } from "./order-utils";
import { orderWhatsAppLink } from "./order-whatsapp";
const actionLabels: Record<string, string> = {
    CONFIRMED: "Confirmer",
    SHIPPED: "Marquer expédiée",
    DELIVERED: "Marquer livrée",
    CANCELLED: "Annuler la commande",
};
const steps = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const subscribeOrigin = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";
export function OrdersTab({
    orders,
    total,
    onRefresh: onParentRefresh,
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
    const canWrite = useAdminPermission("orders.write"), canExport = useAdminPermission("orders.export");
    const [showTrash, setShowTrash] = useState(false);
    const [customerHistoryId, setCustomerHistoryId] = useState<string | null>(null);
    const showingCustomerHistory = !!selected && customerHistoryId === selected;
    function openOrder(id: string | null) { setCustomerHistoryId(null); onSelect(id); }
    function openCustomerHistory(id: string) { setCustomerHistoryId(id); onSelect(id); }
    const { search, status, payment, tracking, from, to, sort } = filters;
    const serverHistory = total > orders.length;
    const history = useOrderHistory(serverHistory, filters, selected, !!selected && !orders.some(o => o.id === selected));
    async function onRefresh() {
        await onParentRefresh();
        await history.refresh();
    }
    const setFilter = (key: Exclude<keyof OrderListFilters, "page">, value: string) => {
        pageNavigation.current = false;
        setFilters(previous => ({ ...previous, [key]: value, page: 1 }));
    };
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState(""),
        [error, setError] = useState(false),
        [reloadRequired, setReloadRequired] = useState(false);
    const lock = useRef(false),
        dialog = useRef<HTMLDialogElement>(null);
    const resultsRef = useRef<HTMLParagraphElement>(null), pageNavigation = useRef(false);
    const detailTitle = useRef<HTMLHeadingElement>(null);
    const invalidDates = !!from && !!to && from > to;
    const localResults = useMemo(() => invalidDates ? [] : refineOrders(filterOrders(orders.filter(order => orderTrackingMatches(order.shipment, tracking)), search, status), payment, from, to, sort),
        [orders, search, status, payment, tracking, from, to, sort, invalidDates]);
    const localScope = useMemo(() => invalidDates ? [] : refineOrders(filterOrders(orders.filter(order => orderTrackingMatches(order.shipment, tracking)), search, "ALL"), payment, from, to, sort),
        [orders, search, payment, tracking, from, to, sort, invalidDates]);
    const resultTotal = serverHistory ? history.data?.total ?? 0 : localResults.length;
    const pages = Math.max(1, serverHistory ? history.data?.pages ?? 1 : Math.ceil(resultTotal / orderPageSize));
    const page = serverHistory ? history.data?.page ?? filters.page : Math.min(filters.page, pages);
    const filtered = invalidDates ? [] : serverHistory ? history.data?.rows ?? [] : localResults.slice((page - 1) * orderPageSize, page * orderPageSize);
    const scopeTotal = serverHistory ? history.data?.scopeTotal : localScope.length;
    const order = (serverHistory ? history.data?.rows : orders)?.find(o => o.id === selected) || history.detail;
    const readBlocked = !!history.error || history.loading;
    function changePage(next: number) {
        pageNavigation.current = true;
        setFilters(previous => ({ ...previous, page: next }));
    }
    const pagination = (label: string) => pages > 1 && <nav className="admin-inventory-pages order-pagination" aria-label={t(label)}>
        <button type="button" className="admin-button" disabled={page <= 1 || history.loading}
            onClick={() => changePage(page - 1)}>{t("Page précédente")}</button>
        <span>{t("Page {page} sur {total}", { page, total: pages })}</span>
        <button type="button" className="admin-button" disabled={page >= pages || history.loading}
            onClick={() => changePage(page + 1)}>{t("Page suivante")}</button>
    </nav>;
    useEffect(() => {
        if (!pageNavigation.current || history.loading) return;
        pageNavigation.current = false;
        resultsRef.current?.focus({ preventScroll: true });
        resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }, [page, history.loading]);
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
    useEffect(() => {
        if (!selected) return;
        if (dialog.current) dialog.current.scrollTop = 0;
        detailTitle.current?.focus({ preventScroll: true });
    }, [selected, showingCustomerHistory]);
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
        if (lock.current || reloadRequired || readBlocked) return;
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
    async function approveCarrier(o: AdminOrder) {
        if (lock.current || readBlocked || reloadRequired) return;
        if (!confirm(t(o.customerBlacklist?.blocked
            ? "Ce numéro est sur liste noire. Autoriser uniquement l’envoi de la commande #{reference} à Olivraison ? Cette validation ne débloque pas ses autres commandes."
            : "Autoriser l’envoi de la commande #{reference} malgré les anciennes annulations ? Olivraison pourra créer le colis et demander le ramassage selon vos réglages.", { reference: o.id.slice(-8).toUpperCase() }))) return;
        lock.current = true; setBusy(true); setMessage("");
        let saved = false;
        try {
            const result = await approveOrderCarrierDispatch(o.id);
            if (result?.success !== true || result?.data?.approved !== true || result?.data?.orderId !== o.id) throw new Error("Unconfirmed approval");
            saved = true;
            await onRefresh(); setReloadRequired(false); setError(false);
            setMessage("Envoi autorisé pour cette commande. Traitement Olivraison en attente.");
        } catch {
            setReloadRequired(true); setError(true);
            setMessage(saved ? "Envoi autorisé. Actualisez pour relire le suivi." : "Validation ou actualisation non confirmée. Actualisez avant de réessayer.");
        } finally { lock.current = false; setBusy(false); }
    }
    async function syncCarrier(o: AdminOrder) {
        if (lock.current || readBlocked) return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        try {
            await syncOrderCarrierStatus(o.id);
            await onRefresh();
            setReloadRequired(false);
            setError(false);
            setMessage("Statut Olivraison vérifié. Aucun nouveau colis créé.");
        } catch (error) {
            setError(true);
            setMessage((error as { response?: { data?: { error?: string } } }).response?.data?.error ||
                "Vérification impossible. Le dernier statut connu reste affiché ; vous pouvez réessayer.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function remove(ids: string[]) {
        if (lock.current || reloadRequired || readBlocked || !ids.length) return;
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
    if (canWrite && showTrash) return <OrderTrash onBack={() => setShowTrash(false)} onRefresh={onRefresh} />;
    const removable = filtered.filter((o) => o.status === "CANCELLED");
    const feedback = message && (
        <p className={error ? "admin-alert" : "admin-feedback"} role={error ? "alert" : "status"}>
            {t(message)}
        </p>
    );
    return (
        <section className="admin-panel admin-orders-workspace">
            <div className="admin-panel-heading">
                <div>
                    <h2 className="sr-only">{t("Suivi des commandes")}</h2>
                    <p>{t("Recherche dans toutes les commandes, hors corbeille.")}</p>
                </div>
                <button className="admin-button" aria-label={t("Actualiser")} disabled={busy} onClick={refresh}>
                    <RefreshCw size={16} />
                    <span className="order-refresh-label">{t("Actualiser")}</span>
                </button>
            </div>
            <div className="admin-toolbar">
                <label className="admin-search">
                    <span>{t("Rechercher une commande")}</span>
                    <div>
                        <Search size={17} />
                        <input
                            dir="auto"
                            type="search"
                            maxLength={120}
                            placeholder={t("Nom, téléphone, ville ou référence")}
                            value={search}
                            onChange={(e) => setFilter("search", e.target.value)}
                        />
                    </div>
                </label>
            </div>
            <div className="order-filter-controls">
                <label>
                    {t("Trier par")}
                    <select value={sort} onChange={(e) => setFilter("sort", e.target.value)}>
                        <option value="newest">{t("Plus récentes")}</option>
                        <option value="oldest">{t("Plus anciennes")}</option>
                        <option value="amount">{t("Montant décroissant")}</option>
                    </select>
                </label>
                <div className="order-tracking-filter">
                    <label htmlFor="order-tracking-filter">{t("Suivi de livraison")}</label>
                    <select id="order-tracking-filter" value={tracking} onChange={event => setFilter("tracking", event.target.value)}>
                        <option value="ALL">{t("Tous les suivis")}</option>
                        <option value="ATTENTION">{t("À surveiller")}</option>
                        <option value="REPORTED">{t("Livraison reportée")}</option>
                        <option value="UNLINKED">{t("Sans colis relié")}</option>
                    </select>
                    {tracking === "ATTENTION" && <p>{t("Reports, destinataires injoignables, retours et suivis nécessitant une vérification.")}</p>}
                </div>
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
                            {key === "ALL" ? scopeTotal ?? "—" : serverHistory
                                ? history.data?.counts[key] ?? "—"
                                : localScope.filter(o => o.status === key).length}
                        </span>
                    </button>
                ))}
            </div>
            <div className="order-tools">
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
                {canWrite && <details className="order-maintenance">
                    <summary>{t("Gestion des commandes annulées")}</summary>
                    <div className="admin-toolbar">
                        <button className="admin-button" disabled={busy} onClick={() => setShowTrash(true)}>
                            {t("Corbeille")}
                        </button>
                        <button
                            className="admin-button"
                            disabled={busy || reloadRequired || readBlocked || !removable.length}
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
                </details>}
                <CustomerDispatchBlacklist onSearch={phone => {
                    setFilters({ ...initialOrderListFilters, search: phone });
                    requestAnimationFrame(() => { resultsRef.current?.focus(); resultsRef.current?.scrollIntoView({ block: "start" }); });
                }} />
            </div>
            <div className="order-results">
                <p ref={resultsRef} tabIndex={-1} role="status">
                    {serverHistory && !history.data ? t("Résultats en attente") : <>
                        {resultTotal}{t(" résultat")}{resultTotal !== 1 ? t("s") : ""}
                        {resultTotal > 0 && <> · {t("Affichage {from}–{to}", {
                            from: (page - 1) * orderPageSize + 1,
                            to: (page - 1) * orderPageSize + filtered.length,
                        })}</>}
                    </>}
                </p>
                {canExport && <OrderExport filters={filters} disabled={invalidDates || readBlocked || busy || reloadRequired} />}
                <button
                    className="admin-text-button"
                    disabled={
                        !search &&
                        status === "ALL" &&
                        payment === "ALL" &&
                        tracking === "ALL" &&
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
            {history.error && <div className="admin-alert" role="alert">{t(history.error)} <button type="button" onClick={refresh}>{t("Réessayer")}</button></div>}
            {history.loading && <p role="status">{t("Recherche dans l’historique…")}</p>}
            {pagination("Navigation des commandes, début")}
            {feedback}
            <div className="admin-order-grid" aria-busy={history.loading}>
                {filtered.map((o) => (
                    <article className={`admin-order-card${hasCancellationHistory(o) ? " has-cancellation-history" : ""}`} key={o.id}>
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
                        <OrderCarrierStatus order={o} onApprove={canWrite ? () => void approveCarrier(o) : undefined} busy={busy || reloadRequired || readBlocked} />
                        <CustomerCancellationAlert order={o} onOpen={() => openCustomerHistory(o.id)} />
                        <button
                            className="admin-button order-details-trigger"
                            aria-haspopup="dialog"
                            onClick={() => {
                                openOrder(o.id);
                                if (!reloadRequired) setMessage("");
                            }}
                        >
                            {t("Voir les détails")}{" "}
                            <span className="sr-only">#{o.id.slice(-8).toUpperCase()}</span>
                            <ArrowUpRight size={16} />
                        </button>
                        {canWrite && o.status === "CANCELLED" && (
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
                                reloadRequired={reloadRequired || readBlocked}
                                onChange={change}
                            />
                        }
                    </article>
                ))}
            </div>
            {pagination("Navigation des commandes, fin")}
            {!filtered.length && !history.loading && !history.error && !invalidDates && (
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
                onCancel={(event) => {
                    event.preventDefault();
                    openOrder(null);
                }}
            >
                <header className="order-detail-header">
                    <div>
                        <p className="admin-eyebrow">{showingCustomerHistory ? `#${selected!.slice(-8).toUpperCase()}` : t("FICHE COMMANDE")}</p>
                        <h2 id="order-detail-title" ref={detailTitle} tabIndex={-1}>
                            {showingCustomerHistory ? t("Historique du numéro") : selected && (order || history.loading || history.error)
                                ? `#${selected.slice(-8).toUpperCase()}`
                                : t("Commande indisponible")}
                        </h2>
                    </div>
                    <button
                        className="admin-icon-button"
                        aria-label={t("Fermer les détails")}
                        onClick={() => openOrder(null)}
                    >
                        <X size={20} />
                    </button>
                </header>
                {showingCustomerHistory ? <CustomerOrderHistory key={selected} orderId={selected!} onBack={() => setCustomerHistoryId(null)} onOrder={openOrder} /> : !order && history.loading ? <p role="status">{t("Chargement de la commande…")}</p> : !order && history.error ? (
                    <div className="admin-alert" role="alert">{t(history.error)} <button type="button" onClick={refresh}>{t("Réessayer")}</button></div>
                ) : order ? (
                    <OrderDetails
                        order={order}
                        customerHistory={hasCancellationHistory(order)
                            ? <CustomerCancellationAlert order={order} onOpen={() => openCustomerHistory(order.id)} />
                            : order.customerHistory?.available ? <button type="button" className="admin-text-button" onClick={() => openCustomerHistory(order.id)}>{t("Voir l’historique du numéro")}</button> : null}
                        carrier={<OrderCarrierStatus order={order} onApprove={canWrite ? () => void approveCarrier(order) : undefined} onSync={canWrite ? () => void syncCarrier(order) : undefined} busy={busy || reloadRequired || readBlocked} />}
                        feedback={<>{history.error && <p className="admin-alert" role="alert">{t(history.error)}</p>}{history.loading && <p role="status">{t("Recherche dans l’historique…")}</p>}{feedback}</>}
                        actions={
                            <OrderActions
                                order={order}
                                busy={busy}
                                reloadRequired={reloadRequired || readBlocked}
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
                            "Cette commande est introuvable ou a été déplacée dans la corbeille.",
                        )}
                    </p>
                )}
            </dialog>
        </section>
    );
}
function OrderDetails({
    order: o,
    carrier,
    customerHistory,
    feedback,
    actions,
    refresh,
}: {
    order: AdminOrder;
    carrier: React.ReactNode;
    customerHistory: React.ReactNode;
    feedback: React.ReactNode;
    actions: React.ReactNode;
    refresh: React.ReactNode;
}) {
    const { t, locale } = useAdminLocale();
    const origin = useSyncExternalStore(subscribeOrigin, browserOrigin, serverOrigin);
    const whatsapp = origin ? orderWhatsAppLink(o, origin) : null;
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
                <p className="order-cancelled">{t("Commande annulée. Le suivi du colis reste disponible ci-dessous, si un colis est associé.")}</p>
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
            {customerHistory}
            <OrderHistory orderId={o.id} status={o.status} />
            {carrier}
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
                    {whatsapp && (
                        <p><a className="admin-button" href={whatsapp} target="_blank" rel="noreferrer">
                            {t("Contacter sur WhatsApp")}
                        </a></p>
                    )}
                    {whatsapp && <p className="admin-scope">{t("Récapitulatif et liens des photos préremplis. Vérifiez le message puis envoyez-le dans WhatsApp.")}</p>}
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
                                <div className="order-item-photo">
                                    <ProductPhoto
                                        images={productVariantImages(
                                            { images: i.product?.images ?? [], colorPhotos: i.product?.colorPhotos },
                                            i.variant ? { color: i.variant.color ?? "", colorNameFr: i.variant.colorNameFr ?? "", colorNameAr: i.variant.colorNameAr ?? "", colorNameEn: i.variant.colorNameEn ?? "" } : undefined,
                                        )}
                                        name={(locale === "ar" ? i.product?.nameAr : i.product?.nameFr) || i.product?.nameFr || i.product?.nameAr || t("Article indisponible")}
                                        sizes="80px"
                                        className="object-contain"
                                        thumbnail
                                    />
                                </div>
                                <div className="order-item-description">
                                    <strong>
                                        {(locale === "ar" ? i.product?.nameAr : i.product?.nameFr) || i.product?.nameFr ||
                                            i.product?.nameAr ||
                                            i.product?.nameEn ||
                                            t("Article indisponible")}
                                    </strong>
                                    <p>
                                        {[
                                            (i.variant?.colorNameFr || i.variant?.colorNameAr || i.variant?.colorNameEn) && `${t("Couleur")} : ${(locale === "ar" ? i.variant?.colorNameAr : i.variant?.colorNameFr) || i.variant?.colorNameFr || i.variant?.colorNameAr || i.variant?.colorNameEn}`,
                                            i.variant?.size && `${t("Taille")} : ${i.variant.size}`,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ") || t("Variante non renseignée")}
                                    </p>
                                    {i.variant?.sku && <p>{t("Référence produit")} : <bdi>{i.variant.sku}</bdi></p>}
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
    const canWrite = useAdminPermission("orders.write");
    if (!canWrite) return <p className="admin-scope">{t("Consultation uniquement")}</p>;
    return (
        <div className="admin-order-actions">
            {(allowedActions[o.status] || []).length ? (
                (allowedActions[o.status] || []).filter(next => next !== "SHIPPED" || o.shipment?.state !== "REVIEW_REQUIRED").map((next) => (
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
