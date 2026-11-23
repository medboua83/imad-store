"use client";
import type { PosReceipt } from "@/lib/pos-api";
import { useAdminLocale } from "./admin-locale";
export const posMoney = (cents: number, ar = false) =>
  new Intl.NumberFormat(ar ? "ar-MA" : "fr-MA", { style: "currency", currency: "MAD" }).format(
    cents / 100,
  );
export function PosTicket({ sale }: { sale: PosReceipt }) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar";
  return (
    <article dir={ar ? "rtl" : "ltr"} className="pos-ticket" aria-label={t("Ticket de caisse")}>
      <header>
        <p className="pos-ticket-brand">IMAD MODE</p>
        <h1>{t("Reçu de vente")}</h1>
        <p>{t("Vente emportée")}</p>
        <p>
          <time dateTime={sale.createdAt}>
            {new Date(sale.createdAt).toLocaleString(ar ? "ar-MA" : "fr-MA", {
              timeZone: "Africa/Casablanca",
            })}
          </time>
        </p>
        <p>
          {t("Caissier")} : {sale.cashierName}
        </p>
        <code dir="ltr">{sale.reference}</code>
      </header>
      <table>
        <thead>
          <tr>
            <th>{t("Article")}</th>
            <th>{t("Qté")}</th>
            <th>{t("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((line, i) => (
            <tr key={i}>
              <td>
                <strong>{(ar ? line.nameAr : line.nameFr) || line.nameFr}</strong>
                <small>
                  {[ar ? line.colorAr : line.colorFr, line.size].filter(Boolean).join(" · ")}
                </small>
                <small dir="ltr">{line.sku}</small>
              </td>
              <td>{line.quantity}</td>
              <td>{posMoney(line.totalCents, ar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        {sale.savingsCents > 0 && (
          <div>
            <dt>{t("Remises par quantité")}</dt>
            <dd>−{posMoney(sale.savingsCents, ar)}</dd>
          </div>
        )}
        <div className="pos-ticket-total">
          <dt>{t("Total encaissé")}</dt>
          <dd>{posMoney(sale.totalCents, ar)}</dd>
        </div>
        <div>
          <dt>{t("Paiement")}</dt>
          <dd>{t(sale.paymentMethod === "CASH" ? "Espèces" : "Carte — TPE externe")}</dd>
        </div>
        {sale.paymentMethod === "CASH" && (
          <>
            <div>
              <dt>{t("Montant reçu")}</dt>
              <dd>{posMoney(sale.receivedCents, ar)}</dd>
            </div>
            <div>
              <dt>{t("Monnaie rendue")}</dt>
              <dd>{posMoney(sale.changeCents, ar)}</dd>
            </div>
          </>
        )}
      </dl>
      <footer>{t("Merci pour votre achat.")}</footer>
    </article>
  );
}
