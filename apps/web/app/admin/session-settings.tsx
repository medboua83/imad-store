"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { closeOtherBrowserSessions, readOwnBrowserSessions, type OwnBrowserSessions } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { orderDate } from "./order-utils";

export default function SessionSettings() {
    const { t, locale } = useAdminLocale(), id = useId();
    const [open, setOpen] = useState(false), [data, setData] = useState<OwnBrowserSessions | null>(null);
    const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [confirming, setConfirming] = useState(false);
    const [readError, setReadError] = useState(false), [needsRead, setNeedsRead] = useState(false);
    const [error, setError] = useState(""), [message, setMessage] = useState("");
    const [password, setPassword] = useState(""), [code, setCode] = useState("");
    const readLock = useRef(false), writeLock = useRef(false), epoch = useRef(0), controller = useRef<AbortController | null>(null);
    const latest = useRef<OwnBrowserSessions | null>(null);
    const focusPassword = useCallback((node: HTMLInputElement | null) => { node?.focus(); }, []);
    useEffect(() => () => { epoch.current++; controller.current?.abort(); }, []);
    const date = (value: string) => orderDate(value, locale === "ar" ? "ar-MA" : "fr-MA");
    async function read(before?: string) {
        if (readLock.current) return false;
        readLock.current = true; setLoading(true);
        const generation = ++epoch.current, abort = new AbortController(); controller.current = abort;
        try {
            const result = await readOwnBrowserSessions(before, abort.signal);
            if (generation !== epoch.current) return false;
            if (before && latest.current?.current.id !== result.current.id) throw new Error("Session changed");
            const previous = before ? latest.current?.others ?? [] : [];
            const next = { ...result, others: [...previous, ...result.others].filter((row, index, all) => all.findIndex(x => x.id === row.id) === index) };
            latest.current = next; setData(next); setReadError(false); setNeedsRead(false);
            return true;
        } catch {
            if (generation === epoch.current) setReadError(true);
            return false;
        } finally { readLock.current = false; if (generation === epoch.current) setLoading(false); }
    }
    function refresh() {
        setConfirming(false); setPassword(""); setCode(""); setError(""); setMessage("");
        void read();
    }
    return <section className="admin-panel admin-sessions" aria-labelledby={id + "-title"}>
        <h2 id={id + "-title"}>{t("Sessions de connexion")}</h2>
        <p className="admin-scope">{t("Consultez vos sessions du dashboard et fermez les autres connexions en conservant celle-ci.")}</p>
        {!open ? <button type="button" className="admin-button" onClick={() => { setOpen(true); void read(); }}>{t("Voir mes sessions")}</button> : <>
            <div className="admin-session-actions"><button type="button" className="admin-button" disabled={loading || busy} onClick={refresh}>{t("Actualiser mes sessions")}</button></div>
            {loading && <p role="status">{t("Lecture de vos sessions…")}</p>}
            {readError && <p className="admin-alert" role="alert">{t("Liste des sessions indisponible. Actualisez-la.")}</p>}
            {readError && data && <p className="admin-scope">{t("La liste affichée correspond à la dernière lecture réussie.")}</p>}
            {data && <>
                <div className="admin-session-current">
                    <strong>{t("Session actuelle — conservée")}</strong>
                    <p>{t("Ouverte le {date}", { date: date(data.current.createdAt) })}</p>
                    <p>{t("Expiration le {date}", { date: date(data.current.expiresAt) })}</p>
                </div>
                <p className="admin-scope">{t("Plusieurs onglets d’un même navigateur peuvent partager une seule session.")}</p>
                <h3>{t("Autres sessions du dashboard")}</h3>
                {data.others.length === 0 && !data.nextCursor && !readError && <p>{t("Aucune autre session active.")}</p>}
                {data.others.length === 0 && data.nextCursor && <p>{t("D’autres sessions restent à consulter.")}</p>}
                <ul className="admin-session-list">{data.others.map((session, index) => <li key={session.id}>
                    <strong>{t("Session {number}", { number: index + 1 })}</strong>
                    <p>{t("Ouverte le {date}", { date: date(session.createdAt) })}</p>
                    <p>{t("Expiration le {date}", { date: date(session.expiresAt) })}</p>
                </li>)}</ul>
                {data.nextCursor && <button type="button" className="admin-button" disabled={loading || busy || readError} onClick={() => void read(data.nextCursor!)}>{t("Voir les sessions suivantes")}</button>}
                {message && <p className="admin-success" role="status">{t(message)}</p>}
                {error && <p className="admin-alert" role="alert">{t(error)}</p>}
                {data.others.length > 0 && (confirming ? <form className="team-settings-form" onSubmit={async event => {
                    event.preventDefault(); if (writeLock.current || loading || readError || needsRead) return;
                    writeLock.current = true; setBusy(true); setError(""); setMessage("");
                    try {
                        const result = await closeOtherBrowserSessions(password, data.mfaEnabled ? code.trim() : undefined);
                        setConfirming(false);
                        const success = result.closed ? "Les autres sessions du dashboard sont fermées. Votre session actuelle reste ouverte." : "Aucune autre session active à fermer. Votre session actuelle reste ouverte.";
                        setMessage(success);
                        if (!await read()) setMessage("Déconnexion confirmée, mais la liste est indisponible. Actualisez vos sessions.");
                    } catch (cause) {
                        const known = isAxiosError(cause) && [400, 429].includes(cause.response?.status ?? 0);
                        setNeedsRead(!known);
                        setError(isAxiosError(cause) && typeof cause.response?.data?.error === "string" ? cause.response.data.error : "Déconnexion non confirmée. Relisez vos sessions avant de réessayer.");
                    } finally { setPassword(""); setCode(""); setBusy(false); writeLock.current = false; }
                }}><fieldset disabled={busy || loading}>
                    <p>{t("Toutes vos autres sessions du dashboard seront fermées, y compris celles des pages suivantes. Votre session actuelle reste ouverte.")}</p>
                    <label>{t("Mot de passe actuel (sessions)")}<input ref={focusPassword} type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
                    {data.mfaEnabled && <label>{t("Code de l’application ou code de secours (sessions)")}<input type="text" autoComplete="one-time-code" required maxLength={80} value={code} onChange={event => setCode(event.target.value)} /></label>}
                    <div className="admin-session-actions">
                        <button type="submit" className="admin-button primary" disabled={needsRead || readError || !password || data.mfaEnabled && !code.trim()}>{t("Confirmer la déconnexion")}</button>
                        <button type="button" className="admin-button" onClick={() => { setConfirming(false); setPassword(""); setCode(""); setError(""); }}>{t("Annuler")}</button>
                    </div>
                </fieldset></form> : <button type="button" className="admin-button" disabled={busy || loading || readError || needsRead} onClick={() => { setConfirming(true); setError(""); setMessage(""); }}>{t("Fermer mes autres sessions")}</button>)}
            </>}
        </>}
    </section>;
}
