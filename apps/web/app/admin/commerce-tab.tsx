"use client";
import { OlivraisonSettings } from "./olivraison-settings";
import { OrderSettings } from "./order-settings";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, type StoreSettings } from "@/lib/api";

export default function CommerceTab() {
    const cache = useQueryClient();
    const [form, setForm] = useState({
        shippingCost: "30",
        freeShippingMin: "500",
        deliveryMaxDays: "",
        returnWindowDays: "",
        returnFeePayer: "" as NonNullable<StoreSettings["returnFeePayer"]> | "",
        metaPixelId: "",
        metaPixelEnabled: false,
        metaPixelMadPerUsd: "",
    });
    const [ready, setReady] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [saved, setSaved] = useState(false);
    async function load() {
        setError("");
        try {
            const settings = await getSettings();
            setForm({
                shippingCost: String(settings.shippingCost),
                freeShippingMin: String(settings.freeShippingMin),
                deliveryMaxDays: settings.deliveryMaxDays ? String(settings.deliveryMaxDays) : "",
                returnWindowDays: settings.returnWindowDays ? String(settings.returnWindowDays) : "",
                returnFeePayer: settings.returnFeePayer || "",
                metaPixelId: settings.metaPixelId || "",
                metaPixelEnabled: Boolean(settings.metaPixelEnabled),
                metaPixelMadPerUsd: settings.metaPixelMadPerUsd ? String(settings.metaPixelMadPerUsd) : "",
            });
            setReady(true);
        } catch {
            setError("Impossible de charger les réglages. Réessayez avant de modifier.");
        }
    }
    useEffect(() => {
        const task = setTimeout(() => {
            void load();
        }, 0);
        return () => clearTimeout(task);
    }, []);
    return (
        <section className="admin-panel">
            <OrderSettings />
            <OlivraisonSettings />
            <h2>Livraison et suivi publicitaire</h2>
            {error && (
                <p className="admin-alert" role="alert">
                    {error}
                </p>
            )}
            {!ready ? (
                error ? (
                    <button className="admin-button" onClick={() => void load()}>
                        Recharger les réglages
                    </button>
                ) : (
                    <p role="status">Chargement des réglages…</p>
                )
            ) : (
                <form
                    className="commerce-settings"
                    onChange={() => setSaved(false)}
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        setSaved(false);
                        setBusy(true);
                        try {
                            await updateSettings({
                                shippingCost: Number(form.shippingCost),
                                freeShippingMin: Number(form.freeShippingMin),
                                deliveryMaxDays: form.deliveryMaxDays ? Number(form.deliveryMaxDays) : null,
                                returnWindowDays: form.returnWindowDays ? Number(form.returnWindowDays) : null,
                                returnFeePayer: form.returnFeePayer || null,
                                metaPixelId: form.metaPixelId.trim() || null,
                                metaPixelEnabled: form.metaPixelEnabled,
                                metaPixelMadPerUsd: form.metaPixelMadPerUsd ? Number(form.metaPixelMadPerUsd) : null,
                            });
                            await cache.invalidateQueries({ queryKey: ["store-settings"] });
                            setSaved(true);
                        } catch {
                            setError(
                                "Enregistrement impossible. Vérifiez les montants, les délais et l’identifiant du pixel.",
                            );
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <fieldset disabled={busy}>
                        <legend>Règles de livraison</legend>
                        <label>
                            Frais de livraison (DH)
                            <input
                                required
                                type="number"
                                min="0"
                                max="1000000"
                                step="0.01"
                                value={form.shippingCost}
                                onChange={(e) => setForm({ ...form, shippingCost: e.target.value })}
                            />
                        </label>
                        <label>
                            Livraison offerte à partir de (DH)
                            <input
                                required
                                type="number"
                                min="0"
                                max="1000000"
                                step="0.01"
                                value={form.freeShippingMin}
                                onChange={(e) =>
                                    setForm({ ...form, freeShippingMin: e.target.value })
                                }
                            />
                        </label>
                        <p>
                            Le seuil utilise le montant des produits après promotion, hors
                            livraison. Zéro offre la livraison à toutes les commandes.
                        </p>
                        <p>
                            Un produit avec « Livraison offerte » rend tout le panier gratuit à
                            livrer, même avec d’autres produits. Sinon, les frais ci-dessus
                            s’appliquent jusqu’au seuil.
                        </p>
                    </fieldset>
                    <fieldset disabled={busy}>
                        <legend>Délais et retours affichés aux clients</legend>
                        <label>
                            Délai maximal de livraison (jours)
                            <input type="number" min="1" max="365" step="1" value={form.deliveryMaxDays}
                                onChange={e => setForm({ ...form, deliveryMaxDays: e.target.value })} />
                        </label>
                        <label>
                            Délai de demande de retour après réception (jours)
                            <input type="number" min="1" max="365" step="1" value={form.returnWindowDays}
                                onChange={e => setForm({ ...form, returnWindowDays: e.target.value })} />
                        </label>
                        <label>
                            Frais de retour à la charge de
                            <select value={form.returnFeePayer}
                                onChange={e => setForm({ ...form, returnFeePayer: e.target.value as typeof form.returnFeePayer })}>
                                <option value="">Non renseigné</option>
                                <option value="STORE">La boutique</option>
                                <option value="DELIVERY_TRY_ON">Essai à la livraison : boutique ; après paiement et départ : client</option>
                                <option value="CUSTOMER">Le client</option>
                                <option value="BY_REASON">Selon le motif</option>
                            </select>
                        </label>
                        {form.returnFeePayer === "DELIVERY_TRY_ON" && <p>La boutique prend en charge le retour confirmé pendant l’essayage à la livraison. Après paiement et départ du livreur, le client paie les frais d’un retour demandé dans le délai indiqué.</p>}
                        <p>Laissez un délai vide pour ne pas annoncer d’engagement. Ces informations apparaissent sur les pages pratiques et les fiches produits. Vérifiez leur cohérence avec vos conditions détaillées ; aucun remboursement ni colis n’est déclenché.</p>
                    </fieldset>
                    <fieldset disabled={busy}>
                        <legend>Meta Pixel</legend>
                        <label>
                            Identifiant Meta Pixel
                            <input
                                inputMode="numeric"
                                pattern="[0-9]{5,25}"
                                maxLength={25}
                                placeholder="Identifiant numérique uniquement"
                                value={form.metaPixelId}
                                required={form.metaPixelEnabled}
                                onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
                            />
                        </label>
                        <label className="admin-option-check">
                            <input
                                type="checkbox"
                                checked={form.metaPixelEnabled}
                                onChange={(e) =>
                                    setForm({ ...form, metaPixelEnabled: e.target.checked })
                                }
                            />{" "}
                            Activer Meta Pixel
                        </label>
                        <label>
                            Conversion Meta : 1 USD = combien de MAD ?
                            <input type="number" min="0.000001" max="1000000" step="0.000001"
                                value={form.metaPixelMadPerUsd}
                                onChange={(e) => setForm({ ...form, metaPixelMadPerUsd: e.target.value })}
                                placeholder="Taux de référence à renseigner" />
                        </label>
                        <p>
                            Meta ne prend pas en charge le MAD pour Purchase. Le total est divisé par
                            ce taux et arrondi au centime USD. Les prix et commandes restent en MAD.
                            Ce taux est manuel : mettez-le à jour selon votre référence de change.
                        </p>
                        {Number(form.metaPixelMadPerUsd) > 0 ? <p>
                            Exemple : 230 MAD → {(230 / Number(form.metaPixelMadPerUsd)).toFixed(2)} USD.
                        </p> : <p role="status">
                            Purchase reste en pause tant que le taux n’est pas renseigné.
                            Les visites continuent. Aucune ancienne commande ne sera rejouée.
                        </p>}
                        <p>
                            Pages vues, produits consultés, début de commande et commande créée
                            (paiement à la livraison). Aucun nom, téléphone, e-mail ni adresse n’est
                            ajouté aux événements.
                        </p>
                        <p>
                            Le script se charge automatiquement, sauf refus enregistré du visiteur.
                            L’administration, les visites locales, les tests et les signaux de refus
                            de suivi sont exclus.
                        </p>
                        <a
                            href="https://www.facebook.com/events_manager2/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Ouvrir le gestionnaire d’événements Meta
                        </a>
                    </fieldset>
                    <button className="admin-button primary" disabled={busy}>
                        {busy ? "Enregistrement…" : "Enregistrer les réglages"}
                    </button>
                    {saved && (
                        <p className="admin-feedback" role="status">
                            Réglages enregistrés.
                        </p>
                    )}
                </form>
            )}
        </section>
    );
}
