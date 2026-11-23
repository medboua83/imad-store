"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Link from "next/link";
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Receipt, RefreshCw } from "lucide-react";
import { ProductPhoto } from "@/components/store/ProductPhoto";
import {
  getPosContext,
  getPosCatalog,
  scanPosVariant,
  quotePosCart,
  recordPosSale,
  recoverPosSale,
  getPosReceipt,
  type PosVariant,
  type PosReceipt,
} from "@/lib/pos-api";
import { useAdminLocale } from "./admin-locale";
import {
  emptyPosDraft,
  parsePosDraft,
  storePosDraft,
  assertPosReceipt,
  cashInputCents,
  samePosItems,
  type PosDraft,
  type PendingSale,
} from "./pos-draft";
import { posMoney, PosTicket } from "./pos-receipt";
import { PosHistoryPanel } from "./pos-history";
import { PosReturnsPanel } from "./pos-returns-panel";
import { parseReturnDraft, returnStorageKey } from "./pos-return-draft";
import { PosCashPanel } from "./pos-cash-panel";
import { getCashState } from "@/lib/pos-cash-api";
import { parseCashAttempt, cashAttemptKey } from "./pos-cash-draft";
import "./pos.css";
const problem = (e: unknown) =>
  isAxiosError(e) && typeof e.response?.data?.error === "string"
    ? e.response.data.error
    : "La connexion a été interrompue. Vérifiez l’encaissement avant de poursuivre.";
export default function PosTab() {
  const { t, locale } = useAdminLocale(),
    ar = locale === "ar",
    cache = useQueryClient();
  const context = useQuery({
    queryKey: ["pos-context"],
    queryFn: ({ signal }) => getPosContext(signal),
    retry: false,
    staleTime: 0,
  });
  const cash = useQuery({
    queryKey: ["pos-cash-state", context.data?.actorId],
    queryFn: ({ signal }) => getCashState(signal),
    enabled: !!context.data?.canSell,
    retry: false,
    refetchInterval: 15000,
  });
  const [view, setView] = useState<"SALE" | "HISTORY" | "REGISTER" | "RETURNS">("SALE"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [page, setPage] = useState(1);
  const [draft, setDraft] = useState<PosDraft | null>(null),
    draftRef = useRef<PosDraft | null>(null),
    [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false),
    lock = useRef(false),
    scanLock = useRef(false),
    scanVersion = useRef(0),
    scanController = useRef<AbortController | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [returnReference, setReturnReference] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD_TERMINAL">("CASH"),
    [received, setReceived] = useState(""),
    [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const storageKey = context.data ? "imad-pos-v1:" + context.data.actorId : null;
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!storageKey) return;
    const timer = setTimeout(() => {
      try {
        const saved = parsePosDraft(localStorage.getItem(storageKey));
        draftRef.current = saved;
        setDraft(saved);
        setStorageError("");
      } catch {
        setStorageError(
          "Le brouillon de caisse est illisible. Vérifiez l’historique avant de poursuivre.",
        );
      }
    }, 0);
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      try {
        const next = parsePosDraft(event.newValue);
        draftRef.current = next;
        setDraft(next);
        setReceipt(null);
        setReceived("");
        setError("");
      } catch {
        setStorageError(
          "Le brouillon de caisse est illisible. Vérifiez l’historique avant de poursuivre.",
        );
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey]);
  useEffect(
    () => () => {
      scanVersion.current++;
      scanController.current?.abort();
      scanController.current = null;
    },
    [],
  );
  function cancelScan() {
    scanVersion.current++;
    scanController.current?.abort();
    scanController.current = null;
    scanLock.current = false;
    setScanning(false);
  }
  const frozen =
    busy || !!draft?.pending || !!draft?.receiptId || !!storageError || !context.data?.canSell;
  const catalog = useQuery({
    queryKey: ["pos-catalog", debounced, page],
    queryFn: ({ signal }) => getPosCatalog(debounced, page, signal),
    enabled: !!context.data?.canSell && view === "SALE",
    retry: false,
    staleTime: 0,
    refetchInterval: 15000,
  });
  const items = draft?.cart.map(({ variantId, quantity }) => ({ variantId, quantity })) ?? [];
  const quote = useQuery({
    queryKey: ["pos-quote", context.data?.actorId, items],
    queryFn: ({ signal }) => quotePosCart(items, signal),
    enabled:
      !!context.data?.canSell &&
      items.length > 0 &&
      !draft?.pending &&
      !draft?.receiptId &&
      view === "SALE",
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
  });
  const restore = useQuery({
    queryKey: ["pos-receipt", draft?.receiptId, context.data?.actorId],
    queryFn: ({ signal }) => getPosReceipt(draft!.receiptId!, signal),
    enabled: !!draft?.receiptId && !receipt,
    retry: false,
  });
  const savedReceipt = receipt ?? restore.data ?? null;
  function retain(next: PosDraft) {
    if (!storageKey) throw new Error("Missing cashier");
    storePosDraft(storageKey, next, localStorage);
    draftRef.current = next;
    setDraft(next);
  }
  async function editCart(change: (previous: PosDraft) => PosDraft) {
    if (frozen || !draftRef.current) return false;
    try {
      setError("");
      setMessage("");
      return (
        (await withDraftLock(async () => {
          const latest = parsePosDraft(localStorage.getItem(storageKey!));
          if (latest.pending || latest.receiptId) {
            draftRef.current = latest;
            setDraft(latest);
            setReceipt(null);
            return false;
          }
          const next = change(latest);
          if (next === latest) return false;
          retain(next);
          return true;
        })) === true
      );
    } catch {
      setStorageError("Impossible de conserver le brouillon. Vérifiez le stockage du navigateur.");
    }
  }
  async function add(v: PosVariant, mayAdd = () => true) {
    if (!v.available || frozen) return false;
    return await editCart((previous) => {
      if (!mayAdd()) return previous;
      const found = previous.cart.find((i) => i.variantId === v.id),
        qty = (found?.quantity ?? 0) + 1;
      if (qty > v.stock || qty > 1000 || (!found && previous.cart.length >= 100)) {
        setMessage("Quantité maximale disponible atteinte.");
        return previous;
      }
      const label = [(ar ? v.nameAr : v.nameFr) || v.nameFr, ar ? v.colorAr : v.colorFr, v.size]
        .filter(Boolean)
        .join(" · ");
      return {
        ...previous,
        cart: found
          ? previous.cart.map((i) => (i.variantId === v.id ? { ...i, quantity: qty } : i))
          : [...previous.cart, { variantId: v.id, quantity: 1, label }],
      };
    });
  }
  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (frozen || lock.current || scanLock.current || !search.trim()) return;
    cancelScan();
    setError("");
    setMessage("");
    const version = scanVersion.current,
      controller = new AbortController(),
      scanned = search.trim();
    scanController.current = controller;
    scanLock.current = true;
    setScanning(true);
    const current = () => version === scanVersion.current && !controller.signal.aborted;
    try {
      if (scanned.length > 100) {
        setDebounced(scanned);
        setPage(1);
        setMessage("Choisissez la variante dans les résultats.");
        return;
      }
      const variant = await scanPosVariant(scanned, controller.signal);
      if (!current()) return;
      if (!variant.available) {
        setMessage("Cette référence est actuellement indisponible.");
        return;
      }
      const added = await add(variant, current);
      if (added && current()) {
        setSearch("");
        setMessage("Article ajouté au panier.");
      }
    } catch (e) {
      if (!current()) return;
      if (isAxiosError(e) && e.response?.status === 404) {
        setDebounced(scanned);
        setPage(1);
        setMessage("Choisissez la variante dans les résultats.");
      } else setError(problem(e));
    } finally {
      if (scanController.current === controller) {
        scanController.current = null;
        scanLock.current = false;
        setScanning(false);
      }
    }
  }
  function accepted(sale: PosReceipt, pending: PendingSale) {
    assertPosReceipt(sale, pending, context.data!.actorId);
    // Keep the attempt frozen if storing its success fails; recovery uses the same key.
    retain({ cart: [], pending: null, receiptId: sale.id });
    setReceipt(sale);
    setReceived("");
    setError("");
    setMessage("Vente enregistrée. Stock mis à jour une seule fois.");
    void cache.invalidateQueries({ queryKey: ["pos-catalog"] });
    void cache.invalidateQueries({ queryKey: ["pos-history"] });
    void cache.invalidateQueries({ queryKey: ["pos-cash-state"] });
  }
  async function withDraftLock<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (!storageKey) return;
    if (!navigator.locks) {
      setError(
        "Ce navigateur ne permet pas de sécuriser plusieurs fenêtres de caisse. Utilisez une version récente de Chrome, Edge ou Safari.",
      );
      return;
    }
    return await navigator.locks.request(storageKey, { ifAvailable: true }, async (tabLock) => {
      if (!tabLock) {
        setError(
          "Un encaissement est déjà en cours dans une autre fenêtre. Vérifiez son résultat.",
        );
        return;
      }
      return await work();
    });
  }
  async function submit(pending?: PendingSale) {
    await withDraftLock(() => performSubmit(pending));
  }
  async function performSubmit(pending?: PendingSale) {
    if (lock.current || !context.data?.canSell || storageError || !draftRef.current) return;
    let operation = pending;
    if (!operation) {
      if (!cash.data || cash.isError || cash.isFetching) {
        setError("Session de caisse indisponible. Réessayez.");
        return;
      }
      if (cash.data.enabled && !cash.data.active) {
        setError("Votre caisse est clôturée. Ouvrez une session avant la prochaine vente.");
        setView("REGISTER");
        return;
      }
      try {
        if (
          parseReturnDraft(localStorage.getItem(returnStorageKey(context.data.actorId))).pending
        ) {
          setError("Vérifiez le retour en attente avant de poursuivre.");
          setView("RETURNS");
          return;
        }
        if (parseCashAttempt(localStorage.getItem(cashAttemptKey(context.data.actorId)))) {
          setError("Vérifiez l’opération de caisse en attente avant de poursuivre.");
          setView("REGISTER");
          return;
        }
      } catch {
        setError(
          "L’opération de caisse conservée est illisible. Vérifiez les sessions avant de poursuivre.",
        );
        return;
      }
      if (
        draftRef.current.pending ||
        draftRef.current.receiptId ||
        !quote.data ||
        quote.isFetching ||
        quote.isError
      )
        return;
      if (!samePosItems(draftRef.current.cart, quote.data.lines)) {
        setError("Le panier a changé. Vérifiez le nouveau total avant d’encaisser.");
        return;
      }
      const amount = method === "CARD_TERMINAL" ? quote.data.totalCents : cashInputCents(received);
      if (amount === null || amount < quote.data.totalCents) {
        setError("Vérifiez le montant encaissé.");
        return;
      }
      if (
        !window.confirm(
          t(
            method === "CASH"
              ? "Confirmer les espèces reçues et enregistrer cette vente ?"
              : "Confirmer que le paiement a déjà été encaissé sur votre TPE ?",
          ),
        )
      )
        return;
      try {
        const latest = parsePosDraft(localStorage.getItem(storageKey!));
        if (latest.pending || latest.receiptId) {
          draftRef.current = latest;
          setDraft(latest);
          setReceipt(null);
          setError("Une autre fenêtre a déjà commencé cet encaissement. Vérifiez son résultat.");
          return;
        }
        if (!samePosItems(latest.cart, quote.data.lines)) {
          draftRef.current = latest;
          setDraft(latest);
          setReceived("");
          setError("Le panier a changé. Vérifiez le nouveau total avant d’encaisser.");
          return;
        }
      } catch {
        setStorageError(
          "Impossible de conserver le brouillon. Vérifiez le stockage du navigateur.",
        );
        return;
      }
      operation = {
        key: crypto.randomUUID(),
        totalCents: quote.data.totalCents,
        body: {
          items: quote.data.lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
          quoteHash: quote.data.quoteHash,
          paymentMethod: method,
          receivedCents: amount,
          ...(cash.data.active ? { cashSessionId: cash.data.active.id } : {}),
        },
      };
      try {
        retain({ ...draftRef.current, pending: operation });
      } catch {
        setStorageError(
          "Impossible de conserver le brouillon. Vérifiez le stockage du navigateur.",
        );
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      accepted(await recordPosSale(operation.key, operation.body), operation);
    } catch (e) {
      // All replays are serialized by the server's per-attempt lock. A definite rejected POST cannot leave this attempt in flight there.
      const definite = isAxiosError(e) && [400, 404, 409, 422].includes(e.response?.status ?? 0);
      if (definite) {
        try {
          const found = await recoverPosSale(operation.key);
          accepted(found, operation);
        } catch (recovery) {
          if (isAxiosError(recovery) && recovery.response?.status === 404) {
            try {
              retain({ ...draftRef.current!, pending: null });
              void quote.refetch();
              void cache.invalidateQueries({ queryKey: ["pos-cash-state"] });
            } catch {
              setStorageError(
                "Impossible de conserver le brouillon. Vérifiez le stockage du navigateur.",
              );
            }
          }
        }
      }
      if (draftRef.current?.pending || !draftRef.current?.receiptId) setError(problem(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    await withDraftLock(performReconcile);
  }
  async function performReconcile() {
    const p = draftRef.current?.pending;
    if (!p || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      accepted(await recoverPosSale(p.key), p);
    } catch (e) {
      setError(
        isAxiosError(e) && e.response?.status === 404
          ? "Cet encaissement n’est pas encore enregistré. Réessayez avec la même référence."
          : problem(e),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function newSale() {
    if (busy || draftRef.current?.pending || storageError) return;
    if (draftRef.current?.cart.length && !window.confirm(t("Vider le panier de caisse ?"))) return;
    try {
      await withDraftLock(async () => {
        const latest = parsePosDraft(localStorage.getItem(storageKey!));
        if (latest.pending) {
          draftRef.current = latest;
          setDraft(latest);
          return;
        }
        retain(emptyPosDraft());
        cancelScan();
        setSearch("");
        setDebounced("");
        setPage(1);
        setMethod("CASH");
        setReceipt(null);
        setReceived("");
        setError("");
        setMessage("");
      });
    } catch {
      setStorageError("Impossible de conserver le brouillon. Vérifiez le stockage du navigateur.");
    }
  }
  if (context.isPending) return <p role="status">{t("Chargement de la caisse…")}</p>;
  if (context.isError)
    return (
      <div className="admin-alert" role="alert">
        {t("Caisse indisponible. Réessayez.")}{" "}
        <button type="button" onClick={() => void context.refetch()}>
          {t("Réessayer")}
        </button>
      </div>
    );
  const amount =
      method === "CARD_TERMINAL" ? (quote.data?.totalCents ?? null) : cashInputCents(received),
    change = amount !== null && quote.data ? amount - quote.data.totalCents : null;
  return (
    <div className="pos-workspace">
      <div className="pos-topbar">
        <div>
          <span className="admin-eyebrow">{t("VENTES EN MAGASIN")}</span>
          <h2>{t("Votre caisse, simplement")}</h2>
          <p>{t("Catalogue et stock partagés avec la boutique en ligne.")}</p>
        </div>
        <div className="pos-view-switch" aria-label={t("Vue de la caisse")}>
          {context.data?.canSell && (
            <button
              type="button"
              className="admin-button"
              aria-pressed={view === "SALE"}
              onClick={() => {
                cancelScan();
                setView("SALE");
              }}
            >
              <ShoppingCart size={17} />
              {t("Encaisser")}
            </button>
          )}
          <button
            type="button"
            className="admin-button"
            aria-pressed={view === "HISTORY"}
            onClick={() => {
              cancelScan();
              setView("HISTORY");
            }}
          >
            <Receipt size={17} />
            {t("Historique magasin")}
          </button>
          <button
            type="button"
            className="admin-button"
            aria-pressed={view === "REGISTER"}
            onClick={() => {
              cancelScan();
              setView("REGISTER");
            }}
          >
            <Receipt size={17} />
            {t(context.data?.canSell ? "Ma caisse" : "Sessions de caisse")}
          </button>
          <button
            type="button"
            className="admin-button"
            aria-pressed={view === "RETURNS"}
            onClick={() => {
              cancelScan();
              setView("RETURNS");
            }}
          >
            {t("Retours et échanges")}
          </button>
        </div>
      </div>
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
      {message && (
        <p role="status" className="admin-feedback">
          {t(message)}
        </p>
      )}
      {context.data?.canSell && view !== "REGISTER" && cash.isError && (
        <p role="alert" className="admin-alert">
          {t("Session de caisse indisponible. Réessayez.")}{" "}
          <button type="button" onClick={() => void cash.refetch()}>
            {t("Réessayer")}
          </button>
        </p>
      )}
      {context.data?.canSell && view !== "REGISTER" && cash.data?.enabled && !cash.data.active && (
        <p className="admin-alert">
          {t("Votre caisse est clôturée. Ouvrez une session avant la prochaine vente.")}{" "}
          <button type="button" onClick={() => setView("REGISTER")}>
            {t("Ma caisse")}
          </button>
        </p>
      )}
      {view === "RETURNS" ? (
        <PosReturnsPanel
          actorId={context.data!.actorId}
          canReturn={!!context.data?.canReturn}
          initialReference={returnReference}
        />
      ) : view === "REGISTER" ? (
        <PosCashPanel actorId={context.data!.actorId} canSell={!!context.data?.canSell} />
      ) : view === "HISTORY" || !context.data?.canSell ? (
        <PosHistoryPanel
          canReadAll={!!context.data?.canReadAll}
          onReturn={
            context.data?.canReturn
              ? (reference) => {
                  setReturnReference(reference);
                  setView("RETURNS");
                }
              : undefined
          }
        />
      ) : !draft ? (
        <p role="status">{t("Chargement du brouillon…")}</p>
      ) : savedReceipt ? (
        <section className="pos-success admin-panel">
          <header>
            <Check size={26} />
            <h2>{t("Vente encaissée")}</h2>
            <p>{t("Le ticket peut être réimprimé sans créer une nouvelle vente.")}</p>
            <div className="pos-success-actions">
              <Link
                className="admin-button primary"
                target="_blank"
                rel="noopener"
                href={`/admin/pos/receipt/${savedReceipt.id}`}
              >
                {t("Imprimer / PDF")}
              </Link>
              <button type="button" className="admin-button" onClick={newSale}>
                {t("Nouvelle vente")}
              </button>
            </div>
          </header>
          <PosTicket sale={savedReceipt} />
        </section>
      ) : draft.receiptId ? (
        <section className="admin-panel">
          <h2>{t("Vente enregistrée")}</h2>
          {restore.isError ? (
            <p role="alert">
              {t("Ticket indisponible. Vérifiez votre connexion à l’administration.")}
            </p>
          ) : (
            <p role="status">{t("Chargement du ticket…")}</p>
          )}
          <button type="button" className="admin-button" onClick={() => void restore.refetch()}>
            {t("Réessayer")}
          </button>
          <button type="button" className="admin-button" onClick={newSale}>
            {t("Nouvelle vente")}
          </button>
        </section>
      ) : draft.pending ? (
        <section className="admin-panel pos-pending">
          <RefreshCw size={26} />
          <h2>{t("Encaissement à vérifier")}</h2>
          <p>
            {t(
              "Ne créez pas une autre vente. Cette tentative reste conservée jusqu’à sa vérification.",
            )}
          </p>
          <code dir="ltr">{draft.pending.key}</code>
          <p>{posMoney(draft.pending.totalCents, ar)}</p>
          <div className="pos-success-actions">
            <button
              type="button"
              className="admin-button primary"
              disabled={busy}
              onClick={() => void reconcile()}
            >
              {t(busy ? "Vérification…" : "Vérifier cet encaissement")}
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => void submit(draft.pending!)}
            >
              {t("Réessayer le même encaissement")}
            </button>
          </div>
        </section>
      ) : (
        <div className="pos-layout">
          {draft.cart.length > 0 && (
            <a className="pos-mobile-cart-link" href="#pos-cart">
              <ShoppingCart size={18} />
              <span>{t("Voir le panier de caisse")}</span>
              <strong>
                {quote.isFetching ? "…" : quote.data ? posMoney(quote.data.totalCents, ar) : "—"}
              </strong>
            </a>
          )}
          <section className="admin-panel pos-catalog">
            <form className="pos-search" onSubmit={scan}>
              <label htmlFor="pos-search">{t("Nom ou référence SKU")}</label>
              <div>
                <Search size={18} />
                <input
                  id="pos-search"
                  value={search}
                  onChange={(e) => {
                    cancelScan();
                    setSearch(e.target.value);
                  }}
                  placeholder={t("Rechercher ou scanner une référence")}
                  maxLength={120}
                  autoComplete="off"
                />
                <button type="submit" className="admin-button" disabled={frozen || scanning}>
                  {t(scanning ? "Recherche…" : "Rechercher")}
                </button>
              </div>
              <small>{t("Lecteur : scannez une référence SKU puis Entrée.")}</small>
            </form>
            {catalog.isError ? (
              <div className="admin-alert" role="alert">
                {t("Catalogue de caisse indisponible.")}{" "}
                <button type="button" onClick={() => void catalog.refetch()}>
                  {t("Réessayer")}
                </button>
              </div>
            ) : catalog.isPending ? (
              <p role="status">{t("Chargement des articles…")}</p>
            ) : (
              <>
                <p className="admin-scope">
                  {catalog.data?.total ?? 0} {t("variante(s)")}
                </p>
                <div className="pos-catalog-grid">
                  {catalog.data?.data.map((v) => (
                    <article className="pos-product" key={v.id}>
                      <div className="pos-product-image">
                        <ProductPhoto
                          images={v.image ? [v.image] : []}
                          name={ar ? v.nameAr : v.nameFr}
                          thumbnail
                          sizes="140px"
                          className="object-contain"
                        />
                      </div>
                      <div>
                        <h3>{(ar ? v.nameAr : v.nameFr) || v.nameFr}</h3>
                        <p>{[ar ? v.colorAr : v.colorFr, v.size].filter(Boolean).join(" · ")}</p>
                        <small dir="ltr">{v.sku}</small>
                        <strong>{posMoney(v.unitPriceCents, ar)}</strong>
                        <span>
                          {v.available
                            ? t("{count} disponible(s)", { count: v.stock })
                            : t("Indisponible")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="admin-button"
                        aria-label={t("Ajouter {article}", {
                          article: [ar ? v.nameAr : v.nameFr, ar ? v.colorAr : v.colorFr, v.size]
                            .filter(Boolean)
                            .join(" · "),
                        })}
                        disabled={frozen || !v.available}
                        onClick={() => add(v)}
                      >
                        <Plus size={17} />
                        {t("Ajouter")}
                      </button>
                    </article>
                  ))}
                </div>
                {!catalog.data?.data.length && (
                  <p className="admin-empty">{t("Aucun article trouvé.")}</p>
                )}
                {(catalog.data?.totalPages ?? 0) > 1 && (
                  <nav
                    className="admin-inventory-pages"
                    aria-label={t("Navigation du catalogue caisse")}
                  >
                    <button
                      type="button"
                      className="admin-button"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {t("Page précédente")}
                    </button>
                    <span>
                      {t("Page {page} sur {total}", { page, total: catalog.data!.totalPages })}
                    </span>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={page >= catalog.data!.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      {t("Page suivante")}
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
          <aside id="pos-cart" className="admin-panel pos-cart" aria-label={t("Panier de caisse")}>
            <header>
              <h2>{t("Vente en cours")}</h2>
              <button
                type="button"
                className="admin-text-button"
                disabled={frozen || !draft.cart.length}
                onClick={newSale}
              >
                {t("Vider")}
              </button>
            </header>
            <ul>
              {draft.cart.map((i) => {
                const line = quote.data?.lines.find((l) => l.variantId === i.variantId);
                return (
                  <li key={i.variantId}>
                    <div>
                      <strong>
                        {line
                          ? [
                              (ar ? line.nameAr : line.nameFr) || line.nameFr,
                              ar ? line.colorAr : line.colorFr,
                              line.size,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : i.label}
                      </strong>
                      {line && <span>{posMoney(line.totalCents, ar)}</span>}
                    </div>
                    <div className="pos-item-actions">
                      <button
                        type="button"
                        className="admin-button"
                        disabled={frozen}
                        aria-label={t("Réduire la quantité de {article}", { article: i.label })}
                        onClick={() =>
                          editCart((d) => ({
                            ...d,
                            cart: d.cart.flatMap((row) =>
                              row.variantId !== i.variantId
                                ? [row]
                                : row.quantity > 1
                                  ? [{ ...row, quantity: row.quantity - 1 }]
                                  : [],
                            ),
                          }))
                        }
                      >
                        <Minus size={15} />
                      </button>
                      <span aria-live="polite">{i.quantity}</span>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={frozen || i.quantity >= 1000}
                        aria-label={t("Augmenter la quantité de {article}", { article: i.label })}
                        onClick={() =>
                          editCart((d) => ({
                            ...d,
                            cart: d.cart.map((row) =>
                              row.variantId === i.variantId
                                ? { ...row, quantity: row.quantity + 1 }
                                : row,
                            ),
                          }))
                        }
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button"
                        disabled={frozen}
                        aria-label={t("Retirer {article}", { article: i.label })}
                        onClick={() =>
                          editCart((d) => ({
                            ...d,
                            cart: d.cart.filter((row) => row.variantId !== i.variantId),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!draft.cart.length && (
              <p className="pos-empty">{t("Ajoutez un article pour commencer.")}</p>
            )}
            {quote.isError && (
              <p className="admin-alert" role="alert">
                {t(problem(quote.error))}{" "}
                <button type="button" onClick={() => void quote.refetch()}>
                  {t("Réessayer")}
                </button>
              </p>
            )}
            {draft.cart.length > 0 && (
              <>
                <div className="pos-cart-total">
                  <span>{t("Total à encaisser")}</span>
                  <strong>
                    {quote.isPending || quote.isFetching
                      ? "…"
                      : quote.data
                        ? posMoney(quote.data.totalCents, ar)
                        : "—"}
                  </strong>
                  {!!quote.data?.savingsCents && (
                    <small>
                      {t("Remises par quantité")} : −{posMoney(quote.data.savingsCents, ar)}
                    </small>
                  )}
                </div>
                <label>
                  {t("Mode de paiement")}
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                    disabled={frozen}
                  >
                    <option value="CASH">{t("Espèces")}</option>
                    <option value="CARD_TERMINAL">{t("Carte — TPE externe")}</option>
                  </select>
                </label>
                {method === "CASH" ? (
                  <>
                    <label htmlFor="pos-received">{t("Montant reçu (MAD)")}</label>
                    <input
                      id="pos-received"
                      inputMode="decimal"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder="0,00"
                      disabled={frozen}
                    />
                    <p>
                      {t("Monnaie à rendre")} :{" "}
                      <strong>{change !== null && change >= 0 ? posMoney(change, ar) : "—"}</strong>
                    </p>
                  </>
                ) : (
                  <p className="admin-scope">
                    {t(
                      "Validez uniquement après le paiement réussi sur votre TPE. La caisse ne débite aucune carte.",
                    )}
                  </p>
                )}
                <button
                  type="button"
                  className="admin-button primary pos-pay"
                  disabled={
                    !cash.data ||
                    cash.isFetching ||
                    cash.isError ||
                    (cash.data.enabled && !cash.data.active) ||
                    frozen ||
                    quote.isPending ||
                    quote.isFetching ||
                    quote.isError ||
                    !quote.data ||
                    amount === null ||
                    amount < quote.data.totalCents
                  }
                  onClick={() => void submit()}
                >
                  {t("Valider l’encaissement")}
                </button>
                <p className="admin-scope">
                  {t("Le stock et les prix sont vérifiés au moment de l’encaissement.")}
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
