"use client";
import { useSyncExternalStore } from "react";
import { presentationSessionKey } from "../../../admin-access";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCashSession } from "@/lib/pos-cash-api";
import { CashSessionReport } from "../../../pos-cash-report";
import { useAdminLocale, AdminLanguageSelect } from "../../../admin-locale";
import "../../../pos.css";
const subscribe = (changed: () => void) => {
  window.addEventListener("storage", changed);
  window.addEventListener("imad:session-expired", changed);
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener("imad:session-expired", changed);
  };
};
const snapshot = () => {
  try {
    return presentationSessionKey(localStorage.getItem("adminToken"));
  } catch {
    return null;
  }
};
export default function CashSessionPage() {
  const { id } = useParams<{ id: string }>(),
    { t, locale } = useAdminLocale();
  const session = useSyncExternalStore(subscribe, snapshot, () => null);
  const query = useQuery({
    queryKey: ["pos-cash-report", session, id],
    queryFn: ({ signal }) => getCashSession(id, signal),
    retry: false,
    enabled: !!session,
    refetchInterval: 15000,
  });
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="pos-print-page">
      <nav className="pos-no-print">
        <Link href="/admin?tab=pos">{t("Retour à la caisse")}</Link>
        <AdminLanguageSelect />
        {session && !query.isError && query.data && (
          <button type="button" onClick={() => window.print()}>
            {t("Imprimer / PDF")}
          </button>
        )}
      </nav>
      {!session ? (
        <p role="alert">{t("Connectez-vous à l’administration pour consulter cette session.")}</p>
      ) : query.isPending ? (
        <p role="status">{t("Chargement de la session…")}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{t("Session de caisse indisponible. Réessayez.")}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {t("Réessayer")}
          </button>
        </div>
      ) : (
        <CashSessionReport session={query.data} />
      )}
    </main>
  );
}
