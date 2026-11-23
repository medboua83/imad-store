"use client";
import type { ReturnReceipt } from "@/lib/pos-returns-api";
import { useAdminLocale } from "./admin-locale";
import { posMoney } from "./pos-receipt";
export function ReturnTicket({ receipt: r }: { receipt: ReturnReceipt }) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar";
  return (
    <article
      className="pos-ticket"
      dir={ar ? "rtl" : "ltr"}
      aria-label={t("Reçu de retour ou échange")}
    >
      <header>
        <p className="pos-ticket-brand">IMAD MODE</p>
        <h2>{t(r.replacementCents ? "Échange enregistré" : "Retour enregistré")}</h2>
        <code dir="ltr">{r.reference}</code>
        <p>
          {new Date(r.createdAt).toLocaleString(ar ? "ar-MA" : "fr-MA", {
            timeZone: "Africa/Casablanca",
          })}
        </p>
        <p>
          {t("Caissier")} : {r.cashierName}
        </p>
        <p>
          {t("Ticket d’origine")} :{" "}
          <code dir="ltr">
            {(r.sourceSaleId ? "POS-" : "RET-") +
              (r.sourceSaleId ?? r.sourceAdjustmentId)?.toUpperCase()}
          </code>
        </p>
      </header>
      {(["RETURN", "REPLACEMENT"] as const).map((kind) => (
        <section key={kind}>
          <h3>{t(kind === "RETURN" ? "Articles retournés" : "Articles de remplacement")}</h3>
          {r.items
            .filter((i) => i.kind === kind)
            .map((i) => (
              <div key={i.id} className="pos-return-ticket-line">
                <strong>{ar ? i.nameAr : i.nameFr}</strong>
                <p>
                  {ar ? i.colorAr : i.colorFr} · {i.size} · {t("Quantité")} : {i.quantity}
                </p>
                <p>{posMoney(i.totalCents, ar)}</p>
                {kind === "RETURN" && (
                  <p>{t(i.restock ? "Remis en stock" : "Non remis en stock")}</p>
                )}
              </div>
            ))}
        </section>
      ))}
      <dl>
        <div>
          <dt>{t("Valeur du retour")}</dt>
          <dd>{posMoney(r.returnCents, ar)}</dd>
        </div>
        <div>
          <dt>{t("Nouveaux articles")}</dt>
          <dd>{posMoney(r.replacementCents, ar)}</dd>
        </div>
        <div className="pos-ticket-total">
          <dt>
            {t(
              r.netCents < 0
                ? "Remboursement en espèces"
                : r.netCents > 0
                  ? "Différence encaissée"
                  : "Aucun mouvement d’argent",
            )}
          </dt>
          <dd>{posMoney(Math.abs(r.netCents), ar)}</dd>
        </div>
        {r.netCents > 0 && (
          <>
            <div>
              <dt>{t(r.paymentMethod === "CASH" ? "Espèces reçues" : "Carte — TPE externe")}</dt>
              <dd>{posMoney(r.receivedCents, ar)}</dd>
            </div>
            <div>
              <dt>{t("Monnaie à rendre")}</dt>
              <dd>{posMoney(r.changeCents, ar)}</dd>
            </div>
          </>
        )}
      </dl>
      <p>{r.note}</p>
      <footer>
        {t("Conservez ce reçu pour tout prochain retour des articles de remplacement.")}
      </footer>
    </article>
  );
}
