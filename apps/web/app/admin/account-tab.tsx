"use client";
import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { changeOwnPassword, clearAdminSession } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import MfaSettings from "./mfa-settings";
import SessionSettings from "./session-settings";
export default function AccountTab() {
    const { t } = useAdminLocale();
    const [current, setCurrent] = useState(""), [password, setPassword] = useState(""), [repeat, setRepeat] = useState("");
    const [busy, setBusy] = useState(false), [error, setError] = useState(""); const lock = useRef(false);
    return <><MfaSettings /><SessionSettings /><section className="admin-panel"><h2>{t("Changer mon mot de passe")}</h2>
        <p className="admin-scope">{t("Après modification, toutes vos sessions seront fermées. Reconnectez-vous avec le nouveau mot de passe.")}</p>
        <form className="team-settings-form" onSubmit={async e => {
            e.preventDefault(); if (lock.current) return; setError("");
            if (new TextEncoder().encode(password).length > 72) { setError("Ce mot de passe est trop long. Choisissez une version plus courte."); return; }
            if (password !== repeat) { setError("Les deux mots de passe doivent être identiques."); return; }
            lock.current = true; setBusy(true);
            try { await changeOwnPassword(current, password); clearAdminSession("password-changed"); }
            catch (e) { setError(isAxiosError(e) && typeof e.response?.data?.error === "string" ? e.response.data.error : "Modification incertaine. Essayez de vous reconnecter avant de réessayer."); }
            finally { setBusy(false); lock.current = false; setCurrent(""); }
        }}><fieldset disabled={busy}>
            <label>{t("Mot de passe actuel")}<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} /></label>
            <label>{t("Nouveau mot de passe")}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
            <p className="admin-scope">{t("Au moins 12 caractères.")}</p>
            <label>{t("Confirmer le nouveau mot de passe")}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
            {error && <p className="admin-alert" role="alert">{t(error)}</p>}
            <button className="admin-button primary">{t("Changer mon mot de passe")}</button>
        </fieldset></form>
    </section></>;
}
