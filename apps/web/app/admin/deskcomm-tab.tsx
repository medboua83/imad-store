"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { getBaseUrl } from "@/lib/api";
const base = getBaseUrl();
type Config = {
    enabled: boolean;
    configured: boolean;
    updatedAt: string | null;
    confirmationSync?: boolean;
    worker?: {
        hosted: boolean;
        enabled: boolean;
        hostedEnabled: boolean;
        cutoffConfigured: boolean;
        scheduled: boolean;
    };
};
export default function DeskcommTab() {
    const [config, setConfig] = useState<Config | null>(null),
        [url, setUrl] = useState(""),
        [enabled, setEnabled] = useState(false),
        [clearWebhook, setClear] = useState(false),
        [loading, setLoading] = useState(false),
        [message, setMessage] = useState("");
    const [reference, setReference] = useState("");
    const [delivery, setDelivery] = useState<{
        reference: string;
        state: string;
        attempts: number;
    } | null>(null);
    const [diagnosticError, setDiagnosticError] = useState("");
    const [checking, setChecking] = useState(false);
    async function checkOrder(e: React.FormEvent) {
        e.preventDefault();
        setChecking(true);
        setDelivery(null);
        setDiagnosticError("");
        try {
            const r = await axios.get(
                base + "/integrations/deskcomm/orders/" + encodeURIComponent(reference.trim()),
                { headers: headers() },
            );
            setDelivery(r.data.data);
        } catch (e) {
            setDiagnosticError(
                axios.isAxiosError(e)
                    ? e.response?.data?.error || "Vérification impossible"
                    : "Erreur réseau",
            );
        } finally {
            setChecking(false);
        }
    }
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
                Statut :{" "}
                {!config
                    ? "Chargement…"
                    : config?.configured
                      ? "Webhook enregistré"
                      : "Aucun webhook"}{" "}
                — {!config ? "" : config.enabled ? "Activé" : "Désactivé"}
            </p>
            {config?.worker && (
                <p className="text-sm" role="status">
                    Service d’envoi :{" "}
                    {config.worker.hosted
                        ? config.worker.scheduled
                            ? "Programmé"
                            : "Arrêté sur cet hébergement"
                        : config.worker.enabled && config.worker.cutoffConfigured
                          ? "Configuré — vérifier le processus serveur"
                          : "Non configuré"}
                    . Un webhook actif ne suffit pas si le service d’envoi est arrêté.
                </p>
            )}
            {config && (
                <p className="text-sm admin-muted">
                    Retour des confirmations CRM :{" "}
                    {config.confirmationSync ? "Configuré" : "Non configuré"}. Ce retour confirme
                    uniquement une commande existante ; il ne crée ni commande ni paiement.
                </p>
            )}
            <form className="space-y-3" onSubmit={checkOrder}>
                <h3 className="font-semibold">Suivi CRM d’une commande</h3>
                <label className="block text-sm">
                    Référence de commande
                    <input
                        className="admin-field mt-2"
                        value={reference}
                        onChange={(e) => {
                            setReference(e.target.value);
                            setDelivery(null);
                            setDiagnosticError("");
                        }}
                        placeholder="Ex. 29EF8EA4"
                        pattern="[a-fA-F0-9]{8}|[a-fA-F0-9]{24}"
                        required
                    />
                </label>
                <button type="submit" className="admin-button" disabled={checking}>
                    {checking ? "Vérification…" : "Vérifier l’envoi CRM"}
                </button>
                {delivery && (
                    <div className="text-sm space-y-2" role="status">
                        <p>
                            #{delivery.reference} —{" "}
                            {{
                                NO_EVENT: "Aucun envoi CRM prévu",
                                PENDING: "En attente d’envoi",
                                PROCESSING: "En cours d’envoi",
                                SENT: "Transmis au webhook",
                                FAILED: "Échec après plusieurs tentatives",
                            }[delivery.state] || delivery.state}{" "}
                            · Tentatives : {delivery.attempts}
                        </p>
                        <p>
                            {delivery.state === "NO_EVENT"
                                ? "Aucun événement n’a été créé pour cette commande. Vérifiez si le CRM était activé à sa création ou si elle provient de l’ancien parcours à autorisation client. Les anciennes commandes ne sont pas ajoutées automatiquement à la file."
                                : delivery.state === "SENT"
                                  ? "Le webhook a accepté la requête. Vérifiez aussi la réception et le classement dans le CRM."
                                  : "L’événement reste enregistré. Un service actif et un webhook valide sont nécessaires. Ne recréez pas la commande."}
                        </p>
                    </div>
                )}
                {diagnosticError && (
                    <p role="alert" className="text-sm">
                        {diagnosticError}
                    </p>
                )}
                <p className="text-xs admin-muted">
                    Vérification en lecture seule : aucune création ni relance de prospect.
                </p>
            </form>
            <hr />
            <p className="text-sm admin-muted">
                Ce réglage appartient uniquement à l’administration. Lorsqu’il est actif et qu’un
                webhook est enregistré, les nouvelles commandes sont mises en file automatiquement.
                Lorsqu’il est désactivé, aucune nouvelle commande n’est ajoutée et les envois en
                attente sont suspendus sans consommer de tentative. La réactivation reprend les
                événements existants éligibles à la limite de date ; elle ne crée pas d’événement
                pour les commandes passées.
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
                    Transmettre automatiquement les nouvelles commandes au CRM
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
