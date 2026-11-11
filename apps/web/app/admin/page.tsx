"use client";
import { useAdminLocale, AdminLanguageSelect } from "./admin-locale";

import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useEffect, useRef, useState } from "react";
import { initialOrderListFilters } from "./order-list-context";
import type { InventoryStatus } from "./product-utils";
import { acceptAdminRead, startAdminRead, type AdminReadState } from "./read-version";
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
    Boxes,
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
import "./product-editor.css";
function PendingView() {
    const { t } = useAdminLocale();
    return (
        <div className="admin-loading" role="status">
            {t("Chargement de votre espace…")}
        </div>
    );
}
const OverviewTab = dynamic(() => import("./tabs").then((m) => m.OverviewTab), {
    loading: PendingView,
});
const OrdersTab = dynamic(() => import("./tabs").then((m) => m.OrdersTab), {
    loading: PendingView,
});
const CategoriesTab = dynamic(() => import("./tabs").then((m) => m.CategoriesTab), {
    loading: PendingView,
});
const ProductsTab = dynamic(() => import("./products-tab").then((m) => m.ProductsTab), {
    loading: PendingView,
});
const CommerceTab = dynamic(() => import("./commerce-tab"), { loading: PendingView });
const InventoryTab = dynamic(() => import("./inventory-tab"), { loading: PendingView });
const ContentTab = dynamic(() => import("./content-tab"), { loading: PendingView });
const AnalyticsTab = dynamic(() => import("./analytics-tab"), { loading: PendingView });
const DeskcommTab = dynamic(() => import("./deskcomm-tab"), { loading: PendingView });
type Tab =
    | "overview"
    | "orders"
    | "products"
    | "inventory"
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
        id: "inventory" as Tab,
        label: "Stock",
        description: "Retrouvez les quantités disponibles de chaque variante.",
        icon: Boxes,
    },
    {
        id: "categories" as Tab,
        label: "Catégories",
        description: "Organisez votre collection pour vos visiteurs.",
        icon: Grid2X2,
    },
    {
        id: "analytics" as Tab,
        label: "Statistiques",
        description: "Comprenez les visites, les produits consultés et les commandes.",
        icon: ChartNoAxesCombined,
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
        description: "Commandes, réseaux sociaux, livraison et Meta Pixel.",
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
function tabFromLocation(): Tab {
    const values = new URLSearchParams(window.location.search).getAll("tab");
    return values.length === 1
        ? sections.find(({ id }) => id === values[0])?.id || "overview"
        : "overview";
}
function productFromLocation(tab: Tab) {
    const values = new URLSearchParams(window.location.search).getAll("product");
    return tab === "products" && values.length === 1 && /^[a-f0-9]{24}$/i.test(values[0])
        ? values[0]
        : undefined;
}
function orderFromLocation(tab: Tab) {
    const values = new URLSearchParams(window.location.search).getAll("order");
    return tab === "orders" && values.length === 1 && /^[a-f0-9]{24}$/i.test(values[0])
        ? values[0]
        : null;
}
export default function AdminPage() {
    const { t, locale } = useAdminLocale();
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
        [initialSyncReady, setInitialSyncReady] = useState(false),
        [lastSync, setLastSync] = useState<Date | null>(null);
    const [openedTabs, setOpenedTabs] = useState<Tab[]>(["overview"]);
    const [orderFilters, setOrderFilters] = useState(initialOrderListFilters);
    const [inventoryStock, setInventoryStock] = useState<InventoryStatus>("ALL");
    const [focusedProduct, setFocusedProduct] = useState<string>();
    const [focusedOrder, setFocusedOrder] = useState<string | null>(null);
    const [analyticsDays, setAnalyticsDays] = useState(7);
    const readState = useRef<AdminReadState>({
        session: 0,
        sequence: 0,
        applied: { orders: 0, products: 0, categories: 0, notifications: 0 },
    });
    const productSnapshot = useRef<Product[]>([]);
    const mainTitle = useRef<HTMLHeadingElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null),
        nav = useRef<HTMLElement>(null);
    useEffect(() => {
        const restoreTab = () => {
            const tab = tabFromLocation();
            setActiveTab(tab);
            setFocusedProduct(productFromLocation(tab));
            setFocusedOrder(orderFromLocation(tab));
            setOpenedTabs((tabs) => (tabs.includes(tab) ? tabs : [...tabs, tab]));
            setMobileMenu(false);
            setActionMessage("");
        };
        const previousOrNext = () => {
            restoreTab();
            requestAnimationFrame(() => {
                const anchor = tabFromLocation() === "commerce"
                    ? document.getElementById(window.location.hash.slice(1)) : null;
                (anchor || mainTitle.current)?.focus();
            });
        };
        const task = setTimeout(() => {
            restoreTab();
            setToken(localStorage.getItem("adminToken"));
            setSessionReady(true);
        }, 0);
        window.addEventListener("popstate", previousOrNext);
        return () => {
            clearTimeout(task);
            window.removeEventListener("popstate", previousOrNext);
        };
    }, []);
    useEffect(() => {
        const expire = (event?: Event) => {
            readState.current.session++;
            productSnapshot.current = [];
            setOrderFilters(initialOrderListFilters);
            setInventoryStock("ALL");
            setAnalyticsDays(7);
            setToken(null);
            setOrders([]);
            setProducts([]);
            setCategories([]);
            setNotifications([]);
            setUnread(0);
            setLastSync(null);
            setInitialSyncReady(false);
            setSyncing(false);
            setSyncError("");
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
            const request = startAdminRead(readState.current);
            const results = await Promise.allSettled([
                getAllOrders({ limit: 100 }),
                getAdminProducts({ limit: 100 }),
                getCategories(),
                getAdminNotifications(),
            ]);
            if (alive && request.session === readState.current.session) {
                const [o, p, c, n] = results;
                if (
                    o.status === "fulfilled" &&
                    acceptAdminRead(readState.current, "orders", request)
                ) {
                    setOrders(o.value.data);
                    setOrderTotal(o.value.total);
                }
                if (
                    p.status === "fulfilled" &&
                    acceptAdminRead(readState.current, "products", request)
                ) {
                    productSnapshot.current = p.value.data;
                    setProducts(p.value.data);
                    setProductTotal(p.value.total);
                }
                if (
                    c.status === "fulfilled" &&
                    acceptAdminRead(readState.current, "categories", request)
                )
                    setCategories(c.value);
                if (
                    n.status === "fulfilled" &&
                    acceptAdminRead(readState.current, "notifications", request)
                ) {
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
                setInitialSyncReady(true);
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
        if (mobileMenu)
            (
                nav.current?.querySelector<HTMLButtonElement>('[aria-current="page"]') ||
                nav.current?.querySelector<HTMLButtonElement>("button")
            )?.focus();
    }, [mobileMenu]);
    const selectTab = (tab: Tab, productId?: string, orderId?: string) => {
        const url = new URL(window.location.href);
        if (tab === "overview") url.searchParams.delete("tab");
        else url.searchParams.set("tab", tab);
        if (tab === "products" && productId) url.searchParams.set("product", productId);
        else url.searchParams.delete("product");
        if (tab === "orders" && orderId) url.searchParams.set("order", orderId);
        else url.searchParams.delete("order");
        url.hash = "";
        if (url.href !== window.location.href)
            window.history.pushState(null, "", url.pathname + url.search + url.hash);
        setActiveTab(tab);
        setFocusedProduct(productId);
        setFocusedOrder(orderId || null);
        setOpenedTabs((tabs) => (tabs.includes(tab) ? tabs : [...tabs, tab]));
        requestAnimationFrame(() => mainTitle.current?.focus());
        setMobileMenu(false);
        setActionMessage("");
    };
    const selectOrder = (id: string | null) => {
        const url = new URL(window.location.href);
        if (id) url.searchParams.set("order", id);
        else url.searchParams.delete("order");
        if (url.href !== window.location.href) {
            if (id) window.history.pushState(null, "", url.pathname + url.search + url.hash);
            else window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
        setFocusedOrder(id);
    };
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError("");
        try {
            const r = await adminLogin(email, password);
            readState.current.session++;
            productSnapshot.current = [];
            localStorage.setItem("adminToken", r.data.accessToken);
            localStorage.setItem("adminRefresh", r.data.refreshToken);
            setPassword("");
            setOrderFilters(initialOrderListFilters);
            setAnalyticsDays(7);
            setInitialSyncReady(false);
            setSyncError("");
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
        const request = startAdminRead(readState.current);
        const r = await getAdminProducts({ limit: 100 });
        if (request.session !== readState.current.session) return [];
        if (acceptAdminRead(readState.current, "products", request)) {
            productSnapshot.current = r.data;
            setProducts(r.data);
            setProductTotal(r.total);
        }
        return productSnapshot.current;
    }
    async function refreshOrders() {
        const request = startAdminRead(readState.current);
        const r = await getAllOrders({ limit: 100 });
        if (acceptAdminRead(readState.current, "orders", request)) {
            setOrders(r.data);
            setOrderTotal(r.total);
        }
    }
    async function refreshCategories() {
        const request = startAdminRead(readState.current);
        const r = await getCategories();
        if (acceptAdminRead(readState.current, "categories", request)) setCategories(r);
    }
    const current = sections.find((s) => s.id === activeTab)!;
    if (!sessionReady)
        return (
            <div
                className="admin-app admin-session"
                dir={locale === "ar" ? "rtl" : "ltr"}
                lang={locale}
                role="status"
            >
                {t("Ouverture de l’administration…")}
            </div>
        );
    if (!token)
        return (
            <div
                className="admin-app admin-auth"
                dir={locale === "ar" ? "rtl" : "ltr"}
                lang={locale}
            >
                <div className="admin-auth-story">
                    <Link href="/" className="brand-wordmark">
                        <BrandLogo />
                    </Link>
                    <div>
                        <p className="admin-eyebrow">{t("VOTRE ESPACE BOUTIQUE")}</p>
                        <h1>
                            {t("Tout commence")}
                            <br />
                            {t("par les détails.")}
                        </h1>
                        <p>
                            {t("Votre collection, vos commandes et votre quotidien.")}
                            <br />
                            {t("Un espace pour tout garder en vue.")}
                        </p>
                    </div>
                    <span>{t("IMAD Mode · Administration")}</span>
                </div>
                <main className="admin-auth-main">
                    <AdminLanguageSelect />
                    <form onSubmit={handleLogin} className="admin-login-card">
                        <p className="admin-eyebrow">{t("HEUREUX DE VOUS RETROUVER")}</p>
                        <h2>{t("Connexion à votre espace")}</h2>
                        <p className="admin-muted">
                            {t("Utilisez votre compte administrateur pour continuer.")}
                        </p>
                        {authError && (
                            <p className="admin-alert" role="alert">
                                {t(authError)}
                            </p>
                        )}
                        <label htmlFor="admin-email">{t("Adresse e-mail")}</label>
                        <input
                            dir="auto"
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("vous@exemple.ma")}
                        />
                        <label htmlFor="admin-password">{t("Mot de passe")}</label>
                        <div className="admin-password">
                            <input
                                dir="auto"
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
                                        ? t("Masquer le mot de passe")
                                        : t("Afficher le mot de passe")
                                }
                                aria-pressed={showPassword}
                                onClick={() => setShowPassword((v) => !v)}
                            >
                                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                            </button>
                        </div>
                        <button className="admin-button primary" disabled={authLoading}>
                            {authLoading ? t("Connexion en cours…") : t("Se connecter")}
                            <ArrowUpRight size={18} aria-hidden="true" />
                        </button>
                        <Link href="/" className="admin-back-link">
                            {t("Retour à la boutique")}
                        </Link>
                    </form>
                </main>
            </div>
        );
    return (
        <div
            className="admin-app admin-workspace"
            dir={locale === "ar" ? "rtl" : "ltr"}
            lang={locale}
        >
            <a className="skip-link" href="#admin-main">
                {t("Aller au contenu")}
            </a>
            <aside className="admin-sidebar">
                <Link href="/" className="brand-wordmark">
                    <BrandLogo />
                </Link>
                <p className="admin-sidebar-label">{t("ESPACE ADMINISTRATION")}</p>
                <button
                    ref={menuButton}
                    className="admin-mobile-menu"
                    aria-expanded={mobileMenu}
                    aria-controls="admin-navigation"
                    onClick={() => setMobileMenu((v) => !v)}
                >
                    {mobileMenu ? <X size={20} /> : <Menu size={20} />}
                    {t("Navigation")}
                </button>
                <nav
                    ref={nav}
                    id="admin-navigation"
                    className={mobileMenu ? "is-open" : ""}
                    aria-label={t("Administration")}
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
                            <span>{t(label)}</span>
                            {id === "notifications" && unread > 0 && (
                                <span className="admin-count">{unread}</span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="admin-sidebar-bottom">
                    <Link href="/" target="_blank" rel="noreferrer">
                        <ArrowUpRight size={17} aria-hidden="true" />
                        {t("Voir la boutique")}
                    </Link>
                    <button onClick={logout}>
                        <LogOut size={17} aria-hidden="true" />
                        {t("Se déconnecter")}
                    </button>
                </div>
            </aside>
            <div className="admin-body">
                <header className="admin-topbar">
                    <p>
                        {t("Votre boutique ")}
                        <span>/ {t(current.label)}</span>
                    </p>
                    <div className="admin-topbar-actions">
                        <AdminLanguageSelect />
                        <span className={`admin-sync ${syncError ? "has-error" : ""}`}>
                            <i />
                            {syncing
                                ? t("Actualisation…")
                                : syncError
                                  ? t("Actualisation incomplète")
                                  : lastSync
                                    ? t("À jour à {0}", {
                                          "0": lastSync.toLocaleTimeString(
                                              locale === "ar" ? "ar-MA" : "fr-MA",
                                              {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  timeZone: "Africa/Casablanca",
                                              },
                                          ),
                                      })
                                    : t("Chargement initial")}
                        </span>
                        <button
                            className="admin-icon-button"
                            aria-label={t("Actualiser les données")}
                            disabled={syncing}
                            onClick={() => window.dispatchEvent(new Event("imad:sync"))}
                        >
                            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
                        </button>
                        <button
                            className="admin-icon-button"
                            aria-label={t("Notifications, {0} non lues", { "0": unread })}
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
                            <p className="admin-eyebrow">{t("IMAD · GESTION DE LA BOUTIQUE")}</p>
                            <h1 ref={mainTitle} tabIndex={-1}>
                                {t(current.label)}
                            </h1>
                            <p>{t(current.description)}</p>
                        </div>
                        {activeTab === "overview" && (
                            <button
                                className="admin-button primary"
                                onClick={() => selectTab("products")}
                            >
                                <ShoppingBag size={17} />
                                {t("Gérer les produits")}
                            </button>
                        )}
                    </div>
                    {syncError && (
                        <div className="admin-alert" role="alert">
                            {t(syncError)}
                            <button onClick={() => window.dispatchEvent(new Event("imad:sync"))}>
                                {t("Réessayer")}
                            </button>
                        </div>
                    )}
                    {actionMessage && (
                        <p className="admin-feedback" role="status">
                            {t(actionMessage)}
                        </p>
                    )}
                    {!initialSyncReady ? (
                        <div className="admin-loading" role="status">
                            {t("Chargement des données…")}
                        </div>
                    ) : (
                        <>
                            {activeTab === "overview" && (
                                <OverviewTab
                                    orders={orders}
                                    products={products}
                                    orderTotal={orderTotal}
                                    productTotal={productTotal}
                                    onOrders={(status) => {
                                        setOrderFilters({ ...initialOrderListFilters, status });
                                        selectTab("orders");
                                    }}
                                    onOrder={(id) => {
                                        setOrderFilters(initialOrderListFilters);
                                        selectTab("orders", undefined, id);
                                    }}
                                    onInventory={(stock) => {
                                        setInventoryStock(stock);
                                        selectTab("inventory");
                                    }}
                                />
                            )}
                            {activeTab === "orders" && (
                                <OrdersTab
                                    orders={orders}
                                    total={orderTotal}
                                    onRefresh={refreshOrders}
                                    filters={orderFilters}
                                    setFilters={setOrderFilters}
                                    selected={focusedOrder}
                                    onSelect={selectOrder}
                                />
                            )}
                            {activeTab === "inventory" && (
                                <InventoryTab products={products} total={productTotal}
                                    stock={inventoryStock} onStock={setInventoryStock}
                                    onProduct={(id) => selectTab("products", id)} />
                            )}
                            {openedTabs.includes("products") && (
                                <div hidden={activeTab !== "products"}>
                                    <ProductsTab
                                        active={activeTab === "products"}
                                        products={products}
                                        categories={categories}
                                        total={productTotal}
                                        focusedProduct={focusedProduct}
                                        clearProductFocus={() => selectTab("products")}
                                        onRefresh={refreshProducts}
                                        onCreate={async (d) => {
                                            const session = readState.current.session;
                                            await createProduct(d);
                                            if (session !== readState.current.session) return false;
                                            try {
                                                await refreshProducts();
                                                return true;
                                            } catch {
                                                return false;
                                            }
                                        }}
                                        onUpdate={async (id, d) => {
                                            const session = readState.current.session;
                                            await updateProduct(id, d);
                                            if (session !== readState.current.session) return false;
                                            try {
                                                await refreshProducts();
                                                return true;
                                            } catch {
                                                return false;
                                            }
                                        }}
                                        onDelete={async (id) => {
                                            const session = readState.current.session;
                                            await deleteProduct(id);
                                            if (session !== readState.current.session) return false;
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
                            {openedTabs.includes("categories") && (
                                <div hidden={activeTab !== "categories"}>
                                    <CategoriesTab
                                        categories={categories}
                                        onCreate={async (d) => {
                                            const session = readState.current.session;
                                            await createCategory(d);
                                            if (session === readState.current.session)
                                                await refreshCategories();
                                        }}
                                        onDelete={async (id) => {
                                            const session = readState.current.session;
                                            await deleteCategory(id);
                                            if (session === readState.current.session)
                                                await refreshCategories();
                                        }}
                                    />
                                </div>
                            )}
                            {openedTabs.includes("content") && (
                                <div hidden={activeTab !== "content"}>
                                    <ContentTab />
                                </div>
                            )}
                            {activeTab === "analytics" && (
                                <AnalyticsTab days={analyticsDays} setDays={setAnalyticsDays} />
                            )}
                            {openedTabs.includes("commerce") && (
                                <div hidden={activeTab !== "commerce"}>
                                    <CommerceTab active={activeTab === "commerce"} />
                                </div>
                            )}
                            {openedTabs.includes("deskcomm") && (
                                <div hidden={activeTab !== "deskcomm"}>
                                    <DeskcommTab />
                                </div>
                            )}
                            {activeTab === "notifications" && (
                                <section className="admin-panel">
                                    <div className="admin-panel-heading">
                                        <div>
                                            <h2>{t("Dernières notifications")}</h2>
                                            <p>
                                                {unread}
                                                {t(" non lue")}
                                                {unread !== 1 ? t("s") : ""}
                                            </p>
                                        </div>
                                        <button
                                            className="admin-button"
                                            disabled={!unread}
                                            onClick={async () => {
                                                const session = readState.current.session;
                                                try {
                                                    await markAllNotificationsRead();
                                                    if (session !== readState.current.session)
                                                        return;
                                                    acceptAdminRead(
                                                        readState.current,
                                                        "notifications",
                                                        startAdminRead(readState.current),
                                                    );
                                                    setNotifications((v) =>
                                                        v.map((n) => ({ ...n, read: true })),
                                                    );
                                                    setUnread(0);
                                                } catch {
                                                    if (session !== readState.current.session)
                                                        return;
                                                    setActionMessage(
                                                        "Impossible de mettre à jour les notifications. Réessayez.",
                                                    );
                                                }
                                            }}
                                        >
                                            <CheckCheck size={17} />
                                            {t("Tout marquer comme lu")}
                                        </button>
                                    </div>
                                    {!notifications.length ? (
                                        <p className="admin-empty">
                                            {t("Aucune notification pour le moment.")}
                                        </p>
                                    ) : (
                                        <div className="admin-notices">
                                            {notifications.map((n) => (
                                                <button
                                                    key={n.id}
                                                    className={n.read ? "" : "unread"}
                                                    disabled={n.read}
                                                    onClick={async () => {
                                                        const session = readState.current.session;
                                                        try {
                                                            await markNotificationRead(n.id);
                                                            if (
                                                                session !==
                                                                readState.current.session
                                                            )
                                                                return;
                                                            acceptAdminRead(
                                                                readState.current,
                                                                "notifications",
                                                                startAdminRead(readState.current),
                                                            );
                                                            setNotifications((v) =>
                                                                v.map((x) =>
                                                                    x.id === n.id
                                                                        ? { ...x, read: true }
                                                                        : x,
                                                                ),
                                                            );
                                                            setUnread((v) => Math.max(0, v - 1));
                                                        } catch {
                                                            if (
                                                                session !==
                                                                readState.current.session
                                                            )
                                                                return;
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
                                                            locale === "ar" ? "ar-MA" : "fr-MA",
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
                        <span>{t("IMAD Mode · Votre espace de gestion")}</span>
                        <Link href="/" target="_blank" rel="noreferrer">
                            {t("Ouvrir la boutique ")}
                            <ArrowUpRight size={14} />
                        </Link>
                    </footer>
                </main>
            </div>
        </div>
    );
}
