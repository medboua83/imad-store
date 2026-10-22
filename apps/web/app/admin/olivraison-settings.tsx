"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  getOlivraisonConfig,
  saveOlivraisonConfig,
  deleteOlivraisonConfig,
  testOlivraison,
  getOlivraisonShipments,
  retryOlivraison,
  type OlivraisonConfig,
  type OlivraisonShipment,
} from "@/lib/api";

type CityRow = { id: string; source: string; target: string };
const cityRows = (mapping: Record<string, string>): CityRow[] =>
  Object.entries(mapping).map(([source, target]) => ({ id: `saved-${source}`, source, target }));

export function OlivraisonSettings() {
  const [config, setConfig] = useState<OlivraisonConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<OlivraisonConfig | null>(null);
  const [shipments, setShipments] = useState<OlivraisonShipment[]>([]);
  const [keys, setKeys] = useState({ apiKey: "", secretKey: "" });
  const [mapping, setMapping] = useState<CityRow[]>([]);
  const cityListId = useId();
  const nextCityId = useRef(0);
  const [cities, setCities] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [editing, setEditing] = useState(false);
  function openEditor(c: OlivraisonConfig) {
    setConfig(structuredClone(c));
    setMapping(cityRows(c.cityMapping));
    setKeys({ apiKey: "", secretKey: "" });
    setCities([]);
    setEditing(true);
  }
  async function refreshShipments() {
    setShipments(await getOlivraisonShipments());
  }
  useEffect(() => {
    let active = true;
    getOlivraisonConfig()
      .then((c) => {
        if (!active) return;
        if (typeof c.enabled !== "boolean" || !c.pickupAddress || !c.cityMapping)
          throw new Error("Invalid carrier config");
        setConfig(c);
        setSavedConfig(c);
        setEditing(!c.saved);
        setMapping(cityRows(c.cityMapping));
      })
      .catch(() => {
        if (active) setMessage("Configuration Olivraison indisponible. Rechargez la page.");
      });
    getOlivraisonShipments()
      .then((rows) => {
        if (active) setShipments(rows);
      })
      .catch(() => {});
    const timer = setInterval(() => {
      getOlivraisonShipments()
        .then((rows) => {
          if (active) setShipments(rows);
        })
        .catch(() => {});
    }, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function action(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setMessage(
        e.response?.data?.error || (err instanceof Error ? err.message : "Opération impossible"),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="olivraison-title" className="olivraison-settings">
      <h2 id="olivraison-title">Olivraison — automatisation des colis</h2>
      <p>
        Les nouvelles commandes confirmées sont envoyées automatiquement : création du colis,
        confirmation et suivi toutes les cinq minutes environ. Aucune ancienne commande n’est
        envoyée.
      </p>
      {savedConfig?.saved && !editing && (
        <div className="admin-feedback" role="status">
          <strong>Société de livraison enregistrée : Olivraison</strong>
          {savedConfig.pickupAddress.company && (
            <p>Entreprise de ramassage enregistrée : {savedConfig.pickupAddress.company}</p>
          )}
          <p>
            {savedConfig.configured
              ? "Vos clés API sont enregistrées et chiffrées. Les champs vides ne les effacent pas."
              : "Enregistrez les deux clés API pour compléter le compte transporteur."}
          </p>
          <p>
            Automatisation enregistrée : {savedConfig.enabled ? "activée" : "désactivée"}
            {" · "}Ramassage automatique : {savedConfig.autoPickup ? "activé" : "désactivé"}
          </p>
          <p>
            Adresse de ramassage : {savedConfig.pickupAddress.streetAddress},{" "}
            {savedConfig.pickupAddress.city}
          </p>
          <p>Correspondances des villes : {Object.keys(savedConfig.cityMapping).length}</p>
          <div className="admin-actions">
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => openEditor(savedConfig)}
            >
              Modifier
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Supprimer la configuration Olivraison et ses clés API ? L’automatisation sera arrêtée. Les commandes et l’historique des colis seront conservés, sans annuler les colis chez le transporteur. Les anciens colis ne seront pas relancés après reconnexion.",
                  )
                )
                  return;
                void action(async () => {
                  const empty = await deleteOlivraisonConfig();
                  setSavedConfig(empty);
                  openEditor(empty);
                  setMessage("Configuration Olivraison supprimée.");
                });
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="admin-feedback">
          {message}
        </p>
      )}
      {config && editing && (
        <form
          className="commerce-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const entries: [string, string][] = [];
              const sources = new Set<string>();
              mapping.forEach((row, index) => {
                const source = row.source.trim(),
                  target = row.target.trim();
                if (!source && !target) return;
                if (!source || !target)
                  throw new Error(
                    `Ligne ${index + 1} : renseignez les deux villes ou retirez cette ligne.`,
                  );
                if (sources.has(source))
                  throw new Error(`La ville « ${source} » figure déjà dans une autre ligne.`);
                sources.add(source);
                entries.push([source, target]);
              });
              const cityMapping = Object.fromEntries(entries);
              const result = await saveOlivraisonConfig({
                enabled: config.enabled,
                autoPickup: config.autoPickup,
                pickupAddress: config.pickupAddress,
                cityMapping,
                ...(keys.apiKey || keys.secretKey ? keys : {}),
              });
              setConfig(result);
              setSavedConfig(result);
              setEditing(false);
              setKeys({ apiKey: "", secretKey: "" });
              setMessage("Configuration Olivraison enregistrée.");
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Activation et compte transporteur</legend>
            <label className="admin-option-check">
              <input
                type="checkbox"
                role="switch"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />{" "}
              Automatiser Olivraison
            </label>
            <p>
              {config.configured
                ? "Clés enregistrées et chiffrées. Laissez les champs vides pour les conserver."
                : "Renseignez les clés de votre compte partenaire Olivraison."}
            </p>
            <label>
              Clé API
              <input
                type="password"
                autoComplete="new-password"
                value={keys.apiKey}
                onChange={(e) => setKeys({ ...keys, apiKey: e.target.value })}
              />
            </label>
            <label>
              Clé secrète
              <input
                type="password"
                autoComplete="new-password"
                value={keys.secretKey}
                onChange={(e) => setKeys({ ...keys, secretKey: e.target.value })}
              />
            </label>
            <label className="admin-option-check">
              <input
                type="checkbox"
                checked={config.autoPickup}
                onChange={(e) => setConfig({ ...config, autoPickup: e.target.checked })}
              />{" "}
              Demander automatiquement le ramassage et les bordereaux
            </label>
            <p>
              En activant le ramassage automatique, les colis sont déclarés prêts au transporteur.
              Vous devez préparer les produits et imprimer les bordereaux.
            </p>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Adresse de ramassage</legend>
            {(
              [
                ["company", "Entreprise"],
                ["streetAddress", "Adresse"],
                ["city", "Ville"],
                ["phone", "Téléphone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required
                  maxLength={124}
                  value={config.pickupAddress[key]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pickupAddress: { ...config.pickupAddress, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset disabled={busy} className="carrier-cities">
            <legend>Correspondance des villes (facultatif)</legend>
            <p id={`${cityListId}-help`}>
              Ajoutez une ligne seulement si une ville porte un nom différent chez Olivraison. Si
              les noms correspondent, laissez cette liste vide.
            </p>
            <p>
              Dans la première colonne, indiquez le nom utilisé dans la boutique. Dans la seconde,
              indiquez le nom exact reconnu par Olivraison.
            </p>
            {mapping.length === 0 && (
              <p className="carrier-cities-empty">Aucune correspondance ajoutée.</p>
            )}
            {mapping.map((row, index) => (
              <div key={row.id} className="carrier-city-row">
                <label>
                  Ville sur la boutique
                  <input
                    aria-label={`Ville sur la boutique ${index + 1}`}
                    aria-describedby={`${cityListId}-help`}
                    maxLength={124}
                    placeholder="Ex. : طنجة ou Tanger"
                    value={row.source}
                    onChange={(e) =>
                      setMapping(
                        mapping.map((r) =>
                          r.id === row.id ? { ...r, source: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Ville chez Olivraison
                  <input
                    aria-label={`Ville chez Olivraison ${index + 1}`}
                    maxLength={124}
                    list={cityListId}
                    placeholder="Nom exact du transporteur"
                    value={row.target}
                    onChange={(e) =>
                      setMapping(
                        mapping.map((r) =>
                          r.id === row.id ? { ...r, target: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="admin-button"
                  aria-label={`Retirer la ligne ${index + 1}`}
                  onClick={() => setMapping(mapping.filter((r) => r.id !== row.id))}
                >
                  Retirer
                </button>
              </div>
            ))}
            <datalist id={cityListId}>
              {cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            <button
              type="button"
              className="admin-button"
              disabled={mapping.length >= 300}
              onClick={() =>
                setMapping([
                  ...mapping,
                  { id: `new-${nextCityId.current++}`, source: "", target: "" },
                ])
              }
            >
              Ajouter une ville
            </button>
            <p>
              {cities.length
                ? `${cities.length} villes Olivraison disponibles en suggestion. Tapez les premières lettres dans le champ de droite.`
                : "Après enregistrement du compte, utilisez « Tester la connexion et charger les villes » pour obtenir les suggestions."}
            </p>
          </fieldset>
          {savedConfig?.saved && (
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => {
                openEditor(savedConfig);
                setEditing(false);
              }}
            >
              Annuler
            </button>
          )}
          <button className="admin-button primary" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer Olivraison"}
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={busy || !config.configured}
            onClick={() =>
              void action(async () => {
                const result = await testOlivraison();
                setCities(result.map((c) => c.name));
                setMessage("Connexion réussie. Aucun colis créé.");
              })
            }
          >
            Tester la connexion et charger les villes
          </button>
          {cities.length > 0 && (
            <details>
              <summary>Villes disponibles ({cities.length})</summary>
              <p>{cities.join(" · ")}</p>
            </details>
          )}
        </form>
      )}
      <h3>Colis et suivi</h3>
      <button
        className="admin-button"
        disabled={busy}
        onClick={() => void action(refreshShipments)}
      >
        Actualiser
      </button>
      {shipments.length === 0 && <p>Aucun colis automatique pour le moment.</p>}
      <div className="olivraison-grid">
        {shipments.map((s) => (
          <article key={s.id} className="olivraison-card">
            <strong>Commande #{s.id.slice(-8).toUpperCase()}</strong>
            <p>Suivi : {s.trackingId || "En attente de création"}</p>
            <p>
              Olivraison : {s.carrierStatus || "—"} ·{" "}
              {(
                {
                  QUEUED: "En file",
                  ACTIVE: "Suivi automatique",
                  RETRY: "Nouvelle tentative prévue",
                  ATTENTION: "À vérifier",
                  DONE: "Terminé",
                  DISCONNECTED: "Suivi retiré",
                } as Record<string, string>
              )[s.state] || s.state}
            </p>
            {s.lastError && <p role="status">{s.lastError}</p>}
            <p>
              {s.stickerUrl && (
                <a href={s.stickerUrl} target="_blank" rel="noopener noreferrer">
                  Étiquette
                </a>
              )}{" "}
              {s.slipUrl && (
                <a href={s.slipUrl} target="_blank" rel="noopener noreferrer">
                  Bordereau de ramassage
                </a>
              )}
            </p>
            {["ACTIVE", "RETRY", "ATTENTION"].includes(s.state) && (
              <button
                className="admin-button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await retryOlivraison(s.id);
                    await refreshShipments();
                    setMessage(
                      "Rapprochement planifié. Un ramassage incertain ne sera pas relancé automatiquement.",
                    );
                  })
                }
              >
                Revérifier le colis
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
