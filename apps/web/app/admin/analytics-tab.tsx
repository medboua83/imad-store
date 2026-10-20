"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, MousePointer2, ShoppingBag, RefreshCw, ShieldCheck } from "lucide-react";
import { getStoreAnalytics, type StoreAnalyticsSummary } from "@/lib/api";
const count = (n: number) => n.toLocaleString("fr-MA");
export default function AnalyticsTab() {
    const [days, setDays] = useState(7),
        [data, setData] = useState<StoreAnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true),
        [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const sequence = useRef(0);
    useEffect(() => {
        let active = true;
        const request = ++sequence.current;
        const timer = setTimeout(() => {
            setLoading(true);
            setError("");
            setData(null);
            getStoreAnalytics(days)
                .then((value) => {
                    if (active && request === sequence.current) setData(value);
                })
                .catch(() => {
                    if (active && request === sequence.current)
                        setError(
                            "Les statistiques n’ont pas pu être chargées. Réessayez dans un instant.",
                        );
                })
                .finally(() => {
                    if (active && request === sequence.current) setLoading(false);
                });
        }, 0);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [days, refresh]);
    return (
        <div className="admin-analytics">
            <section className="admin-panel analytics-intro">
                <div>
                    <span className="analytics-eyebrow">L’activité de votre boutique</span>
                    <h2>Des visites aux commandes</h2>
                    <p>
                        Repérez les produits qui intéressent vos visiteurs et suivez les visites qui
                        deviennent des commandes.
                    </p>
                </div>
                <div className="analytics-toolbar">
                    <div className="analytics-period">
                        <label htmlFor="analytics-period">Période</label>
                        <select
                            id="analytics-period"
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            <option value={7}>7 derniers jours</option>
                            <option value={30}>30 derniers jours</option>
                            <option value={90}>90 derniers jours</option>
                        </select>
                    </div>
                    <button
                        className="admin-button"
                        disabled={loading}
                        onClick={() => setRefresh((v) => v + 1)}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        Actualiser
                    </button>
                </div>
            </section>
            {error && (
                <div className="admin-alert" role="alert">
                    <p>{error}</p>
                    <button className="admin-button" onClick={() => setRefresh((v) => v + 1)}>
                        Réessayer
                    </button>
                </div>
            )}
            {loading && (
                <div className="admin-loading" role="status">
                    Chargement des statistiques…
                </div>
            )}
            {!loading && !error && data && (
                <>
                    <div className="admin-kpi-grid analytics-kpis">
                        <article className="admin-kpi">
                            <div>
                                <p>Visites</p>
                                <span>
                                    <MousePointer2 size={20} aria-hidden="true" />
                                </span>
                            </div>
                            <strong>{count(data.visits)}</strong>
                            <p>Une visite par onglet, pendant 30 minutes maximum</p>
                        </article>
                        <article className="admin-kpi">
                            <div>
                                <p>Consultations de produits</p>
                                <span>
                                    <Eye size={20} aria-hidden="true" />
                                </span>
                            </div>
                            <strong>{count(data.productViews)}</strong>
                            <p>Chaque produit est compté une fois par visite</p>
                        </article>
                        <article className="admin-kpi">
                            <div>
                                <p>Taux de commande</p>
                                <span>
                                    <ShoppingBag size={20} aria-hidden="true" />
                                </span>
                            </div>
                            <strong>
                                {data.orderRate === null
                                    ? "—"
                                    : `${data.orderRate.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} %`}
                            </strong>
                            <p>
                                {count(data.convertedVisits)} visite
                                {data.convertedVisits !== 1 ? "s" : ""} avec au moins une commande
                                sur {count(data.visits)}
                            </p>
                        </article>
                    </div>
                    {!data.visits && (
                        <section className="admin-panel analytics-empty">
                            <Eye size={30} aria-hidden="true" />
                            <h2>Les premières visites apparaîtront ici</h2>
                            <p>
                                Le suivi démarre à la mise en ligne de ce module. Vos visites
                                d’administration et les tests sont exclus.
                            </p>
                        </section>
                    )}
                    <section className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Produits les plus consultés</h2>
                                <p>Les 20 premiers produits sur la période sélectionnée.</p>
                            </div>
                            <span className="analytics-count">
                                {count(data.productViews)} consultation
                                {data.productViews !== 1 ? "s" : ""}
                            </span>
                        </div>
                        {data.products.length ? (
                            <ol className="analytics-products">
                                {data.products.map((product, i) => (
                                    <li key={product.id}>
                                        <span className="analytics-rank">{i + 1}</span>
                                        <div>
                                            <strong>{product.name}</strong>
                                            <div className="analytics-bar" aria-hidden="true">
                                                <span
                                                    style={{
                                                        width: `${(product.views / Math.max(1, data.products[0].views)) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <span className="analytics-product-count">
                                            {count(product.views)}
                                            <small>
                                                consultation{product.views !== 1 ? "s" : ""}
                                            </small>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="analytics-muted">
                                Aucune consultation de produit mesurée pendant cette période.
                            </p>
                        )}
                    </section>
                    <section className="admin-panel analytics-method">
                        <ShieldCheck size={22} aria-hidden="true" />
                        <div>
                            <h2>Des chiffres expliqués, des données séparées</h2>
                            <p>
                                {count(data.pageViews)} consultations de pages ·{" "}
                                {count(data.attributedOrders)} commandes créées et attribuées aux
                                visites mesurées. Une commande créée peut encore être en attente,
                                annulée ou non payée.
                            </p>
                            <p>
                                Le taux correspond aux visites ayant créé au moins une commande,
                                divisées par les visites mesurées. Les commandes antérieures au
                                suivi et les visites bloquées par les réglages de confidentialité ne
                                sont pas attribuées.
                            </p>
                            <p>
                                Ce tableau concerne uniquement cette installation et son entreprise.
                                Aucun nom, téléphone ou adresse IP n’est enregistré dans ces
                                statistiques. Les administrateurs connectés, les tests et les robots
                                reconnus sont exclus.
                            </p>
                            <p>
                                {data.trackingSince
                                    ? `Historique disponible depuis le ${new Date(data.trackingSince).toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" })}.`
                                    : "Aucun historique reconstitué."}{" "}
                                Période glissante de {days} jours. Conservation : 91 jours.
                            </p>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
