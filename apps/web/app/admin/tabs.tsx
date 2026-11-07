"use client";
import { useAdminLocale } from "./admin-locale";

import { useMemo, useState } from "react";
import { ArrowUpRight, Package, RefreshCw, ShoppingBag, Truck } from "lucide-react";
import type { Product, Category } from "@/lib/api";
import { money, statusLabels, summarize } from "./admin-utils";
type Order = {
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    city: string | null;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
};
export function OverviewTab({
    orders,
    products,
    orderTotal,
    productTotal,
    onNavigate,
}: {
    orders: Order[];
    products: Product[];
    orderTotal: number;
    productTotal: number;
    onNavigate: (tab: "orders" | "products") => void;
}) {
    const { t, locale } = useAdminLocale();
    const dateLocale = locale === "ar" ? "ar-MA" : "fr-MA";
    const summary = summarize(orders, products);
    const days = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(dateLocale, {
            timeZone: "Africa/Casablanca",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
        const now = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now);
            d.setDate(now.getDate() - 6 + i);
            const key = fmt.format(d);
            return {
                date: key,
                label: d.toLocaleDateString(dateLocale, {
                    timeZone: "Africa/Casablanca",
                    weekday: "short",
                }),
                count: orders.filter((o) => fmt.format(new Date(o.createdAt)) === key).length,
            };
        });
    }, [orders, dateLocale]);
    const max = Math.max(1, ...days.map((d) => d.count));
    const cards = [
        {
            label: "Commandes au total",
            value: String(orderTotal),
            sub: t("{count} dernières analysées", { count: orders.length }),
            icon: Package,
        },
        {
            label: "À confirmer",
            value: String(summary.pending),
            sub: "Dans les commandes chargées",
            icon: RefreshCw,
        },
        {
            label: "Montant des commandes livrées",
            value: money(summary.deliveredAmount),
            sub: "Commandes chargées · livraison comprise",
            icon: Truck,
        },
        {
            label: "Produits en vente",
            value: String(summary.activeProducts),
            sub: t("Sur {count} fiches chargées ({total} au total)", {
                count: products.length,
                total: productTotal,
            }),
            icon: ShoppingBag,
        },
    ];
    return (
        <div className="admin-overview">
            <div className="admin-kpi-grid">
                {cards.map(({ label, value, sub, icon: Icon }) => (
                    <section className="admin-kpi" key={label}>
                        <div>
                            <p>{t(label)}</p>
                            <span>
                                <Icon size={19} aria-hidden="true" />
                            </span>
                        </div>
                        <strong>{value}</strong>
                        <p>{t(sub)}</p>
                    </section>
                ))}
            </div>
            <div className="admin-overview-grid">
                <section className="admin-panel">
                    <div className="admin-panel-heading">
                        <div>
                            <h2>{t("L’activité de votre boutique")}</h2>
                            <p>{t("Commandes reçues · 7 derniers jours · heure du Maroc")}</p>
                        </div>
                        <span className="admin-tag">
                            {days.reduce((s, d) => s + d.count, 0)}
                            {t(" commandes")}
                        </span>
                    </div>
                    <div
                        className="admin-activity-chart"
                        role="img"
                        aria-label={days
                            .map((d) => t("{0} : {1} commandes", { "0": d.date, "1": d.count }))
                            .join(" ; ")}
                    >
                        {days.map((d) => (
                            <div key={d.date}>
                                <span className="admin-bar-count">{d.count}</span>
                                <div className="admin-bar-track">
                                    <span
                                        style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
                                    />
                                </div>
                                <span>{d.label}</span>
                            </div>
                        ))}
                    </div>
                    <p className="admin-scope">
                        {t("Calculé sur les ")}
                        {orders.length}
                        {t(
                            " commandes chargées, toutes situations confondues. Les annulations restent dans l’activité; elles sont exclues du montant livré.",
                        )}
                    </p>
                </section>
                <section className="admin-attention">
                    <p className="admin-eyebrow">{t("VOTRE PROCHAINE ÉTAPE")}</p>
                    <h2>
                        {t("Une boutique")}
                        <br />
                        {t("bien suivie.")}
                    </h2>
                    <p>
                        {summary.pending
                            ? t("{0} commande(s) en attente de confirmation.", {
                                  "0": summary.pending,
                              })
                            : t("Aucune commande à confirmer dans la sélection.")}
                    </p>
                    <button className="admin-button" onClick={() => onNavigate("orders")}>
                        {t("Voir les commandes")}
                        <ArrowUpRight size={17} />
                    </button>
                    <div className="admin-attention-stock">
                        <ShoppingBag size={18} />
                        <span>
                            {summary.lowStock}
                            {t(" produit(s) en vente avec une variante à 3 unités ou moins.")}
                        </span>
                    </div>
                    <button className="admin-text-button" onClick={() => onNavigate("products")}>
                        {t("Vérifier les stocks ")}
                        <ArrowUpRight size={15} />
                    </button>
                </section>
            </div>
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div>
                        <h2>{t("Dernières commandes")}</h2>
                        <p>{t("Les cinq dernières demandes reçues.")}</p>
                    </div>
                    <button className="admin-text-button" onClick={() => onNavigate("orders")}>
                        {t("Tout consulter")}
                        <ArrowUpRight size={16} />
                    </button>
                </div>
                {orders.length ? (
                    <div className="admin-recent-list">
                        {orders.slice(0, 5).map((o) => (
                            <div key={o.id}>
                                <span className="admin-order-icon">
                                    <Package size={19} />
                                </span>
                                <div>
                                    <strong>#{o.id.slice(-8).toUpperCase()}</strong>
                                    <span>
                                        {o.customerName || t("Client invité")} ·{" "}
                                        {o.city || t("Ville non renseignée")}
                                    </span>
                                </div>
                                <span className={`admin-status status-${o.status.toLowerCase()}`}>
                                    {t(statusLabels[o.status] || o.status)}
                                </span>
                                <strong>{money(o.totalAmount)}</strong>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="admin-empty">{t("Votre première commande apparaîtra ici.")}</p>
                )}
            </section>
        </div>
    );
}
export { OrdersTab } from "./orders-tab";
export function CategoriesTab({
    categories,
    onCreate,
    onDelete,
}: {
    categories: Category[];
    onCreate: (d: Record<string, unknown>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const { t } = useAdminLocale();
    const [form, setForm] = useState({ slug: "", nameFr: "", nameAr: "", nameEn: "" }),
        [busy, setBusy] = useState(false),
        [message, setMessage] = useState("");
    return (
        <div className="admin-category-grid">
            <section className="admin-panel">
                <h2>{t("Ajouter une catégorie")}</h2>
                <p className="admin-muted">
                    {t("Renseignez les trois langues utilisées dans le catalogue.")}
                </p>
                <form
                    className="admin-category-form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setMessage("");
                        try {
                            await onCreate(form);
                            setForm({ slug: "", nameFr: "", nameAr: "", nameEn: "" });
                            setMessage("Catégorie ajoutée.");
                        } catch {
                            setMessage(
                                "Impossible d’ajouter cette catégorie. Vérifiez son adresse et réessayez.",
                            );
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {(
                        [
                            ["slug", "Adresse de la catégorie"],
                            ["nameFr", "Nom français"],
                            ["nameAr", "Nom arabe"],
                            ["nameEn", "Nom anglais"],
                        ] as const
                    ).map(([key, label]) => (
                        <label key={key}>
                            {t(label)}
                            <input
                                required
                                disabled={busy}
                                dir={key === "nameAr" ? "rtl" : "ltr"}
                                value={form[key]}
                                pattern={key === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
                                placeholder={key === "slug" ? t("exemple-categorie") : undefined}
                                onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <button className="admin-button primary" disabled={busy}>
                        {busy ? t("Enregistrement…") : t("Créer la catégorie")}
                    </button>
                </form>
                {message && (
                    <p className="admin-feedback" role="status">
                        {t(message)}
                    </p>
                )}
            </section>
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div>
                        <h2>{t("Vos catégories")}</h2>
                        <p>
                            {categories.length}
                            {t(" catégorie(s)")}
                        </p>
                    </div>
                </div>
                <div className="admin-category-list">
                    {categories.map((c) => (
                        <div key={c.id}>
                            <div>
                                <strong>{c.nameFr}</strong>
                                <span dir="rtl">{c.nameAr}</span>
                                <small>/{c.slug}</small>
                            </div>
                            <button
                                className="admin-button danger"
                                disabled={busy}
                                aria-label={t("Supprimer {0}", { "0": c.nameFr })}
                                onClick={async () => {
                                    if (
                                        !confirm(
                                            t("Supprimer la catégorie « {name} » ?", {
                                                name: c.nameFr,
                                            }),
                                        )
                                    )
                                        return;
                                    setBusy(true);
                                    try {
                                        await onDelete(c.id);
                                        setMessage("Catégorie supprimée.");
                                    } catch {
                                        setMessage(
                                            "Suppression impossible. Vérifiez que cette catégorie ne contient aucun produit.",
                                        );
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                {t("Supprimer")}
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
