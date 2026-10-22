"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/lib/api";

export function OrderSettings() {
    const cache = useQueryClient();
    const [enabled, setEnabled] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    const lock = useRef(false);
    useEffect(() => {
        let active = true;
        getSettings()
            .then((settings) => {
                if (active) {
                    setEnabled(settings.directSiteConfirmation === true);
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
        <section aria-labelledby="order-settings-title">
            <h2 id="order-settings-title">Gestion des commandes</h2>
            <form
                className="commerce-settings"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ready || lock.current) return;
                    lock.current = true;
                    setBusy(true);
                    setMessage("");
                    try {
                        const result = await updateSettings({ directSiteConfirmation: enabled });
                        if (result.data.directSiteConfirmation !== enabled)
                            throw new Error("Unconfirmed setting");
                        setEnabled(result.data.directSiteConfirmation);
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
                <fieldset disabled={!ready || busy}>
                    <legend>Confirmation directe sur le site</legend>
                    <label className="admin-option-check">
                        <input
                            type="checkbox"
                            role="switch"
                            aria-label="Confirmation directe sur le site"
                            aria-describedby="direct-confirmation-help"
                            checked={enabled}
                            onChange={(e) => {
                                setEnabled(e.target.checked);
                                setMessage("");
                            }}
                        />
                        {enabled ? "Activée" : "Désactivée"}
                    </label>
                    <p id="direct-confirmation-help">
                        Activée : le client relit le récapitulatif et confirme une seule fois au
                        checkout, sans demande de confirmation WhatsApp supplémentaire. Désactivée :
                        le processus actuel est conservé.
                    </p>
                    <p>
                        Ce choix s’applique aux nouvelles commandes. La confirmation ne vérifie pas
                        le numéro de téléphone et ne garantit pas la livraison.
                    </p>
                </fieldset>
                <button className="admin-button primary" disabled={!ready || busy}>
                    {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
                {message && (
                    <p
                        className={failed ? "admin-alert" : "admin-feedback"}
                        role={failed ? "alert" : "status"}
                    >
                        {message}
                    </p>
                )}
            </form>
        </section>
    );
}
