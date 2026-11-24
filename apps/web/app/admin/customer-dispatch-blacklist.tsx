"use client";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { ADMIN_ORDERS_REFRESH_MS } from "@imad-store/shared";
import { getDispatchBlacklist } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { orderDate } from "./order-utils";

export function CustomerDispatchBlacklist({ onSearch }: { onSearch: (phone: string) => void }) {
    const { t, locale } = useAdminLocale();
    const [open, setOpen] = useState(false), [input, setInput] = useState("");
    const [criteria, setCriteria] = useState({ search: "", page: 1 });
    const result = useRef<HTMLParagraphElement>(null), focusPage = useRef(false);
    const query = useQuery({
        queryKey: ["admin-dispatch-blacklist", criteria],
        queryFn: ({ signal }) => getDispatchBlacklist(criteria.search, criteria.page, signal),
        enabled: open, retry: false, refetchInterval: open ? ADMIN_ORDERS_REFRESH_MS : false,
    });
    const data = query.data;
    useEffect(() => {
        if (query.isFetching || !focusPage.current) return;
        focusPage.current = false;
        result.current?.focus({ preventScroll: true });
    }, [query.isFetching, data?.page]);
    function page(next: number) {
        focusPage.current = true;
        setCriteria(previous => ({ ...previous, page: next }));
    }
    return <details className="dispatch-blacklist" onToggle={event => setOpen(event.currentTarget.open)}>
        <summary><ShieldAlert size={18} aria-hidden="true" />{t("Liste noire des numéros")}</summary>
        <div className="dispatch-blacklist-body">
            <h3>{t("Envoi Olivraison sur validation manuelle")}</h3>
            <p>{t("Une commande annulée suffit à placer le numéro dans cette liste. Les commandes restent possibles ; chaque nouvel envoi à Olivraison exige votre validation dans les détails de la commande.")}</p>
            <p className="admin-scope">{t("Historique complet de cette boutique, y compris les annulations conservées dans la corbeille. Les colis déjà créés ne sont ni annulés ni recréés.")}</p>
            <form className="dispatch-blacklist-search" onSubmit={event => { event.preventDefault(); setCriteria({ search: input.trim(), page: 1 }); }}>
                <label htmlFor="blacklist-phone">{t("Rechercher un numéro dans la liste noire")}
                    <input id="blacklist-phone" type="search" inputMode="tel" dir="ltr" value={input} maxLength={40}
                        pattern={"[+0-9\\s\\(\\).\\-]*"} placeholder="06… / +212…"
                        onChange={event => setInput(event.target.value)} />
                </label>
                <button className="admin-button" type="submit" disabled={query.isFetching}>{t("Rechercher")}</button>
                {criteria.search && <button className="admin-text-button" type="button" onClick={() => { setInput(""); setCriteria({ search: "", page: 1 }); }}>{t("Effacer la recherche")}</button>}
            </form>
            {query.isPending ? <p role="status">{t("Chargement de la liste noire…")}</p> : query.isError ? <div role="alert" className="admin-alert">
                <p>{t("Liste noire indisponible. Le contrôle serveur des envois reste actif.")}</p>
                <button type="button" className="admin-button" onClick={() => void query.refetch()} disabled={query.isFetching}>{t("Réessayer")}</button>
            </div> : data && <>
                <p role="status" ref={result} tabIndex={-1}>{t("{count} numéro(s) sur liste noire", { count: data.total })}</p>
                {data.total === 0 && <p>{t(criteria.search ? "Aucun numéro ne correspond à cette recherche." : "Aucun numéro associé à une commande annulée.")}</p>}
                <ul className="dispatch-blacklist-list">
                    {data.data.map(row => <li key={row.phone}>
                        <div className="dispatch-blacklist-row"><strong><bdi dir="ltr">{row.phone}</bdi></strong><span>{t("Envoi manuel")}</span></div>
                        <p>{t("{count} commande(s) annulée(s)", { count: row.cancelledCount })}</p>
                        {row.trashCount > 0 && <p className="admin-scope">{t("Dont {count} conservée(s) dans la corbeille", { count: row.trashCount })}</p>}
                        <p className="admin-scope"><bdi>#{row.lastOrderId.slice(-8).toUpperCase()}</bdi>{" · "}{orderDate(row.lastOrderCreatedAt, locale === "ar" ? "ar-MA" : "fr-MA")}</p>
                        <button type="button" className="admin-text-button" onClick={event => {
                            const details = event.currentTarget.closest("details");
                            if (details) details.open = false;
                            onSearch(row.phone);
                        }}>{t("Voir les commandes de ce numéro")}</button>
                    </li>)}
                </ul>
                {data.totalPages > 1 && <nav className="admin-inventory-pages" aria-label={t("Navigation de la liste noire")}>
                    <button type="button" className="admin-button" disabled={data.page <= 1 || query.isFetching} onClick={() => page(data.page - 1)}>{t("Page précédente")}</button>
                    <span>{t("Page {page} sur {total}", { page: data.page, total: data.totalPages })}</span>
                    <button type="button" className="admin-button" disabled={data.page >= data.totalPages || query.isFetching} onClick={() => page(data.page + 1)}>{t("Page suivante")}</button>
                </nav>}
            </>}
        </div>
    </details>;
}
