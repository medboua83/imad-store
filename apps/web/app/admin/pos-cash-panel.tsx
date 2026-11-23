"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Link from "next/link";
import {
  getCashState,
  listCashSessions,
  recoverCashAction,
  sendCashAction,
  type CashSession,
} from "@/lib/pos-cash-api";
import { useAdminLocale } from "./admin-locale";
import { cashInputCents, parsePosDraft } from "./pos-draft";
import {
  assertCashAction,
  cashAttemptKey,
  parseCashAttempt,
  type CashAttempt,
} from "./pos-cash-draft";
import { posMoney } from "./pos-receipt";
class CashUiError extends Error {}
const issue = (e: unknown) =>
  isAxiosError(e) && typeof e.response?.data?.error === "string"
    ? e.response.data.error
    : e instanceof CashUiError
      ? e.message || "Opération de caisse non confirmée. Vérifiez son état."
      : "Opération de caisse non confirmée. Vérifiez son état.";
export function PosCashPanel({ actorId, canSell }: { actorId: string; canSell: boolean }) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar",
    cache = useQueryClient(),
    lock = useRef(false),
    storageKey = cashAttemptKey(actorId);
  const [opening, setOpening] = useState("0"),
    [counted, setCounted] = useState(""),
    [note, setNote] = useState(""),
    [preview, setPreview] = useState<CashSession | null>(null),
    [pending, setPending] = useState<CashAttempt | null>(null),
    [loaded, setLoaded] = useState(false),
    [storageError, setStorageError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const cash = useQuery({
    queryKey: ["pos-cash-state", actorId],
    queryFn: ({ signal }) => getCashState(signal),
    enabled: canSell,
    retry: false,
    refetchInterval: 15000,
  });
  const history = useQuery({
    queryKey: ["pos-cash-history", actorId, page],
    queryFn: ({ signal }) => listCashSessions(page, signal),
    retry: false,
    refetchInterval: 15000,
  });
  useEffect(() => {
    const read = () => {
      try {
        setPending(parseCashAttempt(localStorage.getItem(storageKey)));
        setStorageError("");
      } catch {
        setStorageError(
          "L’opération de caisse conservée est illisible. Vérifiez les sessions avant de poursuivre.",
        );
      }
      setLoaded(true);
    };
    const timer = setTimeout(read, 0);
    window.addEventListener("storage", read);
    window.addEventListener("imad:cash-operation", read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", read);
      window.removeEventListener("imad:cash-operation", read);
    };
  }, [storageKey]);
  function keep(p: CashAttempt | null) {
    try {
      if (p) {
        const raw = JSON.stringify(p);
        localStorage.setItem(storageKey, raw);
        if (localStorage.getItem(storageKey) !== raw) throw new CashUiError();
      } else {
        localStorage.removeItem(storageKey);
        if (localStorage.getItem(storageKey) !== null) throw new CashUiError();
      }
    } catch {
      throw new CashUiError(
        "Impossible de conserver l’opération de caisse. Vérifiez le stockage du navigateur.",
      );
    }
    setPending(p);
    window.dispatchEvent(new Event("imad:cash-operation"));
  }
  async function confirmed(s: CashSession, p: CashAttempt) {
    assertCashAction(s, p, actorId);
    keep(null);
    setPreview(null);
    setCounted("");
    setNote("");
    setOpening("0");
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["pos-cash-state", actorId] }),
      cache.invalidateQueries({ queryKey: ["pos-cash-history", actorId] }),
    ]);
  }
  async function run(kind: "open" | "close" | "check" | "retry") {
    if (lock.current || !canSell || !loaded || storageError) return;
    if (!navigator.locks) {
      setError(
        "Ce navigateur ne permet pas de sécuriser plusieurs fenêtres de caisse. Utilisez une version récente de Chrome, Edge ou Safari.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await navigator.locks.request(
        "imad-pos-v1:" + actorId,
        { ifAvailable: true },
        async (tabLock) => {
          if (!tabLock)
            throw new CashUiError(
              "Un encaissement est déjà en cours dans une autre fenêtre. Vérifiez son résultat.",
            );
          let attempt = parseCashAttempt(localStorage.getItem(storageKey));
          if (kind === "check") {
            if (!attempt) return;
            const r = await recoverCashAction(attempt.key);
            if (r.kind !== attempt.kind)
              throw new CashUiError("Opération de caisse non confirmée. Vérifiez son état.");
            await confirmed(r.data, attempt);
            return;
          }
          const draft = parsePosDraft(localStorage.getItem("imad-pos-v1:" + actorId));
          if (draft.pending)
            throw new CashUiError("Vérifiez l’encaissement en attente avant de gérer la caisse.");
          if (kind !== "retry") {
            if (attempt)
              throw new CashUiError(
                "Vérifiez l’opération de caisse en attente avant de poursuivre.",
              );
            if (kind === "open") {
              const openingCents = cashInputCents(opening);
              if (openingCents === null) throw new CashUiError("Vérifiez le montant de caisse.");
              if (
                !window.confirm(
                  t(
                    "Ouvrir votre caisse avec ce fond et rattacher les prochaines ventes à cette session ?",
                  ),
                )
              )
                return;
              attempt = {
                kind: "open",
                key: "open_" + crypto.randomUUID(),
                body: { openingCents },
              };
            } else {
              if (draft.cart.length)
                throw new CashUiError("Terminez ou videz le panier avant de clôturer la caisse.");
              const countedCents = cashInputCents(counted);
              if (!preview || countedCents === null)
                throw new CashUiError("Vérifiez le montant de caisse.");
              if (countedCents !== preview.expectedCents && [...note.trim()].length < 3)
                throw new CashUiError("Expliquez l’écart de caisse avant de clôturer.");
              if (!window.confirm(t("Confirmer le comptage et clôturer votre session de caisse ?")))
                return;
              attempt = {
                kind: "close",
                key: "close_" + crypto.randomUUID(),
                body: {
                  sessionId: preview.id,
                  balanceHash: preview.balanceHash,
                  countedCents,
                  note: note.trim(),
                },
              };
            }
            keep(attempt);
          }
          if (!attempt) return;
          try {
            await confirmed(await sendCashAction(attempt.kind, attempt.key, attempt.body), attempt);
          } catch (e) {
            let recovered = false;
            try {
              const r = await recoverCashAction(attempt.key);
              if (r.kind !== attempt.kind) throw new CashUiError();
              await confirmed(r.data, attempt);
              recovered = true;
            } catch (recovery) {
              if (
                isAxiosError(recovery) &&
                recovery.response?.status === 404 &&
                isAxiosError(e) &&
                [400, 404, 409, 422].includes(e.response?.status ?? 0)
              )
                keep(null);
            }
            await cache.invalidateQueries({ queryKey: ["pos-cash-state", actorId] });
            if (!recovered) throw e;
          }
        },
      );
    } catch (e) {
      setError(issue(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function prepare() {
    setError("");
    try {
      const d = parsePosDraft(localStorage.getItem("imad-pos-v1:" + actorId));
      if (d.pending)
        throw new CashUiError("Vérifiez l’encaissement en attente avant de gérer la caisse.");
      if (d.cart.length)
        throw new CashUiError("Terminez ou videz le panier avant de clôturer la caisse.");
      const result = await cash.refetch();
      if (result.isError || !result.data?.active)
        throw new CashUiError("Session de caisse indisponible. Réessayez.");
      setPreview(result.data.active);
      setCounted("");
      setNote("");
    } catch (e) {
      setError(issue(e));
    }
  }
  const active = cash.data?.active,
    amount = cashInputCents(counted),
    changed =
      preview &&
      (!active || active.id !== preview.id || active.balanceHash !== preview.balanceHash),
    disabled = busy || !loaded || !!storageError || !!pending;
  return (
    <section className="pos-cash-panel">
      <header className="pos-section-heading">
        <div>
          <h2>{t(canSell ? "Ma caisse" : "Sessions de caisse")}</h2>
          <p>{t("Une session et un comptage distincts pour chaque caissier.")}</p>
        </div>
      </header>
      {storageError && (
        <p role="alert" className="admin-alert">
          {t(storageError)}
        </p>
      )}
      {error && (
        <p role="alert" className="admin-alert">
          {t(error)}
        </p>
      )}
      {canSell && pending && (
        <section
          className="admin-panel pos-pending"
          aria-label={t("Opération de caisse à vérifier")}
        >
          <h3>{t("Opération de caisse à vérifier")}</h3>
          <p>
            {t(
              "Cette tentative est conservée. Vérifiez son résultat avant toute nouvelle opération.",
            )}
          </p>
          <code>{pending.key}</code>
          <div className="pos-success-actions">
            <button className="admin-button" disabled={busy} onClick={() => void run("check")}>
              {t("Vérifier l’opération")}
            </button>
            <button className="admin-button" disabled={busy} onClick={() => void run("retry")}>
              {t("Réessayer la même opération")}
            </button>
          </div>
        </section>
      )}
      {canSell &&
        (cash.isPending ? (
          <p role="status">{t("Chargement de la session…")}</p>
        ) : cash.isError ? (
          <div role="alert" className="admin-alert">
            {t("Session de caisse indisponible. Réessayez.")}{" "}
            <button type="button" onClick={() => void cash.refetch()}>
              {t("Réessayer")}
            </button>
          </div>
        ) : active ? (
          <section className="admin-panel">
            <h3>{t("Session de caisse ouverte")}</h3>
            <p>
              <bdi dir="ltr">{active.reference}</bdi>
            </p>
            <div className="pos-cash-totals">
              <div>
                <span>{t("Fond d’ouverture")}</span>
                <strong>{posMoney(active.openingCents, ar)}</strong>
              </div>
              <div>
                <span>
                  {t("Ventes en espèces")} ({active.cashCount})
                </span>
                <strong>{posMoney(active.cashCents, ar)}</strong>
              </div>
              <div>
                <span>
                  {t("Ventes par carte — TPE externe")} ({active.cardCount})
                </span>
                <strong>{posMoney(active.cardCents, ar)}</strong>
              </div>
              <div>
                <span>{t("Espèces attendues")}</span>
                <strong>{posMoney(active.expectedCents, ar)}</strong>
              </div>
            </div>
            <p className="admin-muted">
              {t("Espèces attendues = fond d’ouverture + ventes en espèces, après monnaie rendue.")}
            </p>
            {!preview ? (
              <button
                type="button"
                className="admin-button primary"
                disabled={disabled}
                onClick={() => void prepare()}
              >
                {t("Préparer la clôture")}
              </button>
            ) : (
              <form
                className="pos-cash-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("close");
                }}
              >
                {changed && (
                  <p role="alert" className="admin-alert">
                    {t("Des ventes ont été ajoutées. Recomptez la caisse avant de clôturer.")}{" "}
                    <button type="button" disabled={disabled} onClick={() => void prepare()}>
                      {t("Actualiser le comptage")}
                    </button>
                  </p>
                )}
                <label>
                  {t("Espèces comptées (MAD)")}
                  <input
                    inputMode="decimal"
                    value={counted}
                    disabled={disabled}
                    onChange={(e) => setCounted(e.target.value)}
                    required
                  />
                </label>
                {amount !== null && (
                  <p className="pos-summary">
                    {t("Écart de caisse")} :{" "}
                    <strong>{posMoney(amount - preview.expectedCents, ar)}</strong>
                  </p>
                )}
                <label>
                  {t("Note de clôture")}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    disabled={disabled}
                    required={amount !== null && amount !== preview.expectedCents}
                    minLength={amount !== null && amount !== preview.expectedCents ? 3 : undefined}
                  />
                </label>
                <div className="pos-success-actions">
                  <button
                    type="submit"
                    className="admin-button primary"
                    disabled={disabled || !!changed || amount === null}
                  >
                    {t("Clôturer ma caisse")}
                  </button>
                  <button
                    type="button"
                    className="admin-button"
                    disabled={disabled}
                    onClick={() => setPreview(null)}
                  >
                    {t("Annuler le comptage")}
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="admin-panel">
            <h3>{t("Ouvrir ma caisse")}</h3>
            <p>
              {t(
                cash.data?.enabled
                  ? "Votre caisse est clôturée. Ouvrez une session avant la prochaine vente."
                  : "Le suivi commence à l’ouverture. Les anciennes ventes restent dans l’historique, sans être rattachées à cette session.",
              )}
            </p>
            <form
              className="pos-cash-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run("open");
              }}
            >
              <label>
                {t("Fond d’ouverture (MAD)")}
                <input
                  inputMode="decimal"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  required
                  disabled={disabled}
                />
              </label>
              <button
                className="admin-button primary"
                disabled={disabled || cashInputCents(opening) === null}
              >
                {t("Ouvrir ma caisse")}
              </button>
            </form>
          </section>
        ))}
      <section className="admin-panel">
        <header className="pos-section-heading">
          <h3>{t("Historique des sessions")}</h3>
          <button
            type="button"
            className="admin-button"
            disabled={history.isFetching}
            onClick={() => void history.refetch()}
          >
            {t("Actualiser")}
          </button>
        </header>
        {history.isError ? (
          <p role="alert" className="admin-alert">
            {t("Historique de caisse indisponible. Réessayez.")}
          </p>
        ) : history.isPending ? (
          <p role="status">{t("Chargement des ventes…")}</p>
        ) : (
          <>
            <ul className="pos-sales-list">
              {history.data.data.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.cashierName}</strong>
                    <p>
                      {new Date(s.openedAt).toLocaleString(ar ? "ar-MA" : "fr-MA", {
                        timeZone: "Africa/Casablanca",
                      })}
                    </p>
                    <span>{t(s.closing ? "Clôture de caisse" : "Session de caisse ouverte")}</span>
                    <bdi className="pos-history-reference" dir="ltr">
                      {s.reference}
                    </bdi>
                  </div>
                  <div>
                    <strong>{posMoney(s.closing?.countedCents ?? s.expectedCents, ar)}</strong>
                    {s.closing && (
                      <span>
                        {t("Écart de caisse")} : {posMoney(s.closing.differenceCents, ar)}
                      </span>
                    )}
                    <Link
                      className="admin-button"
                      href={`/admin/pos/session/${s.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      {t("Voir le récapitulatif")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {!history.data.total && <p className="admin-empty">{t("Aucune session de caisse.")}</p>}
            {history.data.totalPages > 1 && (
              <nav
                className="admin-inventory-pages"
                aria-label={t("Navigation des sessions de caisse")}
              >
                <button
                  type="button"
                  className="admin-button"
                  disabled={history.data.page <= 1 || history.isFetching}
                  onClick={() => setPage(history.data.page - 1)}
                >
                  {t("Page précédente")}
                </button>
                <span>
                  {t("Page {page} sur {total}", {
                    page: history.data.page,
                    total: history.data.totalPages,
                  })}
                </span>
                <button
                  type="button"
                  className="admin-button"
                  disabled={history.data.page >= history.data.totalPages || history.isFetching}
                  onClick={() => setPage(history.data.page + 1)}
                >
                  {t("Page suivante")}
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}
