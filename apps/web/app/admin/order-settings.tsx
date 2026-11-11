"use client";
import { useAdminLocale } from "./admin-locale";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/lib/api";

export function OrderSettings() {
    const { t } = useAdminLocale();
    const cache = useQueryClient();
    const [enabled, setEnabled] = useState(false);
    const [baseline, setBaseline] = useState<boolean | null>(null);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    const lock = useRef(false);
    const dirty = baseline !== null && enabled !== baseline;
    useEffect(() => {
        if (!dirty && !busy) return;
        const protect = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty, busy]);
    useEffect(() => {
        let active = true;
        getSettings()
            .then((settings) => {
                if (active) {
                    setEnabled(settings.directSiteConfirmation === true);
                    setBaseline(settings.directSiteConfirmation === true);
                    setReady(true);
                }
            })
            .catch(() => {
                if (active) {
                    setFailed(true);
                    setMessage("Réglage indisponible. Rechargez les paramètres.");
                }
            });
        return () => {
            active = false;
        };
    }, []);
    return (
        <section id="order-settings" tabIndex={-1} aria-labelledby="order-settings-title">
            <h2 id="order-settings-title">{t("Gestion des commandes")}</h2>
            <form
                className="commerce-settings"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ready || !dirty || lock.current) return;
                    lock.current = true;
                    setBusy(true);
                    setMessage("");
                    try {
                        const result = await updateSettings({ directSiteConfirmation: enabled });
                        if (result.data.directSiteConfirmation !== enabled)
                            throw new Error("Unconfirmed setting");
                        setEnabled(result.data.directSiteConfirmation);
                        setBaseline(result.data.directSiteConfirmation);
                        await cache.invalidateQueries({ queryKey: ["store-settings"] });
                        setFailed(false);
                        setMessage("Gestion des commandes enregistrée.");
                    } catch {
                        setFailed(true);
                        setMessage(
                            "Enregistrement non confirmé. Rechargez les paramètres pour vérifier.",
                        );
                    } finally {
                        lock.current = false;
                        setBusy(false);
                    }
                }}
            >
                {dirty && <p className="commerce-draft-note" role="status">{t("Modifications non enregistrées")}</p>}
                <fieldset disabled={!ready || busy}>
                    <legend>{t("Confirmation directe sur le site")}</legend>
                    <label className="admin-option-check">
                        <input
                            dir="auto"
                            type="checkbox"
                            role="switch"
                            aria-label={t("Confirmation directe sur le site")}
                            aria-describedby="direct-confirmation-help"
                            checked={enabled}
                            onChange={(e) => {
                                setEnabled(e.target.checked);
                                setMessage("");
                            }}
                        />
                        {enabled ? t("Activée") : t("Désactivée")}
                    </label>
                    <p id="direct-confirmation-help">
                        {t(
                            "Activée : le client relit le récapitulatif et confirme une seule fois au checkout, sans demande de confirmation WhatsApp supplémentaire. Désactivée : le processus actuel est conservé.",
                        )}
                    </p>
                    <p>
                        {t(
                            "Ce choix s’applique aux nouvelles commandes. La confirmation ne vérifie pas le numéro de téléphone et ne garantit pas la livraison.",
                        )}
                    </p>
                </fieldset>
                <button className="admin-button primary" disabled={!ready || busy || !dirty}>
                    {busy ? t("Enregistrement…") : t("Enregistrer")}
                </button>
                {message && (
                    <p
                        className={failed ? "admin-alert" : "admin-feedback"}
                        role={failed ? "alert" : "status"}
                    >
                        {t(message)}
                    </p>
                )}
            </form>
        </section>
    );
}
