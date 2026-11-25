"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { isAxiosError } from "axios";
import { readAdminMfa, setupAdminMfa, confirmAdminMfa, cancelAdminMfa, disableAdminMfa, clearAdminSession, type MfaStatus, type MfaSetup } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";

export default function MfaSettings() {
    const { t } = useAdminLocale();
    const [status, setStatus] = useState<MfaStatus | null>(null), [setup, setSetup] = useState<MfaSetup | null>(null);
    const [password, setPassword] = useState(""), [code, setCode] = useState(""), [saved, setSaved] = useState(false), [disabling, setDisabling] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
    const lock = useRef(false), heading = useRef<HTMLHeadingElement>(null);
    const load = async () => { setError(""); try { setStatus(await readAdminMfa()); } catch { setError("Impossible de lire la protection du compte. Réessayez."); } };
    useEffect(() => { let alive = true; readAdminMfa().then(s => { if (alive) setStatus(s); }).catch(() => { if (alive) setError("Impossible de lire la protection du compte. Réessayez."); }); return () => { alive = false; }; }, []);
    useEffect(() => {
        if (!setup) return;
        heading.current?.focus();
        const timer = setTimeout(() => { setSetup(null); setSaved(false); setPassword(""); setCode(""); setError("Préparation expirée. Recommencez la configuration."); }, 10 * 60 * 1000);
        return () => clearTimeout(timer);
    }, [setup]);
    const act = async (run: () => Promise<void>) => {
        if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
        try { await run(); } catch (e) { setError(isAxiosError(e) && typeof e.response?.data?.error === "string" ? e.response.data.error : "Résultat incertain. Vérifiez votre connexion et réessayez."); }
        finally { lock.current = false; setBusy(false); }
    };
    const submit = (e: FormEvent) => {
        e.preventDefault(); void act(async () => {
            if (setup) { await confirmAdminMfa({ currentPassword: password, setupId: setup.setupId, code, recoverySaved: true }); clearAdminSession("mfa-changed"); }
            else if (disabling) { await disableAdminMfa(password, code); clearAdminSession("mfa-changed"); }
            else { setSetup(await setupAdminMfa(password)); setCode(""); setSaved(false); }
        });
    };
    const download = () => {
        if (!setup) return;
        const blob = new Blob([t("Codes de secours — conservez-les dans un endroit sûr, séparé de votre mot de passe.") + "\n\n" + setup.recoveryCodes.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "codes-secours-boutique.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <section className="admin-panel admin-mfa" aria-labelledby="mfa-heading">
        <h2 id="mfa-heading">{t("Double authentification")}</h2>
        <p className="admin-scope">{t("Protégez votre compte avec votre mot de passe et un code de Google Authenticator, Microsoft Authenticator ou une application compatible.")}</p>
        {status && <p className={status.enabled ? "admin-mfa-active" : "admin-scope"}>{t(status.enabled ? "Protection active" : "Protection non activée")}{status.enabled && " · " + t("{count} codes de secours disponibles", { count: status.recoveryCodesRemaining })}</p>}
        {error && <p className="admin-alert" role="alert">{t(error)}</p>}
        {message && <p role="status">{t(message)}</p>}
        {!status && (error ? <button type="button" className="admin-button" onClick={() => void load()}>{t("Réessayer")}</button> : <p role="status">{t("Lecture de la protection…")}</p>)}
        {status?.enabled && !disabling && <>
            <p className="admin-scope">{t("Pour remplacer votre application ou renouveler les codes de secours, désactivez puis reconfigurez cette protection.")}</p>
            <button type="button" className="admin-button" onClick={() => { setDisabling(true); setError(""); }}>{t("Désactiver la double authentification")}</button>
        </>}
        {status && (!status.enabled || disabling) && <form className="team-settings-form" onSubmit={submit}><fieldset disabled={busy}>
            {setup && <div className="admin-mfa-setup">
                <h3 ref={heading} tabIndex={-1}>{t("1. Ajoutez ce compte dans votre application")}</h3>
                <Image unoptimized src={setup.qr} alt={t("QR code de configuration de la double authentification")} width={280} height={280} className="admin-mfa-qr" />
                <p className="admin-scope">{t("Sur le même téléphone, ajoutez manuellement cette clé dans l’application. Préparation valable 10 minutes.")}</p>
                <label>{t("Clé de configuration")}<input dir="ltr" readOnly value={setup.secret} autoComplete="off" onFocus={e => e.target.select()} /></label>
                <h3>{t("2. Conservez vos codes de secours")}</h3>
                <p>{t("Ils permettent de vous connecter si vous perdez votre téléphone. Chaque code est à usage unique. Ils ne seront plus affichés ensuite.")}</p>
                <ul className="admin-mfa-codes" dir="ltr">{setup.recoveryCodes.map(c => <li key={c}><code>{c}</code></li>)}</ul>
                <button type="button" className="admin-button" onClick={download}>{t("Télécharger mes codes de secours")}</button>
                <label className="team-check"><input type="checkbox" checked={saved} required onChange={e => setSaved(e.target.checked)} />{t("J’ai conservé mes codes de secours en lieu sûr.")}</label>
                <h3>{t("3. Confirmez avec le code de l’application")}</h3>
            </div>}
            <label>{t("Mot de passe actuel (sécurité du compte)")}<input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
            {(setup || disabling) && <label>{t(disabling ? "Code de l’application ou code de secours" : "Code de l’application")}<input dir="ltr" inputMode={setup ? "numeric" : "text"} autoComplete="one-time-code" required pattern={setup ? "[0-9]{6}" : undefined} maxLength={setup ? 6 : 80} value={code} onChange={e => setCode(e.target.value)} /></label>}
            <p className="admin-scope">{t("L’activation ou la désactivation ferme toutes vos sessions. Vos brouillons restent conservés. Reconnectez-vous ensuite.")}</p>
            {setup && <p className="admin-scope">{t("Après l’activation, attendez le prochain code de l’application pour vous connecter.")}</p>}
            <button className="admin-button primary" disabled={busy || !!setup && !saved}>{t(busy ? "Vérification…" : setup ? "Activer et me reconnecter" : disabling ? "Désactiver et me reconnecter" : "Configurer la double authentification")}</button>
            {(setup || disabling) && <button type="button" className="admin-button" onClick={() => void act(async () => { if (setup) await cancelAdminMfa(setup.setupId); setSetup(null); setSaved(false); setCode(""); setPassword(""); setDisabling(false); })}>{t("Annuler")}</button>}
        </fieldset></form>}
    </section>;
}
