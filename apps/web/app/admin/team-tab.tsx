"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminPermissions } from "@imad-store/shared";
import { isAxiosError } from "axios";
import { createTeamUser, updateTeamUser, inviteTeamUser, listTeamUsers, type TeamUser } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
export const permissionLabels: Record<string, string> = {
    "pos.sell": "Encaisser et consulter ses ventes magasin", "pos.read": "Consulter les ventes de tous les caissiers",
    "orders.read": "Consulter les commandes et leurs historiques", "orders.write": "Gérer les statuts et la corbeille des commandes",
    "orders.export": "Exporter les commandes", "catalogue.manage": "Gérer les produits, catégories, photos et stocks",
    "analytics.read": "Consulter les statistiques", "content.manage": "Modifier et publier le contenu du site",
    "settings.manage": "Gérer les réglages, la livraison et le Pixel", "crm.manage": "Gérer la connexion CRM",
};
const empty = { email: "", firstName: "", lastName: "", role: "STAFF", permissions: ["orders.read"], isActive: true };
export default function TeamTab() {
    const { t } = useAdminLocale();
    const [page, setPage] = useState(1), [selected, setSelected] = useState<TeamUser | null>(null);
    const [form, setForm] = useState({ ...empty }), [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
    const lock = useRef(false);
    const query = useQuery({ queryKey: ["admin-team", page], queryFn: ({ signal }) => listTeamUsers(page, signal), retry: false, refetchInterval: 15000 });
    function edit(user: TeamUser | null) {
        if (busy) return;
        if (password && !window.confirm(t("Abandonner les changements non enregistrés ?"))) return;
        setSelected(user); setForm(user ? { email: user.email, firstName: user.firstName, lastName: user.lastName,
            role: user.role, permissions: user.permissions, isActive: user.isActive } : { ...empty });
        setPassword(""); setError(""); setMessage("");
    }
    function toggle(permission: string) {
        const next = new Set(form.permissions);
        if (next.has(permission)) { next.delete(permission); if (permission === "orders.read") { next.delete("orders.write"); next.delete("orders.export"); } }
        else { next.add(permission); if (["orders.write", "orders.export"].includes(permission)) next.add("orders.read"); }
        setForm({ ...form, permissions: [...next] });
    }
    async function action(invite = false) {
        if (lock.current || uncertain) return;
        if (selected && !invite && !window.confirm(t("Confirmer ces accès ? Les sessions de ce compte seront fermées."))) return;
        lock.current = true; setBusy(true); setError(""); setMessage("");
        try {
            if (invite && selected) await inviteTeamUser(selected.id, password);
            else if (selected) await updateTeamUser(selected.id, { firstName: form.firstName, lastName: form.lastName,
                role: form.role, permissions: form.permissions, isActive: form.isActive, currentPassword: password });
            else await createTeamUser({ email: form.email, firstName: form.firstName, lastName: form.lastName, role: form.role,
                permissions: form.permissions, currentPassword: password });
            setMessage(invite || !selected ? "Invitation préparée. L’envoi se fait dans les prochaines secondes." : "Accès mis à jour. Les anciennes sessions sont fermées.");
            if (!invite) { setSelected(null); setForm({ ...empty }); }
            await query.refetch();
        } catch (e) {
            setError(isAxiosError(e) && typeof e.response?.data?.error === "string" ? e.response.data.error : "Enregistrement incertain. Rechargez l’équipe avant de réessayer.");
            if (!isAxiosError(e) || !e.response) setUncertain(true);
        } finally { lock.current = false; setBusy(false); setPassword(""); }
    }
    return <div className="team-grid">
        <section className="admin-panel">
            <h2>{t("Les utilisateurs de la boutique")}</h2>
            <p className="admin-scope">{t("Chaque personne utilise son propre compte. Seuls les administrateurs gèrent l’équipe et Gmail SMTP.")}</p>
            {(query.isError || uncertain) && <p className="admin-alert" role="alert">{t("Rechargez l’équipe avant de continuer.")}</p>}
            <button className="admin-button" disabled={busy || query.isFetching} onClick={async () => { const r = await query.refetch(); if (!r.error) setUncertain(false); }}>{t("Recharger l’équipe")}</button>
            {query.isPending ? <p role="status">{t("Chargement…")}</p> : !query.isError && query.data && <>
                <ul className="team-user-list">{query.data.data.map(user => <li key={user.id}>
                    <strong>{user.firstName} {user.lastName}</strong><span><bdi>{user.email}</bdi></span>
                    <span>{t(user.role === "ADMIN" ? "Administrateur" : "Collaborateur")} · {t(!user.isActive ? "Désactivé" : user.mustSetPassword ? "Invitation en attente" : "Actif")}</span>
                    {user.mailState && <span className={user.mailState === "FAILED" ? "admin-alert" : "admin-scope"}>{t(user.mailState === "SENT" ? "E-mail transmis" : user.mailState === "FAILED" ? "Envoi non confirmé. Vérifiez Gmail SMTP avant un nouvel envoi." : user.mailState === "EXPIRED" ? "Lien expiré. Envoyez un nouveau lien." : "E-mail en file d’attente")}</span>}
                    {user.id === query.data.currentUserId ? <span>{t("Votre compte")}</span> : <button className="admin-text-button" disabled={busy || uncertain} onClick={() => edit(user)}>{t("Modifier les accès")}</button>}
                </li>)}</ul>
                {query.data.totalPages > 1 && <nav className="team-actions" aria-label={t("Pages de l’équipe")}>
                    <button className="admin-button" disabled={busy || query.data.page <= 1} onClick={() => setPage(query.data!.page - 1)}>{t("Page précédente")}</button>
                    <span>{t("Page {page} sur {total}", { page: query.data.page, total: query.data.totalPages })}</span>
                    <button className="admin-button" disabled={busy || query.data.page >= query.data.totalPages} onClick={() => setPage(query.data!.page + 1)}>{t("Page suivante")}</button>
                </nav>}
            </>}
        </section>
        <section className="admin-panel">
            <h2>{t(selected ? "Modifier les accès" : "Ajouter un utilisateur")}</h2>
            <p className="admin-scope">{t("Configurez Gmail SMTP avant la première invitation. Le destinataire choisira lui-même son mot de passe.")}</p>
            <form className="team-settings-form" onSubmit={e => { e.preventDefault(); void action(); }}>
                <fieldset disabled={busy || uncertain || query.isError || query.isPending}>
                    <label>{t("Prénom")}<input value={form.firstName} required maxLength={80} onChange={e => setForm({ ...form, firstName: e.target.value })} /></label>
                    <label>{t("Nom")}<input value={form.lastName} maxLength={80} onChange={e => setForm({ ...form, lastName: e.target.value })} /></label>
                    <label>{t("Adresse e-mail")}<input type="email" required maxLength={254} disabled={!!selected} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                    <label>{t("Rôle")}<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="STAFF">{t("Collaborateur")}</option><option value="ADMIN">{t("Administrateur")}</option></select></label>
                    {form.role === "ADMIN" ? <p className="admin-alert">{t("Accès complet, y compris aux utilisateurs et aux réglages SMTP.")}</p> : <fieldset className="team-permissions"><legend>{t("Permissions")}</legend>
                        {adminPermissions.map(permission => <label className="team-check" key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => toggle(permission)} />{t(permissionLabels[permission])}</label>)}
                    </fieldset>}
                    {selected && <label className="team-check"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />{t("Compte actif")}</label>}
                    <label>{t("Votre mot de passe actuel pour confirmer")}<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
                    {error && <p className="admin-alert" role="alert">{t(error)}</p>}
                    {message && <p className="admin-feedback" role="status">{t(message)}</p>}
                    <div className="team-actions"><button className="admin-button primary">{t(busy ? "Enregistrement…" : selected ? "Enregistrer les accès" : "Créer et inviter")}</button>
                        {selected && <><button type="button" className="admin-button" disabled={!form.isActive || !password} onClick={() => void action(true)}>{t("Envoyer un nouveau lien")}</button><button type="button" className="admin-text-button" onClick={() => edit(null)}>{t("Ajouter un autre utilisateur")}</button></>}
                    </div>
                </fieldset>
            </form>
        </section>
    </div>;
}
