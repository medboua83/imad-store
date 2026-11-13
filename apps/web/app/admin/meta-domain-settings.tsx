"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeMetaDomainVerification } from "@imad-store/shared";
import { getSettings, updateSettings } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";

export function MetaDomainSettings() {
    const { t } = useAdminLocale();
    const cache = useQueryClient();
    const [value, setValue] = useState("");
    const [baseline, setBaseline] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [invalid, setInvalid] = useState(false);
    const lock = useRef(false);
    const field = useRef<HTMLTextAreaElement>(null);
    const dirty = baseline !== null && value !== baseline;
    const token = normalizeMetaDomainVerification(value);
    const load = useCallback(async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
            const settings = await getSettings();
            const next = settings.metaDomainVerification || "";
            setValue(next);
            setBaseline(next);
        } catch {
            setError("Impossible de charger le code Meta. Réessayez.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }, []);
    useEffect(() => {
        const task = setTimeout(() => void load(), 0);
        return () => clearTimeout(task);
    }, [load]);
    useEffect(() => {
        if (!dirty && !busy) return;
        const protect = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty, busy]);
    return (
        <section id="meta-domain-settings" tabIndex={-1} className="admin-social-settings"
            aria-labelledby="meta-domain-title">
            <h2 id="meta-domain-title">{t("Vérification du domaine Meta")}</h2>
            <p>{t("Ce code prouve le contrôle de votre domaine auprès de Meta. Il est indépendant du Pixel et du compte publicitaire.")}</p>
            {error && <p className="admin-alert" role="alert">{t(error)}</p>}
            {baseline === null ? (
                busy || !error ? <p role="status">{t("Chargement du code Meta…")}</p> :
                    <button className="admin-button" onClick={() => void load()}>{t("Recharger le code Meta")}</button>
            ) : (
                <form className="commerce-settings" noValidate onSubmit={async (event) => {
                    event.preventDefault();
                    if (lock.current) return;
                    setSaved(false);
                    setError("");
                    setInvalid(token === null);
                    if (token === null) { field.current?.focus(); return; }
                    lock.current = true;
                    setBusy(true);
                    try {
                        // A partial update cannot replace a Pixel, delivery rule or another setting.
                        const result = await updateSettings({ metaDomainVerification: token || null });
                        if (result.success !== true || !result.data ||
                            (result.data.metaDomainVerification || "") !== token)
                            throw new Error("Verification code was not acknowledged");
                        setValue(token);
                        setBaseline(token);
                        cache.setQueryData(["store-settings"], result.data);
                        await cache.invalidateQueries({ queryKey: ["store-settings"] });
                        setSaved(true);
                    } catch {
                        setError("Enregistrement du code Meta impossible. Votre saisie est conservée ; vous pouvez réessayer.");
                    } finally {
                        lock.current = false;
                        setBusy(false);
                    }
                }}>
                    {dirty && <p className="commerce-draft-note" role="status">{t("Modifications non enregistrées")}</p>}
                    <fieldset disabled={busy}>
                        <legend>{t("Code de vérification Meta")}</legend>
                        <p>{t(baseline ? "Un code est enregistré sur le site. Validation à terminer dans Meta." : "Aucun code de vérification enregistré.")}</p>
                        <label htmlFor="meta-domain-token">{t("Code ou balise fournie par Meta")}</label>
                        <textarea ref={field} id="meta-domain-token" rows={3} dir="ltr" maxLength={512}
                            value={value} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                            aria-invalid={invalid} aria-describedby={`meta-domain-help${invalid ? " meta-domain-error" : ""}`}
                            onChange={(event) => { setValue(event.target.value); setInvalid(false); setSaved(false); setError(""); }} />
                        <p id="meta-domain-help">{t("Collez le code seul ou la balise facebook-domain-verification complète. Après enregistrement, ouvrez ou actualisez l’accueil, puis cliquez sur Vérifier le domaine dans Meta. Un champ vide retire la balise du site.")}</p>
                        {invalid && <p id="meta-domain-error" role="alert" className="admin-alert">{t("Code Meta invalide. Collez uniquement le code ou sa balise de vérification, sans autre HTML.")}</p>}
                        {token && <code dir="ltr" style={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere", textAlign: "left" }}>{`<meta name="facebook-domain-verification" content="${token}" />`}</code>}
                        <button type="button" className="admin-button" onClick={() => { setValue(""); setSaved(false); setInvalid(false); setError(""); }}>{t("Effacer la saisie")}</button>
                    </fieldset>
                    <button className="admin-button primary" disabled={busy}>{busy ? t("Enregistrement…") : t("Enregistrer le code Meta")}</button>
                    {saved && <p role="status" className="admin-feedback">{t("Code Meta enregistré. La validation finale se fait dans Meta.")}</p>}
                    <a href="/" target="_blank" rel="noopener noreferrer">{t("Ouvrir l’accueil pour vérifier")}</a>
                    <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer">{t("Ouvrir Meta Business Suite")}</a>
                </form>
            )}
        </section>
    );
}
