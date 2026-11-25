"use client";
import { BrandName } from "@/components/BrandingProvider";
import type { CashSession } from "@/lib/pos-cash-api";
import { useAdminLocale } from "./admin-locale";
import { posMoney } from "./pos-receipt";
export function CashSessionReport({ session: s }: { session: CashSession }) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar";
  const when = (date: string) =>
    new Date(date).toLocaleString(ar ? "ar-MA" : "fr-MA", { timeZone: "Africa/Casablanca" });
  return (
    <article
      className="pos-ticket pos-cash-report"
      aria-label={t("Récapitulatif de caisse")}
      dir={ar ? "rtl" : "ltr"}
    >
      <header>
        <p className="pos-ticket-brand"><BrandName original="IMAD MODE" /></p>
        <h1>{t(s.closing ? "Clôture de caisse" : "Session de caisse ouverte")}</h1>
        <code dir="ltr">{s.reference}</code>
        <p>
          {t("Caissier")} : {s.cashierName}
        </p>
        <p>
          {t("Ouverte le")} : {when(s.openedAt)}
        </p>
        {s.closing && (
          <p>
            {t("Clôturée le")} : {when(s.closing.closedAt)}
          </p>
        )}
      </header>
      <dl>
        <div>
          <dt>{t("Fond d’ouverture")}</dt>
          <dd>{posMoney(s.openingCents, ar)}</dd>
        </div>
        <div>
          <dt>
            {t("Ventes en espèces")} ({s.cashCount})
          </dt>
          <dd>{posMoney(s.cashCents, ar)}</dd>
        </div>
        <div>
          <dt>
            {t("Ventes par carte — TPE externe")} ({s.cardCount})
          </dt>
          <dd>{posMoney(s.cardCents, ar)}</dd>
        </div>
        {!!s.adjustmentCount && (
          <>
            <div>
              <dt>{t("Retours et échanges — espèces")}</dt>
              <dd>{posMoney(s.adjustmentCents ?? 0, ar)}</dd>
            </div>
            <div>
              <dt>{t("Compléments d’échange par TPE")}</dt>
              <dd>{posMoney(s.cardAdjustmentCents ?? 0, ar)}</dd>
            </div>
          </>
        )}
        <div className="pos-ticket-total">
          <dt>{t("Espèces attendues")}</dt>
          <dd>{posMoney(s.expectedCents, ar)}</dd>
        </div>
        {s.closing && (
          <>
            <div>
              <dt>{t("Espèces comptées")}</dt>
              <dd>{posMoney(s.closing.countedCents, ar)}</dd>
            </div>
            <div>
              <dt>{t("Écart de caisse")}</dt>
              <dd>{posMoney(s.closing.differenceCents, ar)}</dd>
            </div>
          </>
        )}
      </dl>
      {s.closing?.note && (
        <p className="pos-cash-note">
          {t("Note de clôture")} : {s.closing.note}
        </p>
      )}
      <footer>
        {t(
          "Espèces attendues = fond + ventes + échanges en espèces − remboursements, après monnaie rendue.",
        )}
      </footer>
    </article>
  );
}
