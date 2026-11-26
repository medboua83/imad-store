"use client";
import { useCallback, useId, useState } from "react";
import { type AdminOrder, getCarrierIncidentHistory } from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { carrierStatusLabel } from "@imad-store/shared";
import { useAdminLocale } from "./admin-locale";
import { orderDate } from "./order-utils";

export function CarrierIncidentPanel({ shipment, onClose, busy = false }: {
    shipment: NonNullable<AdminOrder["shipment"]>;
    onClose?: (fingerprint: string, reason: string) => Promise<boolean>;
    busy?: boolean;
}) {
    const { t, locale } = useAdminLocale();
    const id = useId();
    const focusReason = useCallback((node: HTMLTextAreaElement | null) => { node?.focus(); }, []);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const fingerprint = shipment.incidentFingerprint;
    const closure = shipment.state === "ATTENTION" && fingerprint && shipment.incidentClosure?.fingerprint === fingerprint ? shipment.incidentClosure : null;
    const historyCount = shipment.incidentHistoryCount ?? shipment.incidentHistory?.length ?? (closure ? 1 : 0);
    const historyQuery = useInfiniteQuery({
        queryKey: ["carrier-incident-history", shipment.id, historyCount],
        queryFn: ({ pageParam, signal }) => getCarrierIncidentHistory(shipment.id, pageParam, signal),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: page => page.nextCursor ?? undefined,
        enabled: historyOpen && historyCount > 0, retry: false,
    });
    const history = historyQuery.data?.pages.flatMap(page => page.items) ?? [];
    const closable = shipment.state === "ATTENTION" && shipment.trackingId && /^[a-f0-9]{64}$/.test(fingerprint || "");
    const changed = editingKey !== fingerprint;
    if (!closure && (!onClose || !closable) && historyCount === 0) return null;
    return <div className="carrier-incident-panel">
        {closure && <p className="carrier-incident-closed"><strong>{t("Incident clôturé sans mouvement de stock")}</strong></p>}
        {onClose && closable && !closure && (editingKey ? <form className="carrier-incident-form" onSubmit={async event => {
            event.preventDefault();
            if (busy || saving || changed || reason.trim().length < 10) return;
            setSaving(true); setError(false);
            try { if (await onClose(editingKey, reason.trim())) setEditingKey(null); }
            catch { setError(true); }
            finally { setSaving(false); }
        }}>
            <p>{t("Cette clôture enregistre votre contrôle de l’incident. Elle ne confirme ni retour physique ni règlement transporteur. Paiement, stock et réservations restent inchangés.")}</p>
            <label htmlFor={id}>{t("Motif de clôture (obligatoire)")}</label>
            <textarea id={id} dir="auto" ref={focusReason} required minLength={10} maxLength={1000}
                value={reason} disabled={busy || saving} onChange={event => setReason(event.target.value)}
                aria-describedby={id + "-help"} />
            <p id={id + "-help"} className="admin-muted">{t("Décrivez le contrôle effectué, de 10 à 1 000 caractères. Le motif, l’auteur et la date seront conservés dans l’historique.")}</p>
            {changed && <p role="alert">{t("Le suivi a changé. Fermez puis rouvrez le formulaire avant de continuer.")}</p>}
            {error && <p role="alert">{t("Clôture non confirmée. Actualisez la fiche avant de réessayer.")}</p>}
            <div className="carrier-incident-actions">
                <button type="submit" className="admin-button primary" disabled={busy || saving || changed || reason.trim().length < 10}>
                    {busy || saving ? t("Enregistrement…") : t("Confirmer la clôture")}
                </button>
                <button type="button" className="admin-button" disabled={busy || saving} onClick={() => { setEditingKey(null); setError(false); }}>
                    {t("Annuler")}
                </button>
            </div>
        </form> : <button type="button" className="admin-button" disabled={busy} onClick={() => { setEditingKey(fingerprint!); setError(false); }}>
            {t("Clôturer l’incident sans mouvement de stock")}
        </button>)}
        {historyCount > 0 && <details className="carrier-incident-history" onToggle={event => setHistoryOpen(event.currentTarget.open)}>
            <summary>{t("Historique des clôtures")}</summary>
            {historyOpen && historyQuery.isPending && <p role="status">{t("Chargement de l’historique…")}</p>}
            {historyOpen && historyQuery.isError && <div role="alert"><p>{t("Historique indisponible. Actualisez la fiche.")}</p>
                <button type="button" className="admin-button" onClick={() => void historyQuery.refetch()}>{t("Réessayer")}</button></div>}
            <ol>{history.map(item => <li key={item.id}>
                <strong>{t("Clôture sans mouvement de stock")}</strong>
                <p>{t("Par")} {item.closedByName} · <time dateTime={item.closedAt}>{orderDate(item.closedAt, locale === "ar" ? "ar-MA" : "fr-MA")}</time></p>
                <p className="carrier-incident-reason" dir="auto">{item.reason}</p>
                <p className="admin-muted">{t("Statut transporteur lors de la clôture")} : {item.carrierStatus ? t(carrierStatusLabel(item.carrierStatus)) : "—"}</p>
            </li>)}</ol>
            {historyQuery.hasNextPage && <button type="button" className="admin-button" disabled={historyQuery.isFetchingNextPage} onClick={() => void historyQuery.fetchNextPage()}>
                {t("Voir les clôtures précédentes")}
            </button>}
        </details>}
    </div>;
}
