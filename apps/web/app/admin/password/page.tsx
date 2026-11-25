"use client";
import { useEffect, useRef, useState } from "react";
import { requestPasswordReset, submitPasswordReset } from "@/lib/api";
import { useAdminLocale, AdminLanguageSelect } from "../admin-locale";
import "../admin.css";
export default function PasswordRecoveryPage() {
    const { t, locale } = useAdminLocale();
    const [token, setToken] = useState<string | null>(null), [ready, setReady] = useState(false);
    const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [repeat, setRepeat] = useState("");
    const [formHeight, setFormHeight] = useState<number>();
    const [done, setDone] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""); const lock = useRef(false);
    useEffect(() => {
        const timer = setTimeout(() => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const values = params.getAll("token");
        setToken(values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0]) ? values[0] : null);
        if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
        setReady(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);
    return <main className="admin-app admin-recovery" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
        <section className="admin-panel"><AdminLanguageSelect /><p className="admin-eyebrow">IMAD MODE</p>
            <h1>{t(token ? "Définir mon mot de passe" : "Mot de passe oublié")}</h1>
            {!ready ? <p role="status">{t("Chargement…")}</p> : <>{done && <p className="admin-feedback" role="status">{t(token ? "Mot de passe enregistré. Connectez-vous avec le nouveau mot de passe." : "Si un compte actif correspond à cette adresse, un lien vous sera envoyé. Vérifiez aussi les courriers indésirables.")}</p>}<form className="team-settings-form" style={formHeight ? { minHeight: formHeight } : undefined} onSubmit={async e => {
                e.preventDefault(); if (done || lock.current) return;
                setFormHeight(e.currentTarget.getBoundingClientRect().height); setError("");
                if (token && new TextEncoder().encode(password).length > 72) { setError("Ce mot de passe est trop long. Choisissez une version plus courte."); return; }
                if (token && password !== repeat) { setError("Les deux mots de passe doivent être identiques."); return; }
                lock.current = true; setBusy(true);
                try {
                    if (token) { await submitPasswordReset(token, password); localStorage.removeItem("adminToken"); localStorage.removeItem("adminRefresh"); localStorage.removeItem("imad:admin:profile"); setPassword(""); setRepeat(""); }
                    else await requestPasswordReset(email);
                    setDone(true);
                } catch { setError(token ? "Ce lien est expiré, déjà utilisé ou temporairement indisponible. Demandez un nouveau lien ou réessayez." : "Demande indisponible. Réessayez dans quelques minutes."); }
                finally { lock.current = false; setBusy(false); }
            }}><fieldset disabled={busy || done}>
                {token ? <><label>{t("Nouveau mot de passe")}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
                    <p className="admin-scope">{t("Au moins 12 caractères.")}</p>
                    <label>{t("Confirmer le nouveau mot de passe")}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={repeat} onChange={e => setRepeat(e.target.value)} /></label></>
                    : <label>{t("Adresse e-mail")}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>}
                {error && <p className="admin-alert" role="alert">{t(error)}</p>}
                <button className="admin-button primary">{t(token ? "Enregistrer mon mot de passe" : "Recevoir un lien de réinitialisation")}</button>
            </fieldset></form></>}
            {!!token && !done && <a className="admin-text-button" href="/admin/password" onClick={() => { setToken(null); setError(""); }}>{t("Demander un nouveau lien")}</a>}
            <a className="admin-text-button" href="/admin">{t("Revenir à la connexion")}</a>
        </section>
    </main>;
}
