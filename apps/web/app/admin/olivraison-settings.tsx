"use client";
import { useEffect, useRef, useState } from "react";
import {
  getOlivraisonConfig,
  saveOlivraisonConfig,
  testOlivraison,
  getOlivraisonShipments,
  retryOlivraison,
  type OlivraisonConfig,
  type OlivraisonShipment,
} from "@/lib/api";

export function OlivraisonSettings() {
  const [config, setConfig] = useState<OlivraisonConfig | null>(null);
  const [shipments, setShipments] = useState<OlivraisonShipment[]>([]);
  const [keys, setKeys] = useState({ apiKey: "", secretKey: "" });
  const [mapping, setMapping] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
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
        setMapping(
          Object.entries(c.cityMapping)
            .map(([a, b]) => `${a} = ${b}`)
            .join("\n"),
        );
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
      {message && (
        <p role="status" className="admin-feedback">
          {message}
        </p>
      )}
      {config && (
        <form
          className="commerce-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const cityMapping: Record<string, string> = {};
              for (const line of mapping.split("\n").filter((l) => l.trim())) {
                const parts = line.split("=").map((p) => p.trim());
                if (parts.length !== 2 || !parts[0] || !parts[1])
                  throw new Error(
                    "Une correspondance par ligne : ville du site = ville Olivraison",
                  );
                cityMapping[parts[0]] = parts[1];
              }
              const result = await saveOlivraisonConfig({
                enabled: config.enabled,
                autoPickup: config.autoPickup,
                pickupAddress: config.pickupAddress,
                cityMapping,
                ...(keys.apiKey || keys.secretKey ? keys : {}),
              });
              setConfig(result);
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
            <label>
              Correspondance des villes
              <textarea
                rows={4}
                placeholder={"الرباط = Rabat\nالدار البيضاء = Casablanca"}
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
              />
            </label>
            <p>Une ligne par correspondance. Utilisez le nom exact renvoyé par Olivraison.</p>
          </fieldset>
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
