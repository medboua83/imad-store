"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useEffect, useRef, useState } from "react";
import {
    ArrowUpRight,
    ChartNoAxesCombined,
    Bell,
    CheckCheck,
    Grid2X2,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    RefreshCw,
    Settings2,
    ShoppingBag,
    X,
    Eye,
    EyeOff,
} from "lucide-react";
import {
    adminLogin,
    adminLogout,
    getAdminNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    getAllOrders,
    getAdminProducts,
    getCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    deleteCategory,
    type Product,
    type Category,
    type AdminOrder,
} from "@/lib/api";
import "./admin.css";
const pendingView = () => (
    <div className="admin-loading" role="status">
        Chargement de votre espace…
    </div>
);
const OverviewTab = dynamic(() => import("./tabs").then((m) => m.OverviewTab), {
    loading: pendingView,
});
const OrdersTab = dynamic(() => import("./tabs").then((m) => m.OrdersTab), {
    loading: pendingView,
});
const CategoriesTab = dynamic(() => import("./tabs").then((m) => m.CategoriesTab), {
    loading: pendingView,
});
const ProductsTab = dynamic(() => import("./products-tab").then((m) => m.ProductsTab), {
    loading: pendingView,
});
const CommerceTab = dynamic(() => import("./commerce-tab"), { loading: pendingView });
const ContentTab = dynamic(() => import("./content-tab"), { loading: pendingView });
const AnalyticsTab = dynamic(() => import("./analytics-tab"), { loading: pendingView });
const DeskcommTab = dynamic(() => import("./deskcomm-tab"), { loading: pendingView });
type Tab =
    | "overview"
    | "orders"
    | "products"
    | "categories"
    | "content"
    | "deskcomm"
    | "notifications"
    | "analytics"
    | "commerce";
type Notice = { id: string; title: string; message: string; read: boolean; createdAt: string };
const sections = [
    {
        id: "overview" as Tab,
        label: "Vue d’ensemble",
        description: "Les repères essentiels de votre boutique.",
        icon: LayoutDashboard,
    },
    {
        id: "analytics" as Tab,
        label: "Statistiques",
        description: "Comprenez les visites, les produits consultés et les commandes.",
        icon: ChartNoAxesCombined,
    },
    {
        id: "orders" as Tab,
        label: "Commandes",
        description: "Retrouvez une commande et suivez sa progression.",
        icon: Package,
    },
    {
        id: "products" as Tab,
        label: "Produits",
        description: "Vos fiches, variantes et stocks au même endroit.",
        icon: ShoppingBag,
    },
    {
        id: "categories" as Tab,
        label: "Catégories",
        description: "Organisez votre collection pour vos visiteurs.",
        icon: Grid2X2,
    },
    {
        id: "content" as Tab,
        label: "Contenu du site",
        description: "Préparez vos textes et visuels avant publication.",
        icon: Settings2,
    },
    {
        id: "commerce" as Tab,
        label: "Paramètres",
        description: "Gestion des commandes, livraison et Meta Pixel.",
        icon: Settings2,
    },
    {
        id: "deskcomm" as Tab,
        label: "Intégration CRM",
        description: "Gérez la connexion à votre service client.",
        icon: Settings2,
    },
    {
        id: "notifications" as Tab,
        label: "Notifications",
        description: "Les dernières informations de votre boutique.",
        icon: Bell,
    },
];
export default function AdminPage() {
    const [token, setToken] = useState<string | null>(null),
        [sessionReady, setSessionReady] = useState(false);
    const [email, setEmail] = useState(""),
        [password, setPassword] = useState(""),
        [showPassword, setShowPassword] = useState(false),
        [authError, setAuthError] = useState(""),
        [authLoading, setAuthLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("overview"),
        [mobileMenu, setMobileMenu] = useState(false);
    const [notifications, setNotifications] = useState<Notice[]>([]),
        [unread, setUnread] = useState(0),
        [orders, setOrders] = useState<AdminOrder[]>([]),
        [products, setProducts] = useState<Product[]>([]),
        [categories, setCategories] = useState<Category[]>([]);
    const [orderTotal, setOrderTotal] = useState(0),
        [productTotal, setProductTotal] = useState(0),
        [syncError, setSyncError] = useState(""),
        [actionMessage, setActionMessage] = useState(""),
        [syncing, setSyncing] = useState(false),
        [lastSync, setLastSync] = useState<Date | null>(null);
    const [openedTabs, setOpenedTabs] = useState<Tab[]>(["overview"]);
    const mainTitle = useRef<HTMLHeadingElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null),
        nav = useRef<HTMLElement>(null);
    useEffect(() => {
        const task = setTimeout(() => {
            setToken(localStorage.getItem("adminToken"));
            setSessionReady(true);
        }, 0);
        return () => clearTimeout(task);
    }, []);
    useEffect(() => {
        const expire = (event?: Event) => {
            setToken(null);
            setOrders([]);
            setProducts([]);
            setCategories([]);
            setNotifications([]);
            setUnread(0);
            setLastSync(null);
            setAuthError(
                event instanceof CustomEvent && event.detail === "logout"
                    ? "Vous êtes déconnecté."
                    : "Votre session est terminée. Reconnectez-vous pour continuer.",
            );
        };
        const changed = (e: StorageEvent) => {
            if (e.key === "adminToken" && !e.newValue) expire();
        };
        window.addEventListener("storage", changed);
        window.addEventListener("imad:session-expired", expire);
        return () => {
            window.removeEventListener("storage", changed);
            window.removeEventListener("imad:session-expired", expire);
        };
    }, []);
    useEffect(() => {
        if (!token) return;
        let alive = true,
            busy = false;
        const sync = async () => {
            if (busy || document.hidden) return;
            busy = true;
            setSyncing(true);
            const results = await Promise.allSettled([
                getAllOrders({ limit: 100 }),
                getAdminProducts({ limit: 100 }),
                getCategories(),
                getAdminNotifications(),
            ]);
            if (alive) {
                const [o, p, c, n] = results;
                if (o.status === "fulfilled") {
                    setOrders(o.value.data);
                    setOrderTotal(o.value.total);
                }
                if (p.status === "fulfilled") {
                    setProducts(p.value.data);
                    setProductTotal(p.value.total);
                }
                if (c.status === "fulfilled") setCategories(c.value);
                if (n.status === "fulfilled") {
                    setNotifications(n.value.data);
                    setUnread(n.value.unread);
                }
                const failed = results.some((r) => r.status === "rejected");
                setSyncError(
                    failed
                        ? "Certaines données n’ont pas pu être actualisées. Les informations précédentes restent affichées."
                        : "",
                );
                if (!failed) setLastSync(new Date());
                setSyncing(false);
            }
            busy = false;
        };
        void sync();
        const interval = setInterval(sync, 30000);
        window.addEventListener("imad:sync", sync);
        document.addEventListener("visibilitychange", sync);
        return () => {
            alive = false;
            clearInterval(interval);
            window.removeEventListener("imad:sync", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, [token]);
    useEffect(() => {
        if (mobileMenu) nav.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, [mobileMenu]);
    const selectTab = (tab: Tab) => {
        setActiveTab(tab);
        setOpenedTabs((tabs) => (tabs.includes(tab) ? tabs : [...tabs, tab]));
        requestAnimationFrame(() => mainTitle.current?.focus());
        setMobileMenu(false);
        setActionMessage("");
    };
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError("");
        try {
            const r = await adminLogin(email, password);
            localStorage.setItem("adminToken", r.data.accessToken);
            localStorage.setItem("adminRefresh", r.data.refreshToken);
            setPassword("");
            setToken(r.data.accessToken);
        } catch {
            setAuthError("Connexion impossible. Vérifiez vos identifiants et votre connexion.");
        } finally {
            setAuthLoading(false);
        }
    }
    async function logout() {
        try {
            await adminLogout();
            setToken(null);
        } catch {
            setSyncError("La déconnexion n’a pas abouti. Réessayez.");
        }
    }
    async function refreshProducts() {
        const r = await getAdminProducts({ limit: 100 });
        setProducts(r.data);
        setProductTotal(r.total);
        return r.data;
    }
    async function refreshOrders() {
        const r = await getAllOrders({ limit: 100 });
        setOrders(r.data);
        setOrderTotal(r.total);
    }
    const current = sections.find((s) => s.id === activeTab)!;
    if (!sessionReady)
        return (
            <div className="admin-app admin-session" dir="ltr" lang="fr" role="status">
                Ouverture de l’administration…
            </div>
        );
    if (!token)
        return (
            <div className="admin-app admin-auth" dir="ltr" lang="fr">
                <div className="admin-auth-story">
                    <Link href="/" className="brand-wordmark">
                        <BrandLogo />
                    </Link>
                    <div>
                        <p className="admin-eyebrow">VOTRE ESPACE BOUTIQUE</p>
                        <h1>
                            Tout commence
                            <br />
                            par les détails.
                        </h1>
                        <p>
                            Votre collection, vos commandes et votre quotidien.
                            <br />
                            Un espace pour tout garder en vue.
                        </p>
                    </div>
                    <span>IMAD Mode · Administration</span>
                </div>
                <main className="admin-auth-main">
                    <form onSubmit={handleLogin} className="admin-login-card">
                        <p className="admin-eyebrow">HEUREUX DE VOUS RETROUVER</p>
                        <h2>Connexion à votre espace</h2>
                        <p className="admin-muted">
                            Utilisez votre compte administrateur pour continuer.
                        </p>
                        {authError && (
                            <p className="admin-alert" role="alert">
                                {authError}
                            </p>
                        )}
                        <label htmlFor="admin-email">Adresse e-mail</label>
                        <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@exemple.ma"
                        />
                        <label htmlFor="admin-password">Mot de passe</label>
                        <div className="admin-password">
                            <input
                                id="admin-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                aria-label={
                                    showPassword
                                        ? "Masquer le mot de passe"
                                        : "Afficher le mot de passe"
                                }
                                aria-pressed={showPassword}
                                onClick={() => setShowPassword((v) => !v)}
                            >
                                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                            </button>
                        </div>
                        <button className="admin-button primary" disabled={authLoading}>
                            {authLoading ? "Connexion en cours…" : "Se connecter"}
                            <ArrowUpRight size={18} aria-hidden="true" />
                        </button>
                        <Link href="/" className="admin-back-link">
                            Retour à la boutique
                        </Link>
                    </form>
                </main>
            </div>
        );
    return (
        <div className="admin-app admin-workspace" dir="ltr" lang="fr">
            <a className="skip-link" href="#admin-main">
                Aller au contenu
            </a>
            <aside className="admin-sidebar">
                <Link href="/" className="brand-wordmark">
                    <BrandLogo />
                </Link>
                <p className="admin-sidebar-label">ESPACE ADMINISTRATION</p>
                <button
                    ref={menuButton}
                    className="admin-mobile-menu"
                    aria-expanded={mobileMenu}
                    aria-controls="admin-navigation"
                    onClick={() => setMobileMenu((v) => !v)}
                >
                    {mobileMenu ? <X size={20} /> : <Menu size={20} />}Navigation
                </button>
                <nav
                    ref={nav}
                    id="admin-navigation"
                    className={mobileMenu ? "is-open" : ""}
                    aria-label="Administration"
                >
                    {sections.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setMobileMenu(false);
                                    menuButton.current?.focus();
                                }
                            }}
                            onClick={() => selectTab(id)}
                            aria-current={activeTab === id ? "page" : undefined}
                        >
                            <Icon size={19} aria-hidden="true" />
                            <span>{label}</span>
                            {id === "notifications" && unread > 0 && (
                                <span className="admin-count">{unread}</span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="admin-sidebar-bottom">
                    <Link href="/" target="_blank" rel="noreferrer">
                        <ArrowUpRight size={17} aria-hidden="true" />
                        Voir la boutique
                    </Link>
                    <button onClick={logout}>
                        <LogOut size={17} aria-hidden="true" />
                        Se déconnecter
                    </button>
                </div>
            </aside>
            <div className="admin-body">
                <header className="admin-topbar">
                    <p>
                        Votre boutique <span>/ {current.label}</span>
                    </p>
                    <div className="admin-topbar-actions">
                        <span className={`admin-sync ${syncError ? "has-error" : ""}`}>
                            <i />
                            {syncing
                                ? "Actualisation…"
                                : lastSync
                                  ? `À jour à ${lastSync.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" })}`
                                  : "Chargement initial"}
                        </span>
                        <button
                            className="admin-icon-button"
                            aria-label="Actualiser les données"
                            disabled={syncing}
                            onClick={() => window.dispatchEvent(new Event("imad:sync"))}
                        >
                            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
                        </button>
                        <button
                            className="admin-icon-button"
                            aria-label={`Notifications, ${unread} non lues`}
                            onClick={() => selectTab("notifications")}
                        >
                            <Bell size={19} />
                            {unread > 0 && <span className="admin-dot" />}
                        </button>
                    </div>
                </header>
                <main id="admin-main" className="admin-main">
                    <div className="admin-page-heading">
                        <div>
                            <p className="admin-eyebrow">IMAD · GESTION DE LA BOUTIQUE</p>
                            <h1 ref={mainTitle} tabIndex={-1}>
                                {current.label}
                            </h1>
                            <p>{current.description}</p>
                        </div>
                        {activeTab === "overview" && (
                            <button
                                className="admin-button primary"
                                onClick={() => selectTab("products")}
                            >
                                <ShoppingBag size={17} />
                                Gérer les produits
                            </button>
                        )}
                    </div>
                    {syncError && (
                        <div className="admin-alert" role="alert">
                            {syncError}
                            <button onClick={() => window.dispatchEvent(new Event("imad:sync"))}>
                                Réessayer
                            </button>
                        </div>
                    )}
                    {actionMessage && (
                        <p className="admin-feedback" role="status">
                            {actionMessage}
                        </p>
                    )}
                    {!lastSync && syncing ? (
                        <div className="admin-loading" role="status">
                            Chargement des données…
                        </div>
                    ) : (
                        <>
                            {activeTab === "overview" && (
                                <OverviewTab
                                    orders={orders}
                                    products={products}
                                    orderTotal={orderTotal}
                                    productTotal={productTotal}
                                    onNavigate={selectTab}
                                />
                            )}
                            {activeTab === "orders" && (
                                <OrdersTab
                                    orders={orders}
                                    total={orderTotal}
                                    onRefresh={refreshOrders}
                                />
                            )}
                            {openedTabs.includes("products") && (
                                <div hidden={activeTab !== "products"}>
                                    <ProductsTab
                                        products={products}
                                        categories={categories}
                                        total={productTotal}
                                        onRefresh={refreshProducts}
                                        onCreate={async (d) => {
                                            await createProduct(d);
                                            try {
                                                await refreshProducts();
                                                return true;
                                            } catch {
                                                return false;
                                            }
                                        }}
                                        onUpdate={async (id, d) => {
                                            await updateProduct(id, d);
                                            try {
                                                await refreshProducts();
                                                return true;
                                            } catch {
                                                return false;
                                            }
                                        }}
                                        onDelete={async (id) => {
                                            await deleteProduct(id);
                                            try {
                                                await refreshProducts();
                                                return true;
                                            } catch {
                                                return false;
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            {activeTab === "categories" && (
                                <CategoriesTab
                                    categories={categories}
                                    onCreate={async (d) => {
                                        await createCategory(d);
                                        setCategories(await getCategories());
                                    }}
                                    onDelete={async (id) => {
                                        await deleteCategory(id);
                                        setCategories(await getCategories());
                                    }}
                                />
                            )}
                            {openedTabs.includes("content") && (
                                <div hidden={activeTab !== "content"}>
                                    <ContentTab />
                                </div>
                            )}
                            {activeTab === "analytics" && <AnalyticsTab />}
                            {activeTab === "commerce" && <CommerceTab />}
                            {activeTab === "deskcomm" && <DeskcommTab />}
                            {activeTab === "notifications" && (
                                <section className="admin-panel">
                                    <div className="admin-panel-heading">
                                        <div>
                                            <h2>Dernières notifications</h2>
                                            <p>
                                                {unread} non lue{unread !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        <button
                                            className="admin-button"
                                            disabled={!unread}
                                            onClick={async () => {
                                                try {
                                                    await markAllNotificationsRead();
                                                    setNotifications((v) =>
                                                        v.map((n) => ({ ...n, read: true })),
                                                    );
                                                    setUnread(0);
                                                } catch {
                                                    setActionMessage(
                                                        "Impossible de mettre à jour les notifications. Réessayez.",
                                                    );
                                                }
                                            }}
                                        >
                                            <CheckCheck size={17} />
                                            Tout marquer comme lu
                                        </button>
                                    </div>
                                    {!notifications.length ? (
                                        <p className="admin-empty">
                                            Aucune notification pour le moment.
                                        </p>
                                    ) : (
                                        <div className="admin-notices">
                                            {notifications.map((n) => (
                                                <button
                                                    key={n.id}
                                                    className={n.read ? "" : "unread"}
                                                    disabled={n.read}
                                                    onClick={async () => {
                                                        try {
                                                            await markNotificationRead(n.id);
                                                            setNotifications((v) =>
                                                                v.map((x) =>
                                                                    x.id === n.id
                                                                        ? { ...x, read: true }
                                                                        : x,
                                                                ),
                                                            );
                                                            setUnread((v) => Math.max(0, v - 1));
                                                        } catch {
                                                            setActionMessage(
                                                                "Impossible de marquer cette notification comme lue.",
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <span className="admin-notice-dot" />
                                                    <span>
                                                        <strong>{n.title}</strong>
                                                        <span>{n.message}</span>
                                                    </span>
                                                    <time dateTime={n.createdAt}>
                                                        {new Date(n.createdAt).toLocaleDateString(
                                                            "fr-MA",
                                                        )}
                                                    </time>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                    <footer className="admin-page-footer">
                        <span>IMAD Mode · Votre espace de gestion</span>
                        <Link href="/" target="_blank" rel="noreferrer">
                            Ouvrir la boutique <ArrowUpRight size={14} />
                        </Link>
                    </footer>
                </main>
            </div>
        </div>
    );
}
