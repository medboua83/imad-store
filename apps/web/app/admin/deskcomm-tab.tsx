"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { getBaseUrl } from "@/lib/api";
const base = getBaseUrl();
type Config = { enabled: boolean; configured: boolean; updatedAt: string | null };
export default function DeskcommTab() {
    const [config, setConfig] = useState<Config | null>(null),
        [url, setUrl] = useState(""),
        [enabled, setEnabled] = useState(false),
        [clearWebhook, setClear] = useState(false),
        [loading, setLoading] = useState(false),
        [message, setMessage] = useState("");
    const headers = () => ({
        Authorization: "Bearer " + (localStorage.getItem("adminToken") || ""),
    });
    useEffect(() => {
        axios
            .get<{ data: Config }>(base + "/integrations/deskcomm", { headers: headers() })
            .then((r) => {
                setConfig(r.data.data);
                setEnabled(r.data.data.enabled);
            })
            .catch(() => setMessage("Impossible de charger la configuration"));
    }, []);
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        try {
            const body: { enabled: boolean; webhookUrl?: string; clearWebhook?: boolean } = {
                enabled,
                clearWebhook,
            };
            if (url.trim()) body.webhookUrl = url.trim();
            const r = await axios.put<{ data: Config }>(base + "/integrations/deskcomm", body, {
                headers: headers(),
            });
            setConfig(r.data.data);
            setUrl("");
            setClear(false);
            setMessage("Configuration enregistrée");
        } catch (e) {
            setMessage(
                axios.isAxiosError(e)
                    ? e.response?.data?.error || "Échec de l'enregistrement"
                    : "Erreur réseau",
            );
        } finally {
            setLoading(false);
        }
    }
    return (
        <section className="max-w-2xl admin-panel admin-crm space-y-4">
            <h2 className="text-xl font-semibold">DeskcommCRM — Webhook</h2>
            <p className="text-sm admin-muted">
                Le lien enregistré est chiffré côté serveur et n&apos;est jamais réaffiché.
            </p>
            <p className="text-sm">
                Statut : {config?.configured ? "Webhook enregistré" : "Aucun webhook"} —{" "}
                {config?.enabled ? "Activé" : "Désactivé"}
            </p>
            <form className="space-y-5" onSubmit={save}>
                <label className="block text-sm">
                    URL du webhook (vide = conserver l&apos;existante)
                    <input
                        type="password"
                        autoComplete="off"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://crm.example.com/webhook/..."
                        className="admin-field mt-2"
                    />
                </label>
                <label className="flex items-center gap-3 text-sm">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    Activer l&apos;envoi de nouvelles commandes
                </label>
                <label className="flex items-center gap-3 text-sm admin-danger">
                    <input
                        type="checkbox"
                        checked={clearWebhook}
                        onChange={(e) => setClear(e.target.checked)}
                    />
                    Effacer l&apos;URL enregistrée
                </label>
                <p className="text-xs admin-muted">
                    HTTPS obligatoire en production. HTTP permis seulement dans cet environnement
                    local de test avec DESKCOMM_ALLOW_HTTP_DEV=true. Utilisez uniquement des donnees
                    fictives. Enregistrer n&apos;envoie aucun test.
                </p>
                <button
                    type="submit"
                    disabled={loading || (clearWebhook && Boolean(url))}
                    className="admin-button primary"
                >
                    {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
                {message && (
                    <p role="status" className="text-sm">
                        {message}
                    </p>
                )}
            </form>
        </section>
    );
}
