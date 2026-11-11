"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    normalizeStoreContact,
    storeContacts,
    type StoreContacts,
    type StoreContactKey,
} from "@imad-store/shared";
import { getSettings, updateSettings } from "@/lib/api";
import { SocialIcon } from "@/components/store/StoreIcons";
import { useAdminLocale } from "./admin-locale";

const fields: { key: StoreContactKey; label: string; network: string; placeholder: string }[] = [
    {
        key: "whatsappUrl",
        label: "WhatsApp — numéro international ou lien",
        network: "WhatsApp",
        placeholder: "+212 600 000 000 ou https://wa.me/message/…",
    },
    {
        key: "instagramUrl",
        label: "Lien Instagram",
        network: "Instagram",
        placeholder: "https://www.instagram.com/votre-compte/",
    },
    {
        key: "facebookUrl",
        label: "Lien Facebook",
        network: "Facebook",
        placeholder: "https://www.facebook.com/votre-page/",
    },
    {
        key: "tiktokUrl",
        label: "Lien TikTok",
        network: "TikTok",
        placeholder: "https://www.tiktok.com/@votre-compte",
    },
];
export function SocialSettings() {
    const { t } = useAdminLocale();
    const cache = useQueryClient();
    const [form, setForm] = useState<StoreContacts | null>(null);
    const [baseline, setBaseline] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [invalid, setInvalid] = useState<StoreContactKey[]>([]);
    const [saved, setSaved] = useState(false);
    const lock = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const dirty = form !== null && JSON.stringify(form) !== baseline;
    useEffect(() => {
        if (!dirty && !busy) return;
        const protect = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty, busy]);
    const load = useCallback(async () => {
        if (lock.current) return;
        lock.current = true;
        setLoading(true);
        setError("");
        try {
            const values = storeContacts(await getSettings());
            setForm(values);
            setBaseline(JSON.stringify(values));
        } catch {
            setError("Impossible de charger les liens. Réessayez.");
        } finally {
            lock.current = false;
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        const task = setTimeout(() => void load(), 0);
        return () => clearTimeout(task);
    }, [load]);
    return (
        <section
            id="social-settings"
            tabIndex={-1}
            className="admin-social-settings"
            aria-labelledby="social-settings-title"
        >
            <h2 id="social-settings-title">{t("Réseaux sociaux et WhatsApp")}</h2>
            <p>
                {t(
                    "Ces liens s’appliquent à la boutique, au pied de page et à la page Contact. Un champ vide masque le réseau et ses boutons.",
                )}
            </p>
            {error && (
                <p className="admin-alert" role="alert">
                    {t(error)}
                </p>
            )}
            {!form ? (
                loading ? (
                    <p role="status">{t("Chargement des liens…")}</p>
                ) : (
                    <button className="admin-button" onClick={() => void load()}>
                        {t("Recharger les liens")}
                    </button>
                )
            ) : (
                <form
                    ref={formRef}
                    className="commerce-settings"
                    noValidate
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (lock.current) return;
                        const errors = fields
                            .filter(({ key }) => normalizeStoreContact(key, form[key]) === null)
                            .map(({ key }) => key);
                        setInvalid(errors);
                        setError("");
                        setSaved(false);
                        if (errors.length) {
                            formRef.current
                                ?.querySelector<HTMLInputElement>(`[name="${errors[0]}"]`)
                                ?.focus();
                            return;
                        }
                        lock.current = true;
                        setBusy(true);
                        const payload = Object.fromEntries(
                            fields.map(({ key }) => [key, normalizeStoreContact(key, form[key])!]),
                        ) as StoreContacts;
                        try {
                            const result = await updateSettings(payload);
                            if (result.success !== true || !result.data)
                                throw new Error("Invalid settings response");
                            if (fields.some(({ key }) => result.data[key] !== payload[key]))
                                throw new Error("Contact settings were not acknowledged");
                            const values = storeContacts(result.data);
                            setForm(values);
                            setBaseline(JSON.stringify(values));
                            cache.setQueryData(["store-settings"], result.data);
                            await cache.invalidateQueries({ queryKey: ["store-settings"] });
                            setSaved(true);
                        } catch {
                            setError(
                                "Enregistrement des liens impossible. Votre saisie est conservée ; vous pouvez réessayer.",
                            );
                        } finally {
                            lock.current = false;
                            setBusy(false);
                        }
                    }}
                >
                    {dirty && (
                        <p className="commerce-draft-note" role="status">
                            {t("Modifications non enregistrées")}
                        </p>
                    )}
                    <fieldset disabled={busy}>
                        <legend>{t("Comptes de la boutique")}</legend>
                        {fields.map(({ key, label, network, placeholder }) => {
                            const url = normalizeStoreContact(key, form[key]);
                            return (
                                <div className="admin-social-field" key={key}>
                                    <label htmlFor={`contact-${key}`}>
                                        <SocialIcon network={network} size={20} />
                                        {t(label)}
                                    </label>
                                    <input
                                        id={`contact-${key}`}
                                        name={key}
                                        dir="ltr"
                                        type="text"
                                        inputMode={key === "whatsappUrl" ? "text" : "url"}
                                        maxLength={2048}
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder={placeholder}
                                        value={form[key]}
                                        aria-invalid={invalid.includes(key)}
                                        aria-describedby={
                                            invalid.includes(key) ? `error-${key}` : undefined
                                        }
                                        onChange={(event) => {
                                            setForm({ ...form, [key]: event.target.value });
                                            setSaved(false);
                                            setError("");
                                            setInvalid(invalid.filter((item) => item !== key));
                                        }}
                                    />
                                    {invalid.includes(key) && (
                                        <p id={`error-${key}`} className="admin-alert" role="alert">
                                            {t(
                                                key === "whatsappUrl"
                                                    ? "Indiquez un numéro international avec indicatif pays ou un lien HTTPS WhatsApp valide."
                                                    : "Utilisez un lien HTTPS du réseau indiqué.",
                                            )}
                                        </p>
                                    )}
                                    {url && (
                                        <a
                                            className="admin-social-preview"
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {t("Ouvrir le lien {network}", { network })}
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                        <p>
                            {t(
                                "WhatsApp accepte un numéro avec indicatif pays, par exemple +212 600 000 000, ou un lien wa.me. Cela ne modifie pas la connexion WhatsApp du CRM ni l’agent IA.",
                            )}
                        </p>
                    </fieldset>
                    <button className="admin-button primary" disabled={busy || !dirty}>
                        {busy ? t("Enregistrement…") : t("Enregistrer les liens")}
                    </button>
                    {saved && (
                        <p className="admin-feedback" role="status">
                            {t("Liens enregistrés. Ils sont maintenant utilisés sur la boutique.")}
                        </p>
                    )}
                </form>
            )}
        </section>
    );
}
