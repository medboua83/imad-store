"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listPosSales } from "@/lib/pos-api";
import { useAdminLocale } from "./admin-locale";
import { posMoney } from "./pos-receipt";
export function PosHistoryPanel() {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar";
  const [search, setSearch] = useState(""),
    [cashier, setCashier] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["pos-history", search, cashier, page],
    queryFn: ({ signal }) => listPosSales(search, cashier, page, signal),
    retry: false,
    refetchInterval: 15000,
  });
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
      <div className="pos-filters">
        <label>
          {t("Référence du ticket")}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="POS-…"
            maxLength={32}
          />
        </label>
        {data?.scope === "ALL" && (
          <label>
            {t("Caissier")}
            <select
              value={cashier}
              onChange={(e) => {
                setCashier(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("Tous les caissiers")}</option>
              {data.cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {query.isError ? (
        <div className="admin-alert" role="alert">
          {t("Historique de caisse indisponible. Réessayez.")}
        </div>
      ) : query.isPending ? (
        <p role="status">{t("Chargement des ventes…")}</p>
      ) : (
        data && (
          <>
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
                    <strong>#{s.id.slice(-8).toUpperCase()}</strong>
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
