"use client";
import { useAdminLocale } from "./admin-locale";

import { useEffect, useRef, useState } from "react";
import { Eye, MousePointer2, ShoppingBag, RefreshCw, ShieldCheck } from "lucide-react";
import { getStoreAnalytics, type StoreAnalyticsSummary } from "@/lib/api";
const count = (n: number) => n.toLocaleString("fr-MA");
export default function AnalyticsTab({
    days,
    setDays,
}: {
    days: number;
    setDays: (days: number) => void;
}) {
    const { t, locale } = useAdminLocale();
    const [data, setData] = useState<StoreAnalyticsSummary | null>(null);
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
                    <span className="analytics-eyebrow">{t("L’activité de votre boutique")}</span>
                    <h2>{t("Des visites aux commandes")}</h2>
                    <p>
                        {t(
                            "Repérez les produits qui intéressent vos visiteurs et suivez les visites qui deviennent des commandes.",
                        )}
                    </p>
                </div>
                <div className="analytics-toolbar">
                    <div className="analytics-period">
                        <label htmlFor="analytics-period">{t("Période")}</label>
                        <select
                            id="analytics-period"
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            <option value={7}>{t("7 derniers jours")}</option>
                            <option value={30}>{t("30 derniers jours")}</option>
                            <option value={90}>{t("90 derniers jours")}</option>
                        </select>
                    </div>
                    <button
                        className="admin-button"
                        disabled={loading}
                        onClick={() => setRefresh((v) => v + 1)}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {t("Actualiser")}
                    </button>
                </div>
            </section>
            {error && (
                <div className="admin-alert" role="alert">
                    <p>{t(error)}</p>
                    <button className="admin-button" onClick={() => setRefresh((v) => v + 1)}>
                        {t("Réessayer")}
                    </button>
                </div>
            )}
            {loading && (
                <div className="admin-loading" role="status">
                    {t("Chargement des statistiques…")}
                </div>
            )}
            {!loading && !error && data && (
                <>
                    <div className="admin-kpi-grid analytics-kpis">
                        <article className="admin-kpi">
                            <div>
                                <p>{t("Visites")}</p>
                                <span>
                                    <MousePointer2 size={20} aria-hidden="true" />
                                </span>
                            </div>
                            <strong>{count(data.visits)}</strong>
                            <p>{t("Une visite par onglet, pendant 30 minutes maximum")}</p>
                        </article>
                        <article className="admin-kpi">
                            <div>
                                <p>{t("Consultations de produits")}</p>
                                <span>
                                    <Eye size={20} aria-hidden="true" />
                                </span>
                            </div>
                            <strong>{count(data.productViews)}</strong>
                            <p>{t("Chaque produit est compté une fois par visite")}</p>
                        </article>
                        <article className="admin-kpi">
                            <div>
                                <p>{t("Taux de commande")}</p>
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
                                {count(data.convertedVisits)}
                                {t(" visite")}
                                {data.convertedVisits !== 1 ? t("s") : ""}
                                {t(" avec au moins une commande sur ")}
                                {count(data.visits)}
                            </p>
                        </article>
                    </div>
                    {data.funnel && (
                        <section className="admin-panel" aria-label={t("Parcours de conversion")}>
                            <h2>{t("Où les visiteurs s’arrêtent-ils ?")}</h2>
                            <ol className="analytics-funnel">
                                {[
                                    ["Visites", data.visits],
                                    ["Avec ajout au panier", data.funnel.cartVisits],
                                    ["Page de commande ouverte", data.funnel.checkoutVisits],
                                    ["Avec commande créée", data.convertedVisits],
                                ].map(([label, value]) => (
                                    <li key={label}>
                                        <span>{t(String(label))}</span>
                                        <strong>{count(Number(value))}</strong>
                                    </li>
                                ))}
                            </ol>
                            <p className="analytics-muted">
                                {t(
                                    "Chaque étape compte une visite une seule fois. Un panier enregistré peut reprendre directement à la commande : ces compteurs ne décrivent pas forcément un parcours linéaire.",
                                )}
                            </p>
                            <h3>{t("État actuel des commandes attribuées à ces visites")}</h3>
                            <dl className="analytics-order-states">
                                <div>
                                    <dt>{t("Confirmées, non annulées")}</dt>
                                    <dd>{count(data.funnel.confirmedOrders)}</dd>
                                </div>
                                <div>
                                    <dt>{t("Expédiées, livrées comprises")}</dt>
                                    <dd>{count(data.funnel.shippedOrders)}</dd>
                                </div>
                                <div>
                                    <dt>{t("Livrées")}</dt>
                                    <dd>{count(data.funnel.deliveredOrders)}</dd>
                                </div>
                                <div>
                                    <dt>{t("Annulées")}</dt>
                                    <dd>{count(data.funnel.cancelledOrders)}</dd>
                                </div>
                            </dl>
                            <p className="analytics-muted">
                                {t(
                                    "Les confirmées incluent les expédiées et livrées. Ce sont les états enregistrés sur la boutique, pas une preuve de paiement. Le suivi détaillé démarre à cette mise à jour ;",
                                )}{" "}
                                {count(data.funnel.unknownOrders)}
                                {t(
                                    " ancienne(s) commande(s) sans statut mesuré ne sont pas reconstituées.",
                                )}
                            </p>
                        </section>
                    )}
                    {!data.visits && (
                        <section className="admin-panel analytics-empty">
                            <Eye size={30} aria-hidden="true" />
                            <h2>{t("Les premières visites apparaîtront ici")}</h2>
                            <p>
                                {t(
                                    "Le suivi démarre à la mise en ligne de ce module. Vos visites d’administration et les tests sont exclus.",
                                )}
                            </p>
                        </section>
                    )}
                    <section className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>{t("Produits les plus consultés")}</h2>
                                <p>{t("Les 20 premiers produits sur la période sélectionnée.")}</p>
                            </div>
                            <span className="analytics-count">
                                {count(data.productViews)}
                                {t(" consultation")}
                                {data.productViews !== 1 ? t("s") : ""}
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
                                                {t("consultation")}
                                                {product.views !== 1 ? t("s") : ""}
                                            </small>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="analytics-muted">
                                {t("Aucune consultation de produit mesurée pendant cette période.")}
                            </p>
                        )}
                    </section>
                    <section className="admin-panel analytics-method">
                        <ShieldCheck size={22} aria-hidden="true" />
                        <div>
                            <h2>{t("Des chiffres expliqués, des données séparées")}</h2>
                            <p>
                                {count(data.pageViews)}
                                {t(" consultations de pages ·")} {count(data.attributedOrders)}
                                {t(
                                    " commandes créées et attribuées aux visites mesurées. Une commande créée peut encore être en attente, annulée ou non payée.",
                                )}
                            </p>
                            <p>
                                {t(
                                    "Le taux correspond aux visites ayant créé au moins une commande, divisées par les visites mesurées. Les commandes antérieures au suivi et les visites bloquées par les réglages de confidentialité ne sont pas attribuées.",
                                )}
                            </p>
                            <p>
                                {t(
                                    "Ce tableau concerne uniquement cette installation et son entreprise. Aucun nom, téléphone ou adresse IP n’est enregistré dans ces statistiques. Les administrateurs connectés, les tests et les robots reconnus sont exclus.",
                                )}
                            </p>
                            <p>
                                {data.trackingSince
                                    ? t("Historique disponible depuis le {0}.", {
                                          "0": new Date(data.trackingSince).toLocaleString(
                                              locale === "ar" ? "ar-MA" : "fr-MA",
                                              { timeZone: "Africa/Casablanca" },
                                          ),
                                      })
                                    : t("Aucun historique reconstitué.")}{" "}
                                {t("Période glissante de ")}
                                {days}
                                {t(" jours. Conservation : 91 jours.")}
                            </p>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
