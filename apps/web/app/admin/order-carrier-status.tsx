"use client";
import { carrierStatusLabel, orderTrackingMatches } from "@imad-store/shared";
import { Truck } from "lucide-react";
import { type AdminOrder } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { orderDate } from "./order-utils";
import { CarrierIncidentPanel } from "./carrier-incident-panel";

export function OrderCarrierStatus({ order, onSync, onApprove, onClose, busy = false }: {
    order: AdminOrder;
    onSync?: () => void;
    onApprove?: () => void;
    onClose?: (fingerprint: string, reason: string) => Promise<boolean>;
    busy?: boolean;
}) {
    const { t, locale } = useAdminLocale();
    const shipment = order.shipment;
    if (!shipment) return onSync ? <p>{t("Aucun colis Olivraison relié à cette commande.")}</p> : null;
    const held = shipment.state === "REVIEW_REQUIRED" && !shipment.trackingId;
    const disconnected = shipment.state === "DISCONNECTED";
    if (held) return <section className="order-carrier-status order-carrier-attention" aria-label={t("Validation de l’envoi Olivraison")}>
        <strong><Truck size={18} aria-hidden="true" />{t("Validation requise avant Olivraison")}</strong>
        <p>{t("L’envoi est bloqué à cause des anciennes annulations associées au numéro. Vérifiez l’historique avant d’autoriser cette commande.")}</p>
        <p>{t("Aucun colis créé pour cette demande en attente.")}</p>
        {onApprove && order.status === "CONFIRMED" && <button type="button" className="admin-button" disabled={busy} onClick={onApprove}>{t("Autoriser l’envoi à Olivraison")}</button>}
    </section>;
    const status = shipment.carrierStatus;
    const attention = orderTrackingMatches(shipment, "ATTENTION");
    return <section className={`order-carrier-status${attention ? " order-carrier-attention" : ""}`} aria-label={t("Suivi Olivraison")}>
        <strong><Truck size={18} aria-hidden="true" /> Olivraison · {status ? t(carrierStatusLabel(status)) : t("En attente de création")}</strong>
        {shipment.approvedAt && <p>{t("Envoi autorisé manuellement")}</p>}
        {attention && <span className="admin-tag">{t("À surveiller")}</span>}
        {shipment.trackingId && <p>{t("Numéro de suivi")} : <bdi>{shipment.trackingId}</bdi></p>}
        {shipment.lastSyncedAt ? <p className="order-carrier-date">
            {t("Dernière vérification")} : <time dateTime={shipment.lastSyncedAt}>{orderDate(shipment.lastSyncedAt, locale === "ar" ? "ar-MA" : "fr-MA")}</time>
        </p> : <p>{t("Statut transporteur pas encore vérifié.")}</p>}
        {disconnected && <p>{t("Suivi retiré : vérifiez ce colis directement chez Olivraison.")}</p>}
        {shipment.lastError && !disconnected && <p>{t(shipment.lastError)}</p>}
        {onSync && shipment.trackingId && !disconnected && <button type="button" className="admin-button" disabled={busy} onClick={onSync}>
            {busy ? t("Vérification…") : t("Vérifier chez Olivraison")}
        </button>}
        <CarrierIncidentPanel key={order.id} shipment={shipment} onClose={onClose} busy={busy} />
    </section>;
}
