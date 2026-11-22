"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readGmailSettings, saveGmailSettings, verifyGmailSettings, type GmailSettings } from "@/lib/api";
import { isAxiosError } from "axios";
import { useAdminLocale } from "./admin-locale";

export default function GmailSettingsPanel() {
    const { t } = useAdminLocale();
    const [saved, setSaved] = useState<GmailSettings | null>(null), [loading, setLoading] = useState(true);
    const [email, setEmail] = useState(""), [port, setPort] = useState<465 | 587>(465), [enabled, setEnabled] = useState(false);
    const [appPassword, setAppPassword] = useState(""), [currentPassword, setCurrentPassword] = useState(""), [clearPassword, setClearPassword] = useState(false);
    const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const lock = useRef(false), alive = useRef(true);
    function apply(row: GmailSettings) { setSaved(row); setEmail(row.gmailUser); setPort(row.port); setEnabled(row.enabled); setAppPassword(""); setCurrentPassword(""); setClearPassword(false); }
    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { const row = await readGmailSettings(); if (alive.current) apply(row); }
        catch { if (alive.current) setError("Configuration indisponible. Réessayez."); }
        finally { if (alive.current) setLoading(false); }
    }, []);
    useEffect(() => { alive.current = true; const timer = setTimeout(() => void load(), 0); return () => { alive.current = false; clearTimeout(timer); }; }, [load]);
    const dirty = !!saved && (saved.gmailUser !== email.trim().toLowerCase() || saved.port !== port || saved.enabled !== enabled || !!appPassword || clearPassword);
    async function action(test = false) {
        if (lock.current || !saved) return; lock.current = true; setBusy(true); setError(""); setMessage("");
        try {
            if (test) { await verifyGmailSettings(); if (alive.current) setMessage("Connexion Gmail réussie. Aucun e-mail envoyé."); }
            else {
                const row = await saveGmailSettings({ gmailUser: email, port, enabled, appPassword, clearPassword, revision: saved.revision, currentPassword });
                if (alive.current) { apply(row); setMessage("Configuration Gmail enregistrée."); }
            }
        } catch (e) {
            if (alive.current) setError(isAxiosError(e) && typeof e.response?.data?.error === "string" ? e.response.data.error : test ? "Test indisponible. Réessayez la connexion SMTP." : "Enregistrement incertain. Rechargez la configuration avant de réessayer.");
        } finally { lock.current = false; if (alive.current) { setBusy(false); setCurrentPassword(""); } }
    }
    return <section className="admin-panel" id="gmail-smtp-settings">
        <h2>{t("Gmail SMTP")}</h2>
        <p className="admin-muted">{t("Envoi des invitations et des liens de réinitialisation du mot de passe.")}</p>
        {loading ? <p role="status">{t("Chargement…")}</p> : !saved ? <><p role="alert">{t(error)}</p><button className="admin-button" onClick={() => void load()}>{t("Réessayer")}</button></> : <>
            <p className="admin-scope">{t(saved.enabled && saved.hasPassword ? "Gmail SMTP activé" : "Gmail SMTP désactivé")}</p>
            <form className="team-settings-form" onSubmit={e => { e.preventDefault(); void action(); }}>
                <fieldset disabled={busy}>
                    <label>{t("Adresse Gmail d’envoi")}<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="adresse@gmail.com" /></label>
                    <label>{t("Serveur SMTP")}<input value="smtp.gmail.com" readOnly /></label>
                    <label>{t("Connexion sécurisée")}<select value={port} onChange={e => setPort(Number(e.target.value) as 465 | 587)}><option value={465}>465 — SSL/TLS</option><option value={587}>587 — STARTTLS</option></select></label>
                    <label>{t("Mot de passe d’application Google")}<input type="password" autoComplete="new-password" maxLength={64} value={appPassword} onChange={e => setAppPassword(e.target.value)} placeholder={t(saved.hasPassword ? "Déjà enregistré — vide pour conserver" : "16 caractères fournis par Google")} /></label>
                    <p className="admin-scope">{t("Utilisez un mot de passe d’application Google après activation de la validation en deux étapes. Le secret est chiffré et ne sera jamais réaffiché.")} <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">{t("Ouvrir les mots de passe d’application Google")}</a></p>
                    <label className="team-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{t("Activer l’envoi des e-mails")}</label>
                    {saved.hasPassword && <label className="team-check"><input type="checkbox" checked={clearPassword} onChange={e => { setClearPassword(e.target.checked); if (e.target.checked) setEnabled(false); }} />{t("Effacer le mot de passe SMTP enregistré")}</label>}
                    <label>{t("Votre mot de passe actuel pour confirmer")}<input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
                    {error && <p className="admin-alert" role="alert">{t(error)}</p>}
                    {message && <p className="admin-feedback" role="status">{t(message)}</p>}
                    <div className="team-actions"><button className="admin-button primary" disabled={!dirty}>{t(busy ? "Enregistrement…" : "Enregistrer Gmail SMTP")}</button>
                        <button type="button" className="admin-button" disabled={dirty || !saved.enabled || !saved.hasPassword} onClick={() => void action(true)}>{t("Tester la connexion SMTP")}</button>
                        <button type="button" className="admin-text-button" onClick={() => { if (!dirty || window.confirm(t("Abandonner les changements non enregistrés ?"))) void load(); }}>{t("Recharger la configuration")}</button></div>
                </fieldset>
            </form>
        </>}
    </section>;
}
