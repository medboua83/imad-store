"use client";
import { useAdminLocale } from "./admin-locale";

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
    const { t } = useAdminLocale();
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
            <h2 className="text-xl font-semibold">{t("Connexion à votre CRM")}</h2>
            {config && (
                <aside className="crm-overview" aria-label={t("Résumé du suivi CRM")}>
                    <h3>{t("Votre connexion en un regard")}</h3>
                    <dl>
                        <div>
                            <dt>{t("Transmission des commandes")}</dt>
                            <dd>
                                {!config.configured
                                    ? t("À connecter")
                                    : config.enabled
                                      ? t("Activée")
                                      : t("En pause")}
                            </dd>
                        </div>
                        <div>
                            <dt>{t("Assistance IA")}</dt>
                            <dd>
                                {config.orderAssistanceEnabled
                                    ? t("Demandée pour les nouvelles commandes admissibles")
                                    : t("Désactivée")}
                            </dd>
                        </div>
                        <div>
                            <dt>{t("Retour des confirmations")}</dt>
                            <dd>{config.confirmationSync ? t("Configuré") : t("À configurer")}</dd>
                        </div>
                        <div>
                            <dt>{t("Dernier envoi accepté par le webhook")}</dt>
                            <dd>
                                {config.activity?.lastSentAt
                                    ? new Date(config.activity.lastSentAt).toLocaleString("fr-MA", {
                                          timeZone: "Africa/Casablanca",
                                      })
                                    : t("Aucun envoi observé")}
                            </dd>
                        </div>
                        <div>
                            <dt>{t("Dernier retour CRM accepté")}</dt>
                            <dd>
                                {config.activity?.lastReturnAt
                                    ? new Date(config.activity.lastReturnAt).toLocaleString(
                                          "fr-MA",
                                          { timeZone: "Africa/Casablanca" },
                                      )
                                    : t("Aucun retour observé")}
                            </dd>
                        </div>
                    </dl>
                    <p>
                        {config.activity?.pending ?? 0}
                        {t(" en attente · ")}
                        {config.activity?.failed ?? 0} {t("en échec")}
                    </p>
                    <p>
                        <strong>{t("Prochaine action : ")}</strong>
                        {!config.configured
                            ? t("Configurer la connexion ci-dessous.")
                            : !config.enabled
                              ? t(
                                    "Réactiver la transmission si vous souhaitez envoyer les nouvelles commandes.",
                                )
                              : config.worker?.hosted && !config.worker.scheduled
                                ? t("Faire vérifier le service d’envoi de l’hébergement.")
                                : config.activity?.failed
                                  ? t(
                                        "Vérifier la référence d’une commande en échec ci-dessous, sans la recréer.",
                                    )
                                  : !config.confirmationSync
                                    ? t("Configurer le retour des confirmations dans le CRM.")
                                    : t(
                                          "Vérifier une référence ci-dessous en cas de doute. L’agent et son canal se contrôlent dans le CRM.",
                                      )}
                    </p>
                    <p className="admin-muted">
                        {t(
                            "Transmission, confirmation client, expédition et paiement sont des étapes distinctes. « Programmé » décrit le service, pas la réception d’une commande.",
                        )}
                    </p>
                </aside>
            )}
            {config && !config.connection && (
                <aside
                    className="rounded-xl border p-4 space-y-2"
                    aria-label={t("Identité de la boutique")}
                >
                    <h3 className="font-semibold">{t("Identité de la boutique")}</h3>
                    <p className="text-sm admin-muted">
                        {t(
                            "Installation historique : aucun identifiant de boutique n’a été attribué. Sa connexion existante peut être rattachée au module CRM sans créer une autre source.",
                        )}
                    </p>
                    <p className="text-sm admin-muted">
                        {t(
                            "Pour une nouvelle boutique modèle, son identifiant d’installation est affiché ici automatiquement. Une référence de commande ou un identifiant de source CRM ne le remplace pas.",
                        )}
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
                <summary>{t("Détails du fonctionnement")}</summary>
                <h3 className="font-semibold">{t("Envoi des nouvelles commandes")}</h3>
                <p className="text-sm admin-muted">
                    {t("Le lien enregistré est chiffré côté serveur et n'est jamais réaffiché.")}
                </p>
                <p className="text-sm">
                    {t("Statut :")}{" "}
                    {!config
                        ? t("Chargement…")
                        : config?.configured
                          ? t("Webhook enregistré")
                          : t("Aucun webhook")}{" "}
                    — {!config ? "" : config.enabled ? t("Activé") : t("Désactivé")}
                </p>
                {config?.worker && (
                    <p className="text-sm" role="status">
                        {t("Service d’envoi :")}{" "}
                        {config.worker.hosted
                            ? config.worker.scheduled
                                ? t("Programmé")
                                : t("Arrêté sur cet hébergement")
                            : config.worker.enabled && config.worker.cutoffConfigured
                              ? t("Configuré — vérifier le processus serveur")
                              : t("Non configuré")}
                        {t(". Un webhook actif ne suffit pas si le service d’envoi est arrêté.")}
                    </p>
                )}
                {config && (
                    <p className="text-sm admin-muted">
                        {t("Retour des confirmations CRM :")}{" "}
                        {config.confirmationSync
                            ? t("Configuré")
                            : config.connection?.configured
                              ? t("En pause")
                              : t("Non configuré")}
                        {t(
                            ". Ce retour confirme uniquement une commande existante ; il ne crée ni commande ni paiement.",
                        )}
                    </p>
                )}
            </details>
            <form className="space-y-3" onSubmit={checkOrder}>
                <h3 className="font-semibold">{t("Suivi CRM d’une commande")}</h3>
                <label className="block text-sm">
                    {t("Référence de commande")}
                    <input
                        dir="auto"
                        className="admin-field mt-2"
                        value={reference}
                        onChange={(e) => {
                            setReference(e.target.value);
                            setDelivery(null);
                            setDiagnosticError("");
                        }}
                        placeholder={t("Ex. 29EF8EA4")}
                        pattern="[a-fA-F0-9]{8}|[a-fA-F0-9]{24}"
                        required
                    />
                </label>
                <button type="submit" className="admin-button" disabled={checking}>
                    {checking ? t("Vérification…") : t("Vérifier l’envoi CRM")}
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
                            {t("· Tentatives : ")}
                            {delivery.attempts}
                        </p>
                        <p>
                            {delivery.state === "NO_EVENT"
                                ? t(
                                      "Aucun événement n’a été créé pour cette commande. Vérifiez si le CRM était activé à sa création ou si elle provient de l’ancien parcours à autorisation client. Les anciennes commandes ne sont pas ajoutées automatiquement à la file.",
                                  )
                                : delivery.state === "SENT"
                                  ? t(
                                        "Le webhook a accepté la requête. Vérifiez aussi la réception et le classement dans le CRM.",
                                    )
                                  : t(
                                        "L’événement reste enregistré. Un service actif et un webhook valide sont nécessaires. Ne recréez pas la commande.",
                                    )}
                        </p>
                    </div>
                )}
                {diagnosticError && (
                    <p role="alert" className="text-sm">
                        {t(diagnosticError)}
                    </p>
                )}
                <p className="text-xs admin-muted">
                    {t("Vérification en lecture seule : aucune création ni relance de prospect.")}
                </p>
            </form>
            <hr />
            <p className="text-sm admin-muted">
                {t(
                    "Ce réglage appartient uniquement à l’administration. Lorsqu’il est actif et qu’un webhook est enregistré, les nouvelles commandes sont mises en file automatiquement. Lorsqu’il est désactivé, aucune nouvelle commande n’est ajoutée et les envois en attente sont suspendus sans consommer de tentative. La réactivation reprend les événements existants éligibles à la limite de date ; elle ne crée pas d’événement pour les commandes passées.",
                )}
            </p>
            <form className="space-y-5" onSubmit={save}>
                <details className="crm-advanced">
                    <summary>{t("Avancé — adresse et clés de connexion")}</summary>
                    <label className="block text-sm">
                        {t("URL du webhook (vide = conserver l'existante)")}
                        <input
                            dir="auto"
                            type="password"
                            autoComplete="off"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={t("https://crm.example.com/webhook/...")}
                            className="admin-field mt-2"
                        />
                    </label>
                    <fieldset className="space-y-3 rounded-xl border p-4">
                        <legend className="text-sm font-semibold">
                            {t("Signature des envois vers le CRM")}
                        </legend>
                        <p className="text-sm admin-muted">
                            {config?.signedSending
                                ? t("Signature configurée")
                                : t("Sans signature entrante CRM")}
                            {t(
                                ". Cette clé est distincte de la clé de retour des confirmations. Le premier contact IA exige aussi un agent, un canal et une règle actifs dans le CRM, avec le réglage d’assistance activé dans cette administration.",
                            )}
                        </p>
                        <label className="block text-sm">
                            {t("Clé de la source CRM (vide = conserver)")}
                            <input
                                dir="auto"
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
                                dir="auto"
                                type="checkbox"
                                checked={clearSigningSecret}
                                onChange={(e) => setClearSigningSecret(e.target.checked)}
                            />
                            {t(
                                "Effacer la signature d’envoi (désactiver d’abord l’IA dans le CRM)",
                            )}
                        </label>
                        <p className="text-xs admin-muted">
                            {t(
                                "La clé est chiffrée et ne sera jamais réaffichée. Coordonner sa mise en place avec la source CRM avant de réactiver les envois. Aucun test ni renvoi historique n’est effectué en enregistrant.",
                            )}
                        </p>
                    </fieldset>
                    <label className="flex items-center gap-3 text-sm admin-danger">
                        <input
                            dir="auto"
                            type="checkbox"
                            checked={clearWebhook}
                            onChange={(e) => setClear(e.target.checked)}
                        />
                        {t("Effacer l'URL enregistrée")}
                    </label>
                </details>
                <label className="flex items-center gap-3 text-sm">
                    <input
                        dir="auto"
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                    {t("Transmettre automatiquement les nouvelles commandes au CRM")}
                </label>
                <fieldset className="space-y-3 rounded-xl border p-4" disabled={!config || loading}>
                    <legend>{t("Assistance IA des commandes")}</legend>
                    <label className="flex items-center gap-3 text-sm">
                        <input
                            dir="auto"
                            type="checkbox"
                            role="switch"
                            checked={orderAssistanceEnabled}
                            onChange={(e) => setOrderAssistanceEnabled(e.target.checked)}
                            aria-describedby="order-assistance-help"
                        />
                        {t("Activer l’assistance IA par WhatsApp")}
                    </label>
                    <p id="order-assistance-help" className="text-xs admin-muted">
                        {t(
                            "Ce choix est géré ici, sans case dans le formulaire client. Il concerne les nouvelles commandes à confirmer. La connexion signée et la règle de suivi de commande doivent aussi être actives dans le CRM. La confirmation directe sur le site reste prioritaire. Aucun ancien envoi n’est relancé.",
                        )}
                    </p>
                    <p className="text-xs admin-muted">
                        {t(
                            "Les oppositions des clients et les prises en charge par l’équipe restent respectées. Désactiver bloque les demandes encore en attente d’envoi ; les conversations déjà ouvertes se gèrent dans le CRM.",
                        )}
                    </p>
                </fieldset>
                <p className="text-xs admin-muted">
                    {t(
                        "Une adresse HTTPS est requise en production. Enregistrer n'envoie aucun test et ne reprend aucune ancienne commande.",
                    )}
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
                    {loading ? t("Enregistrement...") : t("Enregistrer")}
                </button>
                {message && (
                    <p role="status" className="text-sm">
                        {t(message)}
                    </p>
                )}
            </form>
        </section>
    );
}
