"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The labeled horizontal table region needs keyboard focus for scrolling. */
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  META_URL_PARAMETERS,
  type MediaConnection,
  type MediaReport,
  type MediaRecommendation,
} from "@imad-store/shared";
import { adminApi } from "@/lib/api";
import { useAdminLocale } from "./admin-locale";
import { mediaArabic } from "./media-buyer-translations";
import "./media-buyer.css";

type Filters = { from: string; to: string; campaignId: string; adsetId: string; adId: string };
const blank: Filters = { from: "", to: "", campaignId: "", adsetId: "", adId: "" };
function week(today: string) {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}
function errorText(e: unknown) {
  return isAxiosError(e) && typeof e.response?.data?.error === "string"
    ? e.response.data.error
    : "Résultat incertain. Actualisez les réglages avant de réessayer.";
}
const actions: Record<MediaRecommendation["action"], string> = {
  sync: "Compléter les données Meta",
  target: "Définir le coût cible",
  currency: "Vérifier la devise",
  review: "Examiner les incidents",
  test: "Continuer le test",
  cost: "Examiner le coût",
  scale: "Envisager une hausse du budget",
};
const reasons: Record<string, string> = {
  connect: "Connectez le compte publicitaire pour vérifier les dépenses.",
  missing_spend: "La période n’est pas entièrement synchronisée.",
  stale_sync: "Les dépenses datent de plus de 48 h ou une erreur de connexion reste à résoudre.",
  target_missing: "Renseignez votre coût cible par commande livrée en MAD.",
  currency_mismatch:
    "Le compte n’est pas en MAD. Une conversion fiable est nécessaire pour comparer le coût cible.",
  tracking_review:
    "Des statuts de livraison sont incohérents ou inconnus. Vérifiez-les avant de décider.",
  unknown_sources:
    "Plus de 20 % des commandes de la période ont une source inconnue. L’attribution est trop incomplète pour conseiller une hausse.",
  returns_high:
    "Au moins 5 commandes et 25 % du groupe sont annulées ou retournées. Examinez le ciblage et la confirmation.",
  no_spend: "Il manque des dépenses ou des commandes attribuées pour évaluer cette campagne.",
  pending_orders:
    "Plus de 20 % des commandes sont encore non résolues, ou moins de 70 % ont au moins 7 jours. Attendez davantage de livraisons.",
  cost_below_target:
    "Au moins 20 commandes, dont 10 livrées, un groupe assez ancien et un coût inférieur à 80 % du coût cible : une hausse prudente peut être envisagée.",
  cost_high:
    "Au moins 5 commandes livrées et un coût supérieur à 125 % du coût cible : examinez la campagne avant d’ajouter du budget.",
  few_deliveries:
    "Visez au moins 20 commandes attribuées et 10 livrées avant d’envisager une hausse.",
  continue_test:
    "Le coût ne justifie pas encore une hausse selon le seuil de prudence retenu. Continuez à observer les livraisons.",
};

export default function MediaBuyerTab() {
  const { locale } = useAdminLocale();
  const t = (s: string) => (locale === "ar" ? (mediaArabic[s] ?? s) : s);
  const [cfg, setCfg] = useState<MediaConnection | null>(null),
    [report, setReport] = useState<MediaReport | null>(null);
  const [draft, setDraft] = useState<Filters>(blank),
    [query, setQuery] = useState<Filters | null>(null),
    [version, setVersion] = useState(0);
  const [readError, setReadError] = useState(""),
    [writeError, setWriteError] = useState(""),
    [notice, setNotice] = useState("");
  const [reading, setReading] = useState(true),
    [busy, setBusy] = useState(false),
    [copy, setCopy] = useState(false);
  const [account, setAccount] = useState(""),
    [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [target, setTarget] = useState("");
  const lock = useRef(false),
    mounted = useRef(true),
    accountContext = useRef("");
  const money = (v: string | null, currency = report?.currency ?? cfg?.currency) =>
    v === null || !currency
      ? "—"
      : new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
          style: "currency",
          currency,
        }).format(Number(v));
  const date = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: cfg?.timeZone ?? "Africa/Casablanca",
        }).format(new Date(v))
      : "—";
  function accept(value: MediaConnection) {
    if (!mounted.current) return;
    const context = [value.accountId, value.currency, value.timeZone].join(":");
    if (accountContext.current !== context) {
      accountContext.current = context;
      const initial = { ...blank, from: week(value.today), to: value.today };
      setDraft(initial);
      setQuery(initial);
      setReport(null);
    }
    setCfg(value);
    setAccount(value.accountId ?? "");
    setTarget(value.targetCents === null ? "" : (value.targetCents / 100).toFixed(2));
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    adminApi
      .get<{ data: MediaConnection }>("/media-buyer/connection", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) accept(r.data.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setReadError(errorText(e));
          setReading(false);
        }
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
    // Connection is read once; refresh and successful writes explicitly re-read it.
  }, []);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setReading(true);
        setReadError("");
        setReport(null);
      }
    });
    const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v));
    adminApi
      .get<{ data: MediaReport }>("/media-buyer/report", { params, signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setReport(r.data.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setReadError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setReading(false);
      });
    return () => controller.abort();
  }, [query, version, cfg?.accountId, cfg?.currency, cfg?.timeZone]);
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setWriteError("");
    try {
      accept((await adminApi.get<{ data: MediaConnection }>("/media-buyer/connection")).data.data);
      setVersion((v) => v + 1);
    } catch (e) {
      setWriteError(errorText(e));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function write(path: string, body: object, method: "post" | "put" = "post") {
    if (lock.current || !cfg) return;
    lock.current = true;
    setBusy(true);
    setWriteError("");
    setNotice("");
    setReport(null);
    try {
      await adminApi[method](
        "/media-buyer/" + path,
        { ...body, revision: cfg.revision },
        { timeout: path === "sync" ? 120000 : 40000 },
      );
      if (mounted.current)
        setNotice(
          path === "sync"
            ? "Dépenses synchronisées. Aucun budget n’a été modifié."
            : "Réglages enregistrés.",
        );
    } catch (e) {
      if (mounted.current) setWriteError(errorText(e));
    } finally {
      // Never retain credentials after an uncertain write, and never retry a write automatically.
      if (mounted.current) {
        setToken("");
        setPassword("");
        setCode("");
      }
      try {
        accept(
          (await adminApi.get<{ data: MediaConnection }>("/media-buyer/connection")).data.data,
        );
      } catch {
        if (mounted.current) {
          setCfg(null);
          setReadError("Actualisez les réglages avant de poursuivre.");
        }
      }
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setVersion((v) => v + 1);
      }
    }
  }
  const choices = report?.accountId === cfg?.accountId ? (report?.choices ?? []) : [];
  const campaigns = [...new Map(choices.map((a) => [a.campaignId, a.campaignName])).entries()];
  const adsets = [
    ...new Map(
      choices
        .filter((a) => !draft.campaignId || a.campaignId === draft.campaignId)
        .map((a) => [a.adsetId, a.adsetName]),
    ).entries(),
  ];
  const ads = choices.filter(
    (a) =>
      (!draft.campaignId || a.campaignId === draft.campaignId) &&
      (!draft.adsetId || a.adsetId === draft.adsetId),
  );
  const current = report && report.accountId === cfg?.accountId ? report : null;
  const dirty =
    query !== null &&
    Object.keys(draft).some((k) => draft[k as keyof Filters] !== query[k as keyof Filters]);
  return (
    <div className="media-buyer" aria-busy={reading || busy}>
      <section className="admin-panel media-heading">
        <div>
          <span className="media-eyebrow">META ADS · FACEBOOK &amp; INSTAGRAM</span>
          <h2>{t("De la publicité à la livraison")}</h2>
          <p>
            {t(
              "Mesurez le coût des commandes réellement livrées, sans confondre commande créée et argent encaissé.",
            )}
          </p>
        </div>
        <button type="button" className="admin-button" onClick={refresh} disabled={busy}>
          {t("Actualiser")}
        </button>
      </section>
      {writeError && (
        <p className="admin-alert" role="alert">
          {t(writeError)}
        </p>
      )}
      {notice && (
        <p className="media-notice" role="status">
          {t(notice)}
        </p>
      )}
      {readError && (
        <p className="admin-alert" role="alert">
          {t(readError)}
        </p>
      )}
      {cfg && (
        <>
          {current && (
            <>
              <p className="admin-scope">
                {t("Rapport affiché")} :{" "}
                <bdi>
                  {current.from} → {current.to}
                </bdi>{" "}
                · <bdi>{current.timeZone}</bdi>
              </p>
              {!current.coverage.complete && (
                <p className="admin-alert">
                  {t(
                    "Dépenses incomplètes : synchronisez toute la période avant de comparer les coûts.",
                  )}{" "}
                  {current.coverage.missingDays} {t("jour(s) manquant(s)")}
                </p>
              )}
              <div className="media-kpis">
                {[
                  ["Dépenses", money(current.totals.spend)],
                  ["Commandes attribuées", current.totals.attributed],
                  ["Livrées à ce jour", current.totals.delivered],
                  ["Coût par commande livrée", money(current.totals.costPerDelivered)],
                ].map(([label, value]) => (
                  <section className="admin-panel" key={label}>
                    <h3>{t(String(label))}</h3>
                    <strong>{value}</strong>
                  </section>
                ))}
              </div>
              <p className="media-method">
                {t(
                  "Dépenses de la période ÷ commandes créées pendant cette période et livrées à ce jour. Un retour retire la commande des livrées, même après livraison.",
                )}
              </p>
            </>
          )}
          <section className="admin-panel">
            <div className="media-connection-line">
              <strong>{cfg.accountName ?? t("Aucun compte publicitaire connecté")}</strong>
              <span className={`media-pill ${cfg.connected ? "is-connected" : ""}`}>
                {t(cfg.connected ? "Connecté en lecture seule" : "Non connecté")}
              </span>
            </div>
            <p className="admin-scope">
              {cfg.accountId && <bdi>act_{cfg.accountId} · </bdi>}
              {cfg.currency ?? "—"} · <bdi>{cfg.timeZone}</bdi> · {t("Dernière synchronisation")} :{" "}
              {date(cfg.lastSyncAt)}
            </p>
            {cfg.lastError && (
              <p className="admin-alert" role="alert">
                {t(cfg.lastError)}
              </p>
            )}
            {!cfg.connected && cfg.accountId && (
              <p>
                {t(
                  "Les chiffres conservés restent consultables. Reconnectez le compte pour actualiser les dépenses.",
                )}
              </p>
            )}
            <form
              className="media-filters"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.from || !draft.to) return;
                setReport(null);
                setQuery({ ...draft });
                setVersion((v) => v + 1);
              }}
            >
              <fieldset disabled={busy || reading}>
                <label>
                  {t("Du")}
                  <input
                    aria-label={t("Du")}
                    type="date"
                    required
                    value={draft.from}
                    max={draft.to || cfg.today}
                    onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                  />
                </label>
                <label>
                  {t("Au")}
                  <input
                    aria-label={t("Au")}
                    type="date"
                    required
                    value={draft.to}
                    min={draft.from}
                    max={cfg.today}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                  />
                </label>
                <label>
                  {t("Campagne")}
                  <select
                    value={draft.campaignId}
                    onChange={(e) =>
                      setDraft({ ...draft, campaignId: e.target.value, adsetId: "", adId: "" })
                    }
                  >
                    <option value="">{t("Toutes les campagnes")}</option>
                    {campaigns.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name} · {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Ensemble de publicités")}
                  <select
                    value={draft.adsetId}
                    onChange={(e) => setDraft({ ...draft, adsetId: e.target.value, adId: "" })}
                  >
                    <option value="">{t("Tous les ensembles")}</option>
                    {adsets.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name} · {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Publicité")}
                  <select
                    value={draft.adId}
                    onChange={(e) => setDraft({ ...draft, adId: e.target.value })}
                  >
                    <option value="">{t("Toutes les publicités")}</option>
                    {ads.map((a) => (
                      <option key={a.adId} value={a.adId}>
                        {a.adName} · {a.adId}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="admin-button primary">{t("Afficher")}</button>
              </fieldset>
            </form>
            <p className="admin-scope">
              {t(
                "Jusqu’à 90 jours. Dates selon le fuseau du compte Meta. Les commandes sont regroupées par date de création.",
              )}
            </p>
            {cfg.canManage && (
              <button
                type="button"
                className="admin-button"
                disabled={busy || reading || !query || !cfg.connected || cfg.syncing || dirty}
                onClick={() => query && write("sync", { from: query.from, to: query.to })}
              >
                {t(
                  cfg.syncing || busy
                    ? "Opération en cours…"
                    : "Synchroniser les dépenses de cette période",
                )}
              </button>
            )}
          </section>
          {dirty && (
            <p className="media-method">
              {t("Filtres modifiés : cliquez sur Afficher pour les appliquer.")}
            </p>
          )}
          {reading && <p role="status">{t("Chargement du rapport…")}</p>}
          {current && (
            <>
              <section className="admin-panel media-delivery-notes">
                <h3>{t("Laissez le temps aux livraisons")}</h3>
                <div className="media-inline-counts">
                  <span>
                    {t("En livraison")} <strong>{current.totals.inDelivery}</strong>
                  </span>
                  <span>
                    {t("En attente")} <strong>{current.totals.awaiting}</strong>
                  </span>
                  <span>
                    {t("Retour en cours")} <strong>{current.totals.returning}</strong>
                  </span>
                  <span>
                    {t("Statut à vérifier")} <strong>{current.totals.review}</strong>
                  </span>
                </div>
                <p>
                  {t(
                    "Les chiffres peuvent encore évoluer. Les commandes récentes ne suffisent pas à juger une publicité.",
                  )}
                </p>
              </section>
              <section className="admin-panel">
                <h3>{t("Performances par publicité")}</h3>
                <p className="admin-scope">
                  {t(
                    "Les noms peuvent changer : les identifiants Meta conservent le rapprochement.",
                  )}
                </p>
                {!current.ads.length ? (
                  <p>
                    {t(
                      "Aucune publicité avec des dépenses ou des commandes attribuées sur cette période. Connectez puis synchronisez Meta si nécessaire.",
                    )}
                  </p>
                ) : (
                  <div
                    className="media-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label={t("Performances par publicité")}
                  >
                    <table className="media-table">
                      <thead>
                        <tr>
                          {[
                            "Publicité",
                            "Dépenses",
                            "Attribuées",
                            "Confirmées",
                            "Livrées",
                            "Annulées",
                            "Retournées",
                            "En livraison",
                            "Coût / livrée",
                          ].map((k) => (
                            <th key={k}>{t(k)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {current.ads.map((a) => (
                          <tr key={a.adId}>
                            <th scope="row">
                              <strong>{a.adName}</strong>
                              <small>
                                {a.campaignName} / {a.adsetName}
                              </small>
                              <small>
                                <bdi>ID {a.adId}</bdi>
                              </small>
                            </th>
                            <td>{money(a.spend)}</td>
                            <td>{a.attributed}</td>
                            <td>{a.confirmed}</td>
                            <td>{a.delivered}</td>
                            <td>{a.cancelled}</td>
                            <td>{a.returned}</td>
                            <td>{a.inDelivery}</td>
                            <td>
                              <strong>{money(a.costPerDelivered)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="admin-scope">
                  {t(
                    "Confirmées = confirmation atteinte. Les autres colonnes décrivent l’issue actuelle ; elles ne s’additionnent pas aux confirmations. Les retours en cours et statuts à vérifier figurent ci-dessus.",
                  )}
                </p>
              </section>
              <section className="admin-panel media-unknown">
                <h3>
                  {t("Source inconnue")}{" "}
                  <span className="media-pill">{current.unknown.attributed}</span>
                </h3>
                <p>
                  {t(
                    "Anciennes commandes, refus du suivi, attribution expirée ou identifiants non rapprochés. Ce total couvre toute la période, hors filtres publicitaires.",
                  )}
                </p>
                <p>
                  {t("Livrées")} : {current.unknown.delivered} · {t("Annulées")} :{" "}
                  {current.unknown.cancelled} · {t("Retournées")} : {current.unknown.returned}
                </p>
                {current.unknownWithAdId > 0 && (
                  <p>
                    {current.unknownWithAdId}{" "}
                    {t(
                      "commande(s) portent un identifiant publicitaire non rapproché. Vérifiez le compte et la période synchronisée.",
                    )}
                  </p>
                )}
              </section>
              <section className="admin-panel">
                <h3>{t("Recommandations")}</h3>
                <p>
                  {t(
                    "Chaque carte porte sur toute la campagne sélectionnée, indépendamment des filtres ensemble et publicité.",
                  )}
                </p>
                <p className="media-target">
                  {t("Coût cible")} :{" "}
                  <strong>
                    {current.targetCents === null
                      ? "—"
                      : money((current.targetCents / 100).toString(), "MAD")}
                  </strong>
                </p>
                {current.currency && current.currency !== "MAD" && (
                  <p className="admin-alert">
                    {t(
                      "Le compte n’est pas en MAD. Une conversion fiable est nécessaire pour comparer le coût cible.",
                    )}
                  </p>
                )}
                <div className="media-recommendations">
                  {current.recommendations.map((r) => (
                    <article
                      className={`media-recommendation media-action-${r.action}`}
                      key={r.campaignId}
                    >
                      <small>
                        {r.campaignName} · <bdi>{r.campaignId}</bdi>
                      </small>
                      <h4>{t(actions[r.action])}</h4>
                      <p>
                        {t("Dépenses")} : {money(r.spend)} · {t("Coût / livrée")} :{" "}
                        {money(r.costPerDelivered)}
                      </p>
                      <p>
                        {r.counts.attributed} {t("attribuées")} · {r.counts.delivered}{" "}
                        {t("livrées")} · {r.counts.cancelled} {t("annulées")} · {r.counts.returned}{" "}
                        {t("retournées")} · {r.counts.mature} {t("âgées d’au moins 7 jours")}
                      </p>
                      <p>
                        {r.counts.awaiting +
                          r.counts.inDelivery +
                          r.counts.returning +
                          r.counts.review}{" "}
                        {t("encore non résolues")}
                      </p>
                      {r.reasons.map((reason) => (
                        <p key={reason}>{t(reasons[reason] ?? reasons.continue_test)}</p>
                      ))}
                    </article>
                  ))}
                </div>
                {!current.recommendations.length && (
                  <p>
                    {t(
                      "Synchronisez les dépenses et collectez des commandes attribuées pour obtenir des recommandations.",
                    )}
                  </p>
                )}
                <p className="media-method">
                  {t(
                    "Conseils uniquement. Aucune publicité n’est publiée ou mise en pause, et aucun budget Meta n’est modifié. Toute action exige votre validation explicite.",
                  )}
                </p>
              </section>
              <p className="admin-scope">
                {t(
                  "Chiffre d’affaires encaissé non affiché : le statut livré ne prouve pas le reversement des espèces par le transporteur.",
                )}
              </p>
            </>
          )}
          <section className="admin-panel">
            <h3>{t("Relier vos prochaines publicités aux commandes")}</h3>
            <p>
              {t(
                "Dans Meta Ads Manager, ouvrez la publicité → Suivi → Paramètres de l’URL, puis collez ce modèle sans ajouter de point d’interrogation.",
              )}
            </p>
            <textarea
              className="media-template"
              aria-label={t("Paramètres de l’URL Meta")}
              readOnly
              dir="ltr"
              rows={4}
              value={META_URL_PARAMETERS}
            />
            <button
              type="button"
              className="admin-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(META_URL_PARAMETERS);
                  setCopy(true);
                } catch {
                  setCopy(false);
                  setNotice("Sélectionnez le modèle puis copiez-le manuellement.");
                }
              }}
            >
              {t(copy ? "Modèle copié" : "Copier le modèle")}
            </button>
            <p>
              {t(
                "Règle : dernière visite avec paramètres publicitaires dans les 30 jours, après consentement. Une visite directe conserve la source sans prolonger le délai. Un nouveau lien remplace l’ensemble des identifiants ; aucune source n’est devinée.",
              )}
            </p>
            <p className="admin-scope">
              {t(
                "L’attribution de commande expire après 90 jours. Les dépenses restent conservées ; les cohortes anciennes peuvent donc devenir incomplètes. Ce rapport n’est pas l’attribution officielle de Meta et les paramètres d’URL ne prouvent pas un clic facturé.",
              )}
            </p>
          </section>
          {cfg.canManage && (
            <section className="admin-panel">
              <h3>{t("Réglages Media Buyer")}</h3>
              <form
                className="media-target-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const normalized = target.trim().replace(",", ".");
                  if (normalized && !/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) {
                    setWriteError("Saisissez un montant en MAD avec au maximum deux décimales.");
                    return;
                  }
                  const cents = normalized ? Math.round(Number(normalized) * 100) : null;
                  if (
                    cents !== null &&
                    (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000)
                  ) {
                    setWriteError("Saisissez un coût cible entre 0,01 et 1 000 000 MAD.");
                    return;
                  }
                  void write("target", { targetCents: cents }, "put");
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    {t("Coût cible par commande livrée (MAD)")}
                    <input
                      inputMode="decimal"
                      maxLength={12}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="50,00"
                    />
                  </label>
                  <button className="admin-button">{t("Enregistrer le coût cible")}</button>
                </fieldset>
              </form>
              <details className="media-connect">
                <summary>{t("Connexion au compte Meta Ads")}</summary>
                <p>
                  {t(
                    "Un administrateur du compte doit fournir un jeton avec ads_read et l’accès à ce compte. Le jeton est chiffré sur le serveur, jamais renvoyé au navigateur. Aucun accès à la modification des publicités n’est demandé.",
                  )}
                </p>
                <a
                  href="https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Guide officiel des autorisations Meta")}
                </a>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void write("connection", {
                      accountId: account.trim(),
                      token: token.trim(),
                      currentPassword: password,
                      ...(code.trim() ? { code: code.trim() } : {}),
                    });
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      {t("Identifiant du compte publicitaire")}
                      <input
                        required
                        dir="ltr"
                        autoComplete="off"
                        maxLength={29}
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                        placeholder="act_123456789012345"
                      />
                    </label>
                    <label>
                      {t("Jeton d’accès Meta")}
                      <input
                        type="password"
                        autoComplete="off"
                        required={
                          !cfg.connected || account.trim().replace(/^act_/, "") !== cfg.accountId
                        }
                        maxLength={4096}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </label>
                    <p className="admin-scope">
                      {t(
                        "Laissez vide pour conserver le jeton du même compte. Ne collez jamais un jeton dans une URL ou dans le chat.",
                      )}
                    </p>
                    <label>
                      {t("Mot de passe actuel")}
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    {cfg.mfaEnabled && (
                      <label>
                        {t("Code Authenticator ou code de secours")}
                        <input
                          autoComplete="one-time-code"
                          required
                          maxLength={80}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                      </label>
                    )}
                    <div className="media-form-actions">
                      <button className="admin-button primary">{t("Vérifier et connecter")}</button>
                      {cfg.connected && (
                        <button
                          type="button"
                          className="admin-button"
                          disabled={!password || (cfg.mfaEnabled && !code)}
                          onClick={() =>
                            write("disconnect", {
                              currentPassword: password,
                              ...(code.trim() ? { code: code.trim() } : {}),
                            })
                          }
                        >
                          {t("Déconnecter le compte")}
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}
