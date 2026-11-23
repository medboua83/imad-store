"use client";
import Link from "next/link";
import { ReturnTicket } from "./pos-return-ticket";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { getCashState } from "@/lib/pos-cash-api";
import { getPosCatalog, type PosItem } from "@/lib/pos-api";
import {
  returnSource,
  quoteReturn,
  completeReturn,
  recoverReturn,
  getReturn,
  listReturns,
  type ReturnInput,
  type ReturnSource,
  type ReturnQuote,
  type ReturnReceipt,
} from "@/lib/pos-returns-api";
import { useAdminLocale } from "./admin-locale";
import { posMoney } from "./pos-receipt";
import { parsePosDraft, cashInputCents } from "./pos-draft";
import { cashAttemptKey, parseCashAttempt } from "./pos-cash-draft";
import {
  returnStorageKey,
  parseReturnDraft,
  assertReturn,
  type ReturnAttempt,
  type ReturnDraft,
} from "./pos-return-draft";
const message = (e: unknown) =>
  isAxiosError(e) && typeof e.response?.data?.error === "string"
    ? e.response.data.error
    : e instanceof Error && !isAxiosError(e)
      ? e.message
      : "Retour non confirmé. Vérifiez son état avant de réessayer.";
export function PosReturnsPanel({
  actorId,
  canReturn,
  initialReference = "",
}: {
  actorId: string;
  canReturn: boolean;
  initialReference?: string;
}) {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar",
    cache = useQueryClient(),
    lock = useRef(false),
    version = useRef(0);
  const [reference, setReference] = useState(initialReference),
    [source, setSource] = useState<ReturnSource | null>(null),
    [choices, setChoices] = useState<
      Record<string, { quantity: number; restock: "" | "yes" | "no" }>
    >({}),
    [replacements, setReplacements] = useState<PosItem[]>([]),
    [labels, setLabels] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [quote, setQuote] = useState<ReturnQuote | null>(null),
    [reviewed, setReviewed] = useState<ReturnInput | null>(null),
    [note, setNote] = useState(""),
    [received, setReceived] = useState(""),
    [method, setMethod] = useState<"CASH" | "CARD_TERMINAL">("CASH"),
    [draft, setDraft] = useState<ReturnDraft | null>(null),
    [receipt, setReceipt] = useState<ReturnReceipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [historyPage, setHistoryPage] = useState(1),
    [historyReceipt, setHistoryReceipt] = useState<ReturnReceipt | null>(null);
  const key = returnStorageKey(actorId),
    frozen = busy || !draft || !!draft.pending || !!draft.receiptId || !!storageError;
  const history = useQuery({
    queryKey: ["pos-returns", actorId, historyPage],
    queryFn: ({ signal }) => listReturns(historyPage, signal),
    retry: false,
    refetchInterval: 15000,
  });
  const catalog = useQuery({
    queryKey: ["pos-return-catalog", actorId, search],
    queryFn: ({ signal }) => getPosCatalog(search, 1, signal),
    enabled: canReturn && !!source && !frozen,
    retry: false,
  });
  useEffect(() => {
    const read = () => {
      try {
        setDraft(parseReturnDraft(localStorage.getItem(key)));
        setStorageError("");
        setReceipt(null);
      } catch {
        setStorageError(
          "Le retour conservé est illisible. Vérifiez l’historique avant de poursuivre.",
        );
      }
    };
    const timer = setTimeout(read, 0);
    window.addEventListener("storage", read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", read);
      // Ignore late lookups after this panel is left.
      version.current += 1;
    };
  }, [key]);
  const saved = useQuery({
    queryKey: ["pos-return-receipt", actorId, draft?.receiptId],
    queryFn: ({ signal }) => getReturn(draft!.receiptId!, signal),
    enabled: !!draft?.receiptId && !receipt,
    retry: false,
  });
  function keep(value: ReturnDraft) {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw)
      throw new Error(
        t("Impossible de conserver l’opération. Vérifiez le stockage du navigateur."),
      );
    setDraft(value);
  }
  function changed() {
    version.current++;
    setQuote(null);
    setReviewed(null);
    setReceived("");
    setError("");
  }
  function reset() {
    changed();
    setSource(null);
    setReference("");
    setChoices({});
    setReplacements([]);
    setLabels({});
    setSearch("");
    setNote("");
    setMethod("CASH");
    setReceipt(null);
  }
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (frozen) return;
    changed();
    const match = reference
      .trim()
      .replace(/^#/, "")
      .match(/^(POS|RET)-([a-f0-9]{24})$/i);
    if (!match) {
      setError("Saisissez la référence complète POS-… ou RET-… du reçu.");
      return;
    }
    setBusy(true);
    const v = version.current;
    try {
      const s = await returnSource(
        match[1].toUpperCase() === "POS" ? "SALE" : "EXCHANGE",
        match[2].toLowerCase(),
      );
      if (v !== version.current) return;
      setSource(s);
      setChoices({});
      setReplacements([]);
      setLabels({});
    } catch (e) {
      if (v === version.current) setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function input(): ReturnInput {
    if (!source) throw new Error("Choisissez le ticket d’origine.");
    const rows = source.items
      .filter((i) => (choices[i.id]?.quantity ?? 0) > 0)
      .map((i) => {
        const c = choices[i.id];
        if (!c.restock) throw new Error("Indiquez si chaque article retourné est revendable.");
        return { itemId: i.id, quantity: c.quantity, restock: c.restock === "yes" };
      });
    if (!rows.length) throw new Error("Choisissez au moins un article à retourner.");
    return { sourceKind: source.kind, sourceId: source.id, returns: rows, replacements };
  }
  async function prepare() {
    if (frozen) return;
    setBusy(true);
    setError("");
    try {
      const body = input(),
        q = await quoteReturn(body);
      setReviewed(body);
      setQuote(q);
      setReceived("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function accepted(r: ReturnReceipt, p: ReturnAttempt) {
    assertReturn(r, p, actorId);
    keep({ pending: null, receiptId: r.id });
    setReceipt(r);
    setQuote(null);
    setReviewed(null);
    setError("");
    await Promise.all(
      [
        "pos-returns",
        "pos-cash-state",
        "pos-cash-history",
        "pos-return-catalog",
        "pos-catalog",
      ].map((k) => cache.invalidateQueries({ queryKey: [k] })),
    );
  }
  async function run(kind: "send" | "check" | "retry") {
    if (lock.current || !canReturn || !draft || storageError) return;
    if (!navigator.locks) {
      setError("Utilisez un navigateur récent pour sécuriser les opérations de caisse.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await navigator.locks.request(
        "imad-pos-v1:" + actorId,
        { ifAvailable: true },
        async (tab) => {
          if (!tab)
            throw new Error("Une autre opération de caisse est en cours. Vérifiez son résultat.");
          const latest = parseReturnDraft(localStorage.getItem(key));
          let p = latest.pending;
          if (kind === "check") {
            if (p) await accepted(await recoverReturn(p.key), p);
            return;
          }
          if (kind === "send") {
            if (p || latest.receiptId)
              throw new Error("Vérifiez le retour déjà conservé avant de poursuivre.");
            if (parseCashAttempt(localStorage.getItem(cashAttemptKey(actorId))))
              throw new Error("Vérifiez l’opération de caisse en attente avant de poursuivre.");
            if (parsePosDraft(localStorage.getItem("imad-pos-v1:" + actorId)).pending)
              throw new Error("Vérifiez l’encaissement en attente avant de poursuivre.");
            if (!quote || !reviewed) throw new Error("Vérifiez le total du retour.");
            const s = await getCashState();
            if (!s.active) throw new Error("Ouvrez Ma caisse avant un retour ou un échange.");
            const paymentMethod =
              quote.netCents < 0 ? "CASH" : quote.netCents === 0 ? "NONE" : method;
            const receivedCents =
              quote.netCents <= 0
                ? 0
                : method === "CARD_TERMINAL"
                  ? quote.netCents
                  : cashInputCents(received);
            if (receivedCents === null || (quote.netCents > 0 && receivedCents < quote.netCents))
              throw new Error("Vérifiez le montant encaissé.");
            if ([...note.trim()].length < 3)
              throw new Error("Indiquez le motif du retour (3 caractères minimum).");
            if (
              !window.confirm(
                t(
                  quote.netCents < 0
                    ? "Enregistrer ce retour ? Remettez les espèces une seule fois, après confirmation du reçu."
                    : quote.netCents > 0 && method === "CARD_TERMINAL"
                      ? "Le complément a-t-il déjà été encaissé sur votre TPE ?"
                      : "Confirmer cet échange et la différence d’espèces ?",
                ),
              )
            )
              return;
            p = {
              key: crypto.randomUUID(),
              body: {
                ...reviewed,
                quoteHash: quote.quoteHash,
                cashSessionId: s.active.id,
                paymentMethod,
                receivedCents,
                note: note.trim(),
              },
              returnCents: quote.returnCents,
              replacementCents: quote.replacementCents,
              netCents: quote.netCents,
            };
            keep({ pending: p, receiptId: null });
          }
          if (!p) return;
          try {
            await accepted(await completeReturn(p.key, p.body), p);
          } catch (e) {
            let recovered = false;
            try {
              await accepted(await recoverReturn(p.key), p);
              recovered = true;
            } catch (recovery) {
              if (
                isAxiosError(recovery) &&
                recovery.response?.status === 404 &&
                isAxiosError(e) &&
                [400, 404, 409, 422].includes(e.response?.status ?? 0)
              ) {
                keep({ pending: null, receiptId: null });
                changed();
                if (source) {
                  const fresh = await returnSource(source.kind, source.id);
                  setSource(fresh);
                  setChoices({});
                }
              }
            }
            if (!recovered) throw e;
          }
        },
      );
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const result = receipt ?? (!saved.isError ? saved.data : null);
  return (
    <section className="pos-returns">
      <header className="pos-section-heading">
        <div>
          <h2>{t("Retours et échanges")}</h2>
          <p>{t("Depuis le ticket d’origine, au prix réellement payé.")}</p>
        </div>
      </header>
      {error && (
        <p role="alert" className="admin-alert">
          {t(error)}
        </p>
      )}
      {storageError && (
        <p role="alert" className="admin-alert">
          {t(storageError)}
        </p>
      )}
      {draft?.pending && (
        <div className="admin-panel">
          <h3>{t("Retour à vérifier")}</h3>
          <p>
            {t("Ne recommencez pas le remboursement. Retrouvez le reçu avec la même référence.")}
          </p>
          <button
            className="admin-button primary"
            disabled={busy}
            onClick={() => void run("check")}
          >
            {t("Vérifier le retour")}
          </button>
          <button className="admin-button" disabled={busy} onClick={() => void run("retry")}>
            {t("Réessayer la même opération")}
          </button>
        </div>
      )}
      {draft?.receiptId && !result && (
        <div className="admin-panel">
          <p role="status">
            {t(
              saved.isError
                ? "Reçu indisponible. Ne recommencez pas le remboursement."
                : "Chargement du reçu…",
            )}
          </p>
          <button className="admin-button" onClick={() => void saved.refetch()}>
            {t("Réessayer")}
          </button>
        </div>
      )}
      {result ? (
        <div className="admin-panel">
          <p role="status">{t("Opération enregistrée. Stock mis à jour une seule fois.")}</p>
          <p className="admin-feedback">
            {t(
              result.netCents < 0
                ? "Remettez le remboursement une seule fois. Une réimpression ne signifie pas un nouveau paiement."
                : "Remettez les articles de remplacement et la monnaie éventuelle une seule fois.",
            )}
          </p>
          <ReturnTicket receipt={result} />
          <div className="pos-success-actions">
            <Link
              className="admin-button"
              target="_blank"
              rel="noopener"
              href={"/admin/pos/return/" + result.id}
            >
              {t("Imprimer / PDF")}
            </Link>
            {canReturn && (
              <button
                className="admin-button primary"
                onClick={() => {
                  if (
                    window.confirm(
                      t("Articles et espèces remis au client ? Commencer une nouvelle opération ?"),
                    )
                  ) {
                    keep({ pending: null, receiptId: null });
                    reset();
                  }
                }}
              >
                {t("Nouveau retour ou échange")}
              </button>
            )}
          </div>
        </div>
      ) : (
        canReturn &&
        !draft?.receiptId &&
        !draft?.pending && (
          <div className="admin-panel">
            <form onSubmit={lookup} className="pos-return-lookup">
              <label>
                {t("Ticket d’origine")}
                <input
                  value={reference}
                  onChange={(e) => {
                    changed();
                    setSource(null);
                    setReference(e.target.value);
                  }}
                  placeholder="POS-… / RET-…"
                  dir="ltr"
                  maxLength={29}
                  disabled={frozen}
                />
              </label>
              <button className="admin-button" disabled={frozen}>
                {t("Retrouver le ticket")}
              </button>
            </form>
            {source && (
              <>
                <h3>{t("Articles à retourner")}</h3>
                <code dir="ltr">{source.reference}</code>
                {source.items.map((i) => (
                  <div className="pos-return-line" key={i.id}>
                    <div>
                      <strong>{ar ? i.nameAr : i.nameFr}</strong>
                      <p>
                        {ar ? i.colorAr : i.colorFr} · {i.size}
                      </p>
                      <p>
                        {t("Quantité encore retournable")} : {i.remainingQuantity} / {i.quantity}
                      </p>
                      <p>
                        {t("Montant payé sur le ticket")} : {posMoney(i.totalCents, ar)}
                      </p>
                    </div>
                    <label>
                      {t("Quantité à retourner")}
                      <select
                        aria-label={t("Quantité à retourner") + " — " + i.sku}
                        disabled={frozen}
                        value={choices[i.id]?.quantity ?? 0}
                        onChange={(e) => {
                          changed();
                          setChoices((c) => ({
                            ...c,
                            [i.id]: { quantity: Number(e.target.value), restock: "" },
                          }));
                        }}
                      >
                        {Array.from({ length: i.remainingQuantity + 1 }, (_, n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(choices[i.id]?.quantity ?? 0) > 0 && (
                      <label>
                        {t("État de l’article")}
                        <select
                          aria-label={t("État de l’article") + " — " + i.sku}
                          disabled={frozen}
                          value={choices[i.id]?.restock ?? ""}
                          onChange={(e) => {
                            changed();
                            setChoices((c) => ({
                              ...c,
                              [i.id]: { ...c[i.id], restock: e.target.value as "yes" | "no" },
                            }));
                          }}
                        >
                          <option value="">{t("Choisir l’état")}</option>
                          <option value="yes" disabled={!i.canRestock}>
                            {t("Revendable — remettre en stock")}
                          </option>
                          <option value="no">
                            {t("Non revendable — ne pas remettre en stock")}
                          </option>
                        </select>
                        {!i.canRestock && (
                          <small>
                            {t("Variante modifiée ou supprimée : remise en stock indisponible.")}
                          </small>
                        )}
                      </label>
                    )}
                  </div>
                ))}
                <details className="pos-return-replacements">
                  <summary>{t("Ajouter des articles pour un échange")}</summary>
                  <label>
                    {t("Rechercher un article de remplacement")}
                    <input
                      value={search}
                      disabled={frozen}
                      onChange={(e) => setSearch(e.target.value)}
                      maxLength={120}
                    />
                  </label>
                  {catalog.isError ? (
                    <p role="alert">
                      {t("Catalogue indisponible.")}{" "}
                      <button onClick={() => void catalog.refetch()}>{t("Réessayer")}</button>
                    </p>
                  ) : (
                    <div className="pos-return-options">
                      {catalog.data?.data.map((v) => (
                        <button
                          type="button"
                          className="admin-button"
                          key={v.id}
                          disabled={
                            frozen ||
                            (v.stock === 0 &&
                              !source.items.some(
                                (i) => i.variantId === v.id && choices[i.id]?.restock === "yes",
                              ))
                          }
                          onClick={() => {
                            changed();
                            setLabels((l) => ({
                              ...l,
                              [v.id]: `${ar ? v.nameAr : v.nameFr} · ${ar ? v.colorAr : v.colorFr} · ${v.size ?? ""}`,
                            }));
                            setReplacements((rows) => {
                              const old = rows.find((r) => r.variantId === v.id);
                              return old
                                ? rows.map((r) =>
                                    r === old
                                      ? { ...r, quantity: Math.min(1000, r.quantity + 1) }
                                      : r,
                                  )
                                : [...rows, { variantId: v.id, quantity: 1 }];
                            });
                          }}
                        >
                          {ar ? v.nameAr : v.nameFr} · {ar ? v.colorAr : v.colorFr} · {v.size} ·{" "}
                          {posMoney(v.unitPriceCents, ar)}
                        </button>
                      ))}
                    </div>
                  )}
                  <p>
                    {t(
                      "La recherche parcourt tout le catalogue. Le stock et les offres sont revérifiés avant validation.",
                    )}
                  </p>
                </details>
                {replacements.map((i) => (
                  <div className="pos-return-line" key={i.variantId}>
                    <strong>{labels[i.variantId]}</strong>
                    <label>
                      {t("Quantité de remplacement")}
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        disabled={frozen}
                        value={i.quantity}
                        onChange={(e) => {
                          changed();
                          setReplacements((rows) =>
                            rows.map((r) =>
                              r.variantId === i.variantId
                                ? {
                                    ...r,
                                    quantity: Math.max(
                                      1,
                                      Math.min(1000, Number(e.target.value) || 1),
                                    ),
                                  }
                                : r,
                            ),
                          );
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={frozen}
                      onClick={() => {
                        changed();
                        setReplacements((rows) => rows.filter((r) => r.variantId !== i.variantId));
                      }}
                    >
                      {t("Retirer")}
                    </button>
                  </div>
                ))}
                <label>
                  {t("Motif du retour")}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={frozen}
                    maxLength={500}
                  />
                </label>
                <button
                  className="admin-button primary"
                  disabled={frozen}
                  onClick={() => void prepare()}
                >
                  {t("Vérifier le total du retour")}
                </button>
                {quote && (
                  <section className="pos-return-review" aria-label={t("Vérification du retour")}>
                    <dl>
                      <div>
                        <dt>{t("Valeur du retour")}</dt>
                        <dd>{posMoney(quote.returnCents, ar)}</dd>
                      </div>
                      <div>
                        <dt>{t("Nouveaux articles")}</dt>
                        <dd>{posMoney(quote.replacementCents, ar)}</dd>
                      </div>
                      <div className="pos-ticket-total">
                        <dt>
                          {t(
                            quote.netCents < 0
                              ? "À rembourser en espèces"
                              : quote.netCents > 0
                                ? "À encaisser"
                                : "Aucun mouvement d’argent",
                          )}
                        </dt>
                        <dd>{posMoney(Math.abs(quote.netCents), ar)}</dd>
                      </div>
                    </dl>
                    {quote.netCents > 0 && (
                      <>
                        <label>
                          {t("Mode de paiement")}
                          <select
                            disabled={frozen}
                            value={method}
                            onChange={(e) => setMethod(e.target.value as typeof method)}
                          >
                            <option value="CASH">{t("Espèces")}</option>
                            <option value="CARD_TERMINAL">{t("Carte — TPE externe")}</option>
                          </select>
                        </label>
                        {method === "CASH" && (
                          <label>
                            {t("Espèces reçues (MAD)")}
                            <input
                              inputMode="decimal"
                              value={received}
                              onChange={(e) => setReceived(e.target.value)}
                              disabled={frozen}
                            />
                          </label>
                        )}
                      </>
                    )}
                    <p>
                      {t(
                        "Attendez la confirmation du reçu avant de remettre les articles ou le remboursement. En cas de coupure, vérifiez la même opération.",
                      )}
                    </p>
                    <button
                      className="admin-button primary"
                      disabled={frozen}
                      onClick={() => void run("send")}
                    >
                      {t("Enregistrer le retour ou l’échange")}
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        )
      )}
      <section className="admin-panel pos-return-history">
        <h3>{t("Historique des retours et échanges")}</h3>
        {history.isError ? (
          <p role="alert">
            {t("Historique indisponible.")}{" "}
            <button onClick={() => void history.refetch()}>{t("Réessayer")}</button>
          </p>
        ) : (
          history.data?.data.map((r) => (
            <div key={r.id} className="pos-return-history-row">
              <code dir="ltr">{r.reference}</code>
              <span>
                {posMoney(r.netCents, ar)} · {r.cashierName}
              </span>
              <button className="admin-button" onClick={() => setHistoryReceipt(r)}>
                {t("Voir le reçu")}
              </button>
            </div>
          ))
        )}
        {history.data?.total === 0 && <p>{t("Aucun retour enregistré.")}</p>}
        {historyReceipt && (
          <div>
            <button className="admin-button" onClick={() => setHistoryReceipt(null)}>
              {t("Fermer le reçu")}
            </button>
            <ReturnTicket receipt={historyReceipt} />
            <Link
              className="admin-button"
              target="_blank"
              rel="noopener"
              href={"/admin/pos/return/" + historyReceipt.id}
            >
              {t("Imprimer / PDF")}
            </Link>
          </div>
        )}
        <div className="pos-history-pagination">
          <button
            className="admin-button"
            disabled={historyPage <= 1 || history.isFetching}
            onClick={() => setHistoryPage((p) => p - 1)}
          >
            {t("Précédent")}
          </button>
          <span>
            {historyPage} / {Math.max(1, history.data?.totalPages ?? 1)}
          </span>
          <button
            className="admin-button"
            disabled={historyPage >= (history.data?.totalPages ?? 1) || history.isFetching}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            {t("Suivant")}
          </button>
        </div>
      </section>
    </section>
  );
}
