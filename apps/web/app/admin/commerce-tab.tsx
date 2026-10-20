"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/lib/api";

export default function CommerceTab() {
    const cache = useQueryClient();
    const [form, setForm] = useState({
        shippingCost: "30",
        freeShippingMin: "500",
        metaPixelId: "",
        metaPixelEnabled: false,
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
                metaPixelId: settings.metaPixelId || "",
                metaPixelEnabled: Boolean(settings.metaPixelEnabled),
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
                                metaPixelId: form.metaPixelId.trim() || null,
                                metaPixelEnabled: form.metaPixelEnabled,
                            });
                            await cache.invalidateQueries({ queryKey: ["store-settings"] });
                            setSaved(true);
                        } catch {
                            setError(
                                "Enregistrement impossible. Vérifiez les montants et l’identifiant du pixel.",
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
