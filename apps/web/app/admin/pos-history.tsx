"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listPosSales } from "@/lib/pos-api";
import { useAdminLocale } from "./admin-locale";
import { posMoney } from "./pos-receipt";
const emptyFilters = { search: "", cashier: "", from: "", to: "", paymentMethod: "" };
export function PosHistoryPanel({ canReadAll }: { canReadAll: boolean }) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar";
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters),
    [page, setPage] = useState(1),
    [periodError, setPeriodError] = useState(false);
  const query = useQuery({
    queryKey: ["pos-history", filters, page],
    queryFn: ({ signal }) =>
      listPosSales(filters.search, filters.cashier, page, signal, {
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      }),
    retry: false,
    refetchInterval: 15000,
  });
  const change = (field: keyof typeof emptyFilters, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setPeriodError(false);
  };
  const data = query.data;
  return (
    <section className="admin-panel pos-history">
      <header className="pos-section-heading">
        <div>
          <h2>{t("Ventes magasin")}</h2>
          <p>{t("Tickets encaissés, distincts des commandes à livrer.")}</p>
        </div>
        <button
          type="button"
          className="admin-button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t("Actualiser")}
        </button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.from && draft.to && draft.from > draft.to) {
            setPeriodError(true);
            return;
          }
          setPeriodError(false);
          setFilters({
            ...draft,
            search: draft.search.trim(),
            cashier: canReadAll ? draft.cashier : "",
          });
          setPage(1);
        }}
      >
        <div className="pos-filters">
          <label>
            {t("Référence du ticket")}
            <input
              value={draft.search}
              onChange={(e) => change("search", e.target.value)}
              placeholder="POS-…"
              maxLength={32}
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
            />
          </label>
          <label>
            {t("Mode de paiement")}
            <select
              value={draft.paymentMethod}
              onChange={(e) => change("paymentMethod", e.target.value)}
            >
              <option value="">{t("Tous les paiements")}</option>
              <option value="CASH">{t("Espèces")}</option>
              <option value="CARD_TERMINAL">{t("Carte — TPE externe")}</option>
            </select>
          </label>
          {canReadAll && (
            <label>
              {t("Caissier")}
              <select value={draft.cashier} onChange={(e) => change("cashier", e.target.value)}>
                <option value="">{t("Tous les caissiers")}</option>
                {(data?.cashiers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("Du")}
            <input
              type="date"
              value={draft.from}
              onChange={(e) => change("from", e.target.value)}
              aria-invalid={periodError || undefined}
              aria-describedby={periodError ? "pos-history-period-error" : undefined}
            />
          </label>
          <label>
            {t("Au")}
            <input
              type="date"
              value={draft.to}
              onChange={(e) => change("to", e.target.value)}
              aria-invalid={periodError || undefined}
              aria-describedby={periodError ? "pos-history-period-error" : undefined}
            />
          </label>
        </div>
        {periodError && (
          <p className="admin-alert" id="pos-history-period-error" role="alert">
            {t("La date de fin doit suivre la date de début.")}
          </p>
        )}
        <div className="pos-history-actions">
          <button type="submit" className="admin-button admin-button-primary">
            {t("Appliquer les filtres")}
          </button>
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters(emptyFilters);
              setPage(1);
              setPeriodError(false);
            }}
          >
            {t("Réinitialiser les filtres")}
          </button>
          <span>{t("Dates selon l’heure du Maroc.")}</span>
        </div>
      </form>
      {query.isError ? (
        <div className="admin-alert" role="alert">
          {t("Historique de caisse indisponible. Réessayez.")}
        </div>
      ) : query.isPending ? (
        <p role="status">{t("Chargement des ventes…")}</p>
      ) : (
        data && (
          <>
            <p className="pos-history-count" role="status">
              {t("{count} vente(s)", { count: data.total })}
            </p>
            <p className="pos-summary">
              {t("Aujourd’hui, dans cette vue")} :{" "}
              <strong>
                {data.today.count} · {posMoney(data.today.totalCents, ar)}
              </strong>
            </p>
            {data.scope === "OWN" && (
              <p className="admin-scope">{t("Vous consultez uniquement vos encaissements.")}</p>
            )}
            <ul className="pos-sales-list">
              {data.data.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong className="pos-history-reference">
                      <bdi dir="ltr">POS-{s.id.toUpperCase()}</bdi>
                    </strong>
                    <p>
                      {s.cashierName} ·{" "}
                      {new Date(s.createdAt).toLocaleString(ar ? "ar-MA" : "fr-MA", {
                        timeZone: "Africa/Casablanca",
                      })}
                    </p>
                    <span>{t(s.paymentMethod === "CASH" ? "Espèces" : "Carte — TPE externe")}</span>
                  </div>
                  <div>
                    <strong>{posMoney(s.totalCents, ar)}</strong>
                    <Link
                      className="admin-button"
                      href={`/admin/pos/receipt/${s.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      {t("Voir le ticket")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {!data.data.length && (
              <p className="admin-empty">{t("Aucune vente dans cette vue.")}</p>
            )}
            {data.totalPages > 1 && (
              <nav
                className="admin-inventory-pages"
                aria-label={t("Navigation des ventes magasin")}
              >
                <button
                  type="button"
                  className="admin-button"
                  disabled={data.page <= 1 || query.isFetching}
                  onClick={() => setPage(data.page - 1)}
                >
                  {t("Page précédente")}
                </button>
                <span>
                  {t("Page {page} sur {total}", { page: data.page, total: data.totalPages })}
                </span>
                <button
                  type="button"
                  className="admin-button"
                  disabled={data.page >= data.totalPages || query.isFetching}
                  onClick={() => setPage(data.page + 1)}
                >
                  {t("Page suivante")}
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}
