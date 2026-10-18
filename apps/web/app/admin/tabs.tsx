"use client";
import { useMemo, useState } from "react";
import {
    ArrowUpRight,
    Package,
    RefreshCw,
    ShoppingBag,
    Truck,
} from "lucide-react";
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
    const summary = summarize(orders, products);
    const days = useMemo(() => {
        const fmt = new Intl.DateTimeFormat("fr-MA", {
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
                label: d.toLocaleDateString("fr-MA", {
                    timeZone: "Africa/Casablanca",
                    weekday: "short",
                }),
                count: orders.filter((o) => fmt.format(new Date(o.createdAt)) === key).length,
            };
        });
    }, [orders]);
    const max = Math.max(1, ...days.map((d) => d.count));
    const cards = [
        {
            label: "Commandes au total",
            value: String(orderTotal),
            sub: `${orders.length} dernières analysées`,
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
            sub: `Sur ${products.length} fiches chargées (${productTotal} au total)`,
            icon: ShoppingBag,
        },
    ];
    return (
        <div className="admin-overview">
            <div className="admin-kpi-grid">
                {cards.map(({ label, value, sub, icon: Icon }) => (
                    <section className="admin-kpi" key={label}>
                        <div>
                            <p>{label}</p>
                            <span>
                                <Icon size={19} aria-hidden="true" />
                            </span>
                        </div>
                        <strong>{value}</strong>
                        <p>{sub}</p>
                    </section>
                ))}
            </div>
            <div className="admin-overview-grid">
                <section className="admin-panel">
                    <div className="admin-panel-heading">
                        <div>
                            <h2>L’activité de votre boutique</h2>
                            <p>Commandes reçues · 7 derniers jours · heure du Maroc</p>
                        </div>
                        <span className="admin-tag">
                            {days.reduce((s, d) => s + d.count, 0)} commandes
                        </span>
                    </div>
                    <div
                        className="admin-activity-chart"
                        role="img"
                        aria-label={days.map((d) => `${d.date} : ${d.count} commandes`).join(" ; ")}
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
                        Calculé sur les {orders.length} commandes chargées, toutes situations
                        confondues. Les annulations restent dans l’activité; elles sont exclues du
                        montant livré.
                    </p>
                </section>
                <section className="admin-attention">
                    <p className="admin-eyebrow">VOTRE PROCHAINE ÉTAPE</p>
                    <h2>
                        Une boutique
                        <br />
                        bien suivie.
                    </h2>
                    <p>
                        {summary.pending
                            ? `${summary.pending} commande(s) en attente de confirmation.`
                            : "Aucune commande à confirmer dans la sélection."}
                    </p>
                    <button className="admin-button" onClick={() => onNavigate("orders")}>
                        Voir les commandes
                        <ArrowUpRight size={17} />
                    </button>
                    <div className="admin-attention-stock">
                        <ShoppingBag size={18} />
                        <span>
                            {summary.lowStock} produit(s) en vente avec une variante à 3 unités ou
                            moins.
                        </span>
                    </div>
                    <button className="admin-text-button" onClick={() => onNavigate("products")}>
                        Vérifier les stocks <ArrowUpRight size={15} />
                    </button>
                </section>
            </div>
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div>
                        <h2>Dernières commandes</h2>
                        <p>Les cinq dernières demandes reçues.</p>
                    </div>
                    <button className="admin-text-button" onClick={() => onNavigate("orders")}>
                        Tout consulter
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
                                        {o.customerName || "Client invité"} ·{" "}
                                        {o.city || "Ville non renseignée"}
                                    </span>
                                </div>
                                <span className={`admin-status status-${o.status.toLowerCase()}`}>
                                    {statusLabels[o.status] || o.status}
                                </span>
                                <strong>{money(o.totalAmount)}</strong>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="admin-empty">Votre première commande apparaîtra ici.</p>
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
    const [form, setForm] = useState({ slug: "", nameFr: "", nameAr: "", nameEn: "" }),
        [busy, setBusy] = useState(false),
        [message, setMessage] = useState("");
    return (
        <div className="admin-category-grid">
            <section className="admin-panel">
                <h2>Ajouter une catégorie</h2>
                <p className="admin-muted">
                    Renseignez les trois langues utilisées dans le catalogue.
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
                            {label}
                            <input
                                required
                                dir={key === "nameAr" ? "rtl" : "ltr"}
                                value={form[key]}
                                pattern={key === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
                                placeholder={key === "slug" ? "exemple-categorie" : undefined}
                                onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <button className="admin-button primary" disabled={busy}>
                        {busy ? "Enregistrement…" : "Créer la catégorie"}
                    </button>
                </form>
                {message && (
                    <p className="admin-feedback" role="status">
                        {message}
                    </p>
                )}
            </section>
            <section className="admin-panel">
                <div className="admin-panel-heading">
                    <div>
                        <h2>Vos catégories</h2>
                        <p>{categories.length} catégorie(s)</p>
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
                                aria-label={`Supprimer ${c.nameFr}`}
                                onClick={async () => {
                                    if (!confirm(`Supprimer la catégorie « ${c.nameFr} » ?`))
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
                                Supprimer
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
