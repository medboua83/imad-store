"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import CrmConnectionForm, { type CompanyConnection } from "./crm-connection-form";
import { getBaseUrl } from "@/lib/api";
const base = getBaseUrl();
type Config = {
    enabled: boolean;
    configured: boolean;
    signedSending?: boolean;
    orderAssistanceEnabled?: boolean;
    updatedAt: string | null;
    confirmationSync?: boolean;
    connection?: CompanyConnection | null;
    activity?: {
        lastSentAt: string | null;
        lastReturnAt: string | null;
        pending: number;
        failed: number;
    };
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
    const [orderAssistanceEnabled, setOrderAssistanceEnabled] = useState(false);
    const [signingSecret, setSigningSecret] = useState("");
    const [clearSigningSecret, setClearSigningSecret] = useState(false);
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
                setOrderAssistanceEnabled(r.data.data.orderAssistanceEnabled === true);
            })
            .catch(() => setMessage("Impossible de charger la configuration"));
    }, []);
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        try {
            const body: {
                enabled: boolean;
                orderAssistanceEnabled: boolean;
                webhookUrl?: string;
                clearWebhook?: boolean;
                signingSecret?: string;
                clearSigningSecret?: boolean;
            } = {
                enabled,
                orderAssistanceEnabled,
                clearWebhook,
                clearSigningSecret,
            };
            if (url.trim()) body.webhookUrl = url.trim();
            if (signingSecret.trim()) body.signingSecret = signingSecret.trim();
            const r = await axios.put<{ data: Config }>(base + "/integrations/deskcomm", body, {
                headers: headers(),
            });
            setConfig((previous) => ({ ...previous, ...r.data.data }));
            setUrl("");
            setClear(false);
            setSigningSecret("");
            setClearSigningSecret(false);
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
            <h2 className="text-xl font-semibold">Connexion à votre CRM</h2>
            {config && (
                <aside className="crm-overview" aria-label="Résumé du suivi CRM">
                    <h3>Votre connexion en un regard</h3>
                    <dl>
                        <div>
                            <dt>Transmission des commandes</dt>
                            <dd>
                                {!config.configured
                                    ? "À connecter"
                                    : config.enabled
                                      ? "Activée"
                                      : "En pause"}
                            </dd>
                        </div>
                        <div>
                            <dt>Assistance IA</dt>
                            <dd>
                                {config.orderAssistanceEnabled
                                    ? "Demandée pour les nouvelles commandes admissibles"
                                    : "Désactivée"}
                            </dd>
                        </div>
                        <div>
                            <dt>Retour des confirmations</dt>
                            <dd>{config.confirmationSync ? "Configuré" : "À configurer"}</dd>
                        </div>
                        <div>
                            <dt>Dernier envoi accepté par le webhook</dt>
                            <dd>
                                {config.activity?.lastSentAt
                                    ? new Date(config.activity.lastSentAt).toLocaleString("fr-MA", {
                                          timeZone: "Africa/Casablanca",
                                      })
                                    : "Aucun envoi observé"}
                            </dd>
                        </div>
                        <div>
                            <dt>Dernier retour CRM accepté</dt>
                            <dd>
                                {config.activity?.lastReturnAt
                                    ? new Date(config.activity.lastReturnAt).toLocaleString(
                                          "fr-MA",
                                          { timeZone: "Africa/Casablanca" },
                                      )
                                    : "Aucun retour observé"}
                            </dd>
                        </div>
                    </dl>
                    <p>
                        {config.activity?.pending ?? 0} en attente · {config.activity?.failed ?? 0}{" "}
                        en échec
                    </p>
                    <p>
                        <strong>Prochaine action : </strong>
                        {!config.configured
                            ? "Configurer la connexion ci-dessous."
                            : !config.enabled
                              ? "Réactiver la transmission si vous souhaitez envoyer les nouvelles commandes."
                              : config.worker?.hosted && !config.worker.scheduled
                                ? "Faire vérifier le service d’envoi de l’hébergement."
                                : config.activity?.failed
                                  ? "Vérifier la référence d’une commande en échec ci-dessous, sans la recréer."
                                  : !config.confirmationSync
                                    ? "Configurer le retour des confirmations dans le CRM."
                                    : "Vérifier une référence ci-dessous en cas de doute. L’agent et son canal se contrôlent dans le CRM."}
                    </p>
                    <p className="admin-muted">
                        Transmission, confirmation client, expédition et paiement sont des étapes
                        distinctes. « Programmé » décrit le service, pas la réception d’une
                        commande.
                    </p>
                </aside>
            )}
            {config && !config.connection && (
                <aside
                    className="rounded-xl border p-4 space-y-2"
                    aria-label="Identité de la boutique"
                >
                    <h3 className="font-semibold">Identité de la boutique</h3>
                    <p className="text-sm admin-muted">
                        Installation historique : aucun identifiant de boutique n’a été attribué. Sa
                        connexion existante peut être rattachée au module CRM sans créer une autre
                        source.
                    </p>
                    <p className="text-sm admin-muted">
                        Pour une nouvelle boutique modèle, son identifiant d’installation est
                        affiché ici automatiquement. Une référence de commande ou un identifiant de
                        source CRM ne le remplace pas.
                    </p>
                </aside>
            )}
            {config?.connection && (
                <CrmConnectionForm
                    connection={config.connection}
                    onSaved={() => {
                        axios
                            .get<{ data: Config }>(base + "/integrations/deskcomm", {
                                headers: headers(),
                            })
                            .then((r) => setConfig(r.data.data))
                            .catch(() => setMessage("Actualisation impossible"));
                    }}
                />
            )}
            <details className="crm-advanced">
                <summary>Détails du fonctionnement</summary>
                <h3 className="font-semibold">Envoi des nouvelles commandes</h3>
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
                        {config.confirmationSync
                            ? "Configuré"
                            : config.connection?.configured
                              ? "En pause"
                              : "Non configuré"}
                        . Ce retour confirme uniquement une commande existante ; il ne crée ni
                        commande ni paiement.
                    </p>
                )}
            </details>
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
                <details className="crm-advanced">
                    <summary>Avancé — adresse et clés de connexion</summary>
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
                    <fieldset className="space-y-3 rounded-xl border p-4">
                        <legend className="text-sm font-semibold">
                            Signature des envois vers le CRM
                        </legend>
                        <p className="text-sm admin-muted">
                            {config?.signedSending
                                ? "Signature configurée"
                                : "Sans signature entrante CRM"}
                            . Cette clé est distincte de la clé de retour des confirmations. Le
                            premier contact IA exige aussi un agent, un canal et une règle actifs
                            dans le CRM, avec le réglage d’assistance activé dans cette
                            administration.
                        </p>
                        <label className="block text-sm">
                            Clé de la source CRM (vide = conserver)
                            <input
                                type="password"
                                autoComplete="new-password"
                                className="admin-field mt-2"
                                pattern="[a-fA-F0-9]{64}"
                                value={signingSecret}
                                onChange={(e) => setSigningSecret(e.target.value)}
                            />
                        </label>
                        <label className="flex items-center gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={clearSigningSecret}
                                onChange={(e) => setClearSigningSecret(e.target.checked)}
                            />
                            Effacer la signature d’envoi (désactiver d’abord l’IA dans le CRM)
                        </label>
                        <p className="text-xs admin-muted">
                            La clé est chiffrée et ne sera jamais réaffichée. Coordonner sa mise en
                            place avec la source CRM avant de réactiver les envois. Aucun test ni
                            renvoi historique n’est effectué en enregistrant.
                        </p>
                    </fieldset>
                    <label className="flex items-center gap-3 text-sm admin-danger">
                        <input
                            type="checkbox"
                            checked={clearWebhook}
                            onChange={(e) => setClear(e.target.checked)}
                        />
                        Effacer l&apos;URL enregistrée
                    </label>
                </details>
                <label className="flex items-center gap-3 text-sm">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    Transmettre automatiquement les nouvelles commandes au CRM
                </label>
                <fieldset className="space-y-3 rounded-xl border p-4" disabled={!config || loading}>
                    <legend>Assistance IA des commandes</legend>
                    <label className="flex items-center gap-3 text-sm">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={orderAssistanceEnabled}
                            onChange={(e) => setOrderAssistanceEnabled(e.target.checked)}
                            aria-describedby="order-assistance-help"
                        />
                        Activer l’assistance IA par WhatsApp
                    </label>
                    <p id="order-assistance-help" className="text-xs admin-muted">
                        Ce choix est géré ici, sans case dans le formulaire client. Il concerne les
                        nouvelles commandes à confirmer. La connexion signée et la règle de suivi de
                        commande doivent aussi être actives dans le CRM. La confirmation directe sur
                        le site reste prioritaire. Aucun ancien envoi n’est relancé.
                    </p>
                    <p className="text-xs admin-muted">
                        Les oppositions des clients et les prises en charge par l’équipe restent
                        respectées. Désactiver bloque les demandes encore en attente d’envoi ; les
                        conversations déjà ouvertes se gèrent dans le CRM.
                    </p>
                </fieldset>
                <p className="text-xs admin-muted">
                    Une adresse HTTPS est requise en production. Enregistrer n&apos;envoie aucun
                    test et ne reprend aucune ancienne commande.
                </p>
                <button
                    type="submit"
                    disabled={
                        !config ||
                        loading ||
                        (clearWebhook && Boolean(url)) ||
                        (clearSigningSecret && Boolean(signingSecret))
                    }
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
