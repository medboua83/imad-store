"use client";
import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
type Report = { checkedAt: string; checkedAtText: { fr: string; ar: string }; completed: number; total: number; checks: Array<{
    id: string; ready: boolean; label: string; detail: string; href: string | null;
}> };
function validReport(value: unknown): value is Report {
    const v = value as Report;
    return !!v && typeof v.checkedAt === "string" && Number.isFinite(Date.parse(v.checkedAt)) &&
        !!v.checkedAtText && [v.checkedAtText.fr, v.checkedAtText.ar].every(text => typeof text === "string" && !!text.trim() && text.length <= 100) &&
        Number.isInteger(v.completed) && Number.isInteger(v.total) && v.total > 0 && v.completed >= 0 && v.completed <= v.total &&
        Array.isArray(v.checks) && v.checks.length === v.total && v.checks.every(c => c && typeof c.id === "string" && !!c.id.trim() && typeof c.ready === "boolean" &&
            typeof c.label === "string" && typeof c.detail === "string" && (c.href === null || /^\/admin\?tab=[a-z]+(?:#[a-z-]+)?$/.test(c.href))) &&
        new Set(v.checks.map(c => c.id)).size === v.total && v.checks.filter(c => c.ready).length === v.completed;
}
export function StoreReadiness({ active }: { active: boolean }) {
    const { t, locale } = useAdminLocale();
    const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false);
    const request = useRef<AbortController | null>(null);
    async function load() {
        request.current?.abort(); const controller = new AbortController(); request.current = controller;
        setBusy(true); setError(false);
        try {
            const result = await adminApi.get("/settings/readiness", { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (!validReport(result.data.data)) throw new Error("Invalid readiness report");
            setReport(result.data.data);
        } catch { if (!controller.signal.aborted) setError(true); }
        finally { if (!controller.signal.aborted) setBusy(false); }
    }
    useEffect(() => {
        if (!active) return;
        const task = setTimeout(() => void load(), 0);
        return () => { clearTimeout(task); request.current?.abort(); };
    }, [active]);
    const remaining = report?.checks.filter(check => !check.ready) ?? [];
    const completed = report?.checks.filter(check => check.ready) ?? [];
    const checkCard = (check: Report["checks"][number]) => <li key={check.id} data-ready={check.ready}>
        <span className="store-readiness-state">{t(check.ready ? "Vérifié" : "À terminer")}</span>
        <h3>{t(check.label)}</h3><p className="admin-muted">{t(check.detail)}</p>
        {check.href && <a href={check.href}>{t("Ouvrir le réglage")}<span className="sr-only"> — {t(check.label)}</span></a>}
    </li>;
    return <section id="store-readiness" className="store-readiness" aria-labelledby="store-readiness-title" aria-busy={busy} tabIndex={-1}>
        <div className="store-readiness-heading">
            <div><h2 id="store-readiness-title">{t("Préparation de la boutique")}</h2>
                <p className="admin-muted">{t("Un bilan en lecture seule. Aucun réglage ni envoi n’est modifié.")}</p></div>
            <button type="button" className="admin-compact-button" disabled={busy} onClick={() => void load()}>{t("Actualiser le bilan")}</button>
        </div>
        {error && <p role="alert">{t("Bilan non actualisé. Rechargez le contrôle ; aucune validation n’a été ajoutée.")}</p>}
        {!report && !error && <p role="status">{t("Contrôle de la préparation…")}</p>}
        {report && <>
            <p className="admin-muted">{report.completed} / {report.total} {t("contrôles satisfaits")} · {t("Lecture du bilan")} : <time dateTime={report.checkedAt} title={t("Heure du Maroc")}>{report.checkedAtText[locale]}</time></p>
            {remaining.length > 0 ? <ul className="store-readiness-list" aria-label={t("Points à terminer")}>{remaining.map(checkCard)}</ul>
                : <p role="status">{t("Aucune action indiquée par ce bilan.")}</p>}
            {completed.length > 0 && <details className="store-readiness-completed">
                <summary>{t("Contrôles satisfaits ({count})", { count: completed.length })}</summary>
                <ul className="store-readiness-list" aria-label={t("Contrôles satisfaits")}>{completed.map(checkCard)}</ul>
            </details>}
            <p className="admin-muted">{t("Ce bilan n’est pas une certification juridique ni une preuve de réception des e-mails.")}</p>
        </>}
    </section>;
}
