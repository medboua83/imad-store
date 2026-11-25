"use client";
import { readAdminPresentation } from "@/lib/admin-session";
import { restoreAdminSession } from "@/lib/api";
import { useEffect, useSyncExternalStore } from "react";
import { presentationSessionKey } from "../../../admin-access";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPosReceipt } from "@/lib/pos-api";
import { PosTicket } from "../../../pos-receipt";
import { useAdminLocale, AdminLanguageSelect } from "../../../admin-locale";
import "../../../pos.css";
const subscribe = (changed: () => void) => {
  window.addEventListener("storage", changed);
  window.addEventListener("imad:session-changed", changed);
  window.addEventListener("pageshow", changed);
  window.addEventListener("imad:session-expired", changed);
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener("imad:session-changed", changed);
    window.removeEventListener("pageshow", changed);
    window.removeEventListener("imad:session-expired", changed);
  };
};
const snapshot = () => {
  try {
    return presentationSessionKey(readAdminPresentation());
  } catch {
    return null;
  }
};
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>(),
    { t, locale } = useAdminLocale();
  const session = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => { void restoreAdminSession(); }, []);
  const query = useQuery({
    queryKey: ["pos-ticket", session, id],
    queryFn: ({ signal }) => getPosReceipt(id, signal),
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
        <p role="alert">{t("Connectez-vous à l’administration pour consulter ce ticket.")}</p>
      ) : query.isPending ? (
        <p role="status">{t("Chargement du ticket…")}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{t("Ticket indisponible. Vérifiez votre connexion à l’administration.")}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {t("Réessayer")}
          </button>
        </div>
      ) : (
        <PosTicket sale={query.data} />
      )}
    </main>
  );
}
