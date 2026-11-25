"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { brandForeground, defaultStoreBranding, type StoreBranding } from "@imad-store/shared";
import { getBranding, saveBranding, uploadProductImage, type BrandingSnapshot, type StoreSettings } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import "./branding-settings.css";

export function BrandingSettings() {
    const { t } = useAdminLocale();
    const cache = useQueryClient(), router = useRouter();
    const [snapshot, setSnapshot] = useState<BrandingSnapshot | null>(null);
    const [form, setForm] = useState<StoreBranding>(defaultStoreBranding);
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
    const [conflict, setConflict] = useState(false);
    const lock = useRef(false);
    const dirty = snapshot !== null && JSON.stringify(form) !== JSON.stringify(snapshot.branding);
    useEffect(() => {
        if (!dirty && !busy) return;
        const protect = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty, busy]);
    async function load() {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(""); setMessage("");
        try { const next = await getBranding(); setSnapshot(next); setForm(next.branding); setConflict(false); }
        catch { setError("Impossible de charger l’identité. Réessayez."); }
        finally { lock.current = false; setBusy(false); }
    }
    useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, []);
    const change = <K extends keyof StoreBranding>(key: K, value: StoreBranding[K]) => {
        setForm(prev => ({ ...prev, [key]: value })); setMessage("");
    };
    function accepted(next: BrandingSnapshot) {
        setSnapshot(next); setForm(next.branding); setConflict(false);
        cache.setQueryData<StoreSettings>(["store-settings"], old => old ? { ...old, branding: next.branding } : undefined);
        void cache.invalidateQueries({ queryKey: ["store-settings"] });
        router.refresh();
        setMessage("Identité enregistrée et publiée. Les autres réglages sont conservés.");
    }
    async function save() {
        if (lock.current || !snapshot || conflict) return;
        lock.current = true; setBusy(true); setError(""); setMessage("");
        const branding = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as unknown as StoreBranding;
        const attempt = { revision: snapshot.revision, branding };
        try { accepted(await saveBranding(attempt)); }
        catch (e) {
            // A lost response must never encourage an overwrite of a concurrent merchant edit.
            try {
                const actual = await getBranding();
                if (actual.revision === attempt.revision + 1 && JSON.stringify(actual.branding) === JSON.stringify(attempt.branding)) {
                    accepted(actual); return;
                }
                setConflict(actual.revision !== attempt.revision);
            } catch { /* Keep the submitted values and revision for a safe retry. */ }
            setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ||
                "Enregistrement non confirmé. Vos modifications restent affichées. Réessayez ou rechargez les valeurs enregistrées.");
        } finally { lock.current = false; setBusy(false); }
    }
    async function upload(key: "logoUrl" | "darkLogoUrl", file?: File) {
        if (!file || lock.current) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setError("Choisissez une image PNG, JPEG ou WebP (5 Mo maximum)."); return;
        }
        lock.current = true; setBusy(true); setError(""); setMessage("");
        try { change(key, await uploadProductImage(file)); }
        catch { setError("Import du logo impossible. Vos modifications restent affichées."); }
        finally { lock.current = false; setBusy(false); }
    }
    return <section id="branding-settings" className="admin-branding-settings" tabIndex={-1} aria-labelledby="branding-settings-title">
        <h2 id="branding-settings-title">{t("Identité de la boutique")}</h2>
        <p>{t("Personnalisez le nom, les logos, les couleurs et les coordonnées. L’aperçu reste privé jusqu’à l’enregistrement.")}</p>
        {error && <p role="alert" className="admin-alert">{t(error)}</p>}
        {message && <p role="status" className="admin-branding-success">{t(message)}</p>}
        {!snapshot ? <button className="admin-button" disabled={busy} onClick={() => void load()}>
            {t(busy ? "Chargement de l’identité…" : "Recharger l’identité")}</button> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
            <fieldset disabled={busy}>
                <legend>{t("Nom et logos")}</legend>
                <label>{t("Nom de la boutique")}<input required maxLength={120} value={form.name} dir="auto" onChange={e => change("name", e.target.value)} /></label>
                <p>{t("Le nom apparaît dans la boutique, le dashboard et les nouveaux e-mails d’accès. Il ne remplace pas l’identité juridique dans vos conditions.")}</p>
                <div className="admin-branding-grid">{(["logoUrl", "darkLogoUrl"] as const).map(key => <div key={key} className="admin-branding-logo-field">
                    <label>{t(key === "logoUrl" ? "Logo sur fond clair" : "Logo sur fond sombre (facultatif)")}
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void upload(key, file); }} /></label>
                    {form[key] && <><img src={form[key]} alt={t("Aperçu du logo")} className={key === "darkLogoUrl" ? "on-dark" : ""} />
                        <button type="button" className="admin-button secondary" onClick={() => change(key, "")}>{t("Retirer ce logo")}</button></>}
                </div>)}</div>
                <p>{t("PNG, JPEG ou WebP, 5 Mo maximum. Le logo est affiché en entier, sans recadrage. Sans logo, le nom est utilisé ; l’identité IMAD Mode conserve son logo actuel.")}</p>
            </fieldset>
            <fieldset disabled={busy}>
                <legend>{t("Couleurs de la boutique")}</legend>
                <div className="admin-branding-grid">{([
                    ["primaryColor", "Couleur principale"], ["accentColor", "Couleur d’accent"], ["backgroundColor", "Fond de la boutique"],
                ] as const).map(([key, label]) => <label key={key}>{t(label)}
                    <input type="color" aria-label={t(label)} value={form[key]} onChange={e => change(key, e.target.value)} />
                    <span dir="ltr">{form[key]}</span>
                </label>)}</div>
                <p>{t("Les couleurs des statuts et des alertes restent distinctes. Le texte des boutons s’adapte pour rester lisible.")}</p>
            </fieldset>
            <fieldset disabled={busy}>
                <legend>{t("Coordonnées publiques")}</legend>
                <div className="admin-branding-grid">
                    <label>{t("E-mail de contact")}<input type="email" maxLength={254} dir="ltr" value={form.contactEmail} onChange={e => change("contactEmail", e.target.value.trim())} /></label>
                    <label>{t("Téléphone de contact")}<input type="tel" maxLength={40} dir="ltr" value={form.contactPhone} onChange={e => change("contactPhone", e.target.value)} /></label>
                </div>
                <label>{t("Adresse publique")}<textarea maxLength={1000} rows={3} dir="auto" value={form.contactAddress} onChange={e => change("contactAddress", e.target.value)} /></label>
                <p>{t("Ces coordonnées apparaissent sur Contact et dans le pied de page. Un champ vide est masqué. L’e-mail public ne configure pas Gmail SMTP ; WhatsApp reste dans la rubrique suivante.")}</p>
            </fieldset>
            <section className="admin-branding-preview" aria-label={t("Aperçu privé de l’identité")} style={{ background: form.backgroundColor, color: brandForeground(form.backgroundColor) }}>
                <h3>{t("Aperçu privé de l’identité")}</h3>
                <div className="admin-branding-preview-header">{form.logoUrl ? <img src={form.logoUrl} alt={form.name} /> : <strong dir="auto">{form.name}</strong>}</div>
                <p dir="auto">{form.name}</p>
                <span className="admin-branding-preview-button" style={{ background: form.primaryColor, color: brandForeground(form.primaryColor) }}>{t("Découvrir la boutique")}</span>
                <div className="admin-branding-preview-dark" style={{ background: form.primaryColor, color: brandForeground(form.primaryColor) }}>
                    {form.darkLogoUrl || form.logoUrl ? <img src={form.darkLogoUrl || form.logoUrl} alt={form.name} /> : <strong dir="auto">{form.name}</strong>}
                    <span className="admin-branding-preview-button" style={{ background: form.accentColor, color: brandForeground(form.accentColor) }}>{t("Découvrir un produit")}</span>
                </div>
            </section>
            {dirty && <p role="status">{t("Modifications non enregistrées")}</p>}
            <div className="admin-branding-actions">
                <button className="admin-button primary" type="submit" disabled={busy || !dirty || conflict}>{t(busy ? "Enregistrement…" : "Enregistrer et publier l’identité")}</button>
                <button className="admin-button secondary" type="button" disabled={busy} onClick={() => { setForm(snapshot.branding); setMessage(""); setError(""); }}>{t("Annuler mes modifications")}</button>
                {(conflict || error) && <button className="admin-button secondary" type="button" disabled={busy} onClick={() => void load()}>{t("Recharger les valeurs enregistrées")}</button>}
            </div>
        </form>}
    </section>;
}
