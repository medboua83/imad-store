"use client";
import { BrandName } from "@/components/BrandingProvider";
import { useAdminLocale, AdminLanguageSelect } from "./admin-locale";
import { ADMIN_ORDERS_REFRESH_MS } from "@imad-store/shared";

import dynamic from "next/dynamic";
import { canAdmin } from "@imad-store/shared";
import { readAdminPresentation, ADMIN_PROFILE_KEY } from "@/lib/admin-session";
import { restoreAdminSession } from "@/lib/api";
import { AdminAccessContext, presentationAccess, presentationSessionKey, allowedAdminTab } from "./admin-access";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { initialOrderListFilters } from "./order-list-context";
import { initialInventoryListFilters } from "./inventory-list-context";
import { acceptAdminRead, startAdminRead, type AdminReadState } from "./read-version";
import {
    ShoppingCart,
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
    recoverAdminMfa,
    clearAdminSession,
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
const TeamTab = dynamic(() => import("./team-tab"), { loading: PendingView });
const GmailSettingsPanel = dynamic(() => import("./gmail-settings"), { loading: PendingView });
const PosTab = dynamic(() => import("./pos-tab"), { loading: PendingView });
const AccountTab = dynamic(() => import("./account-tab"), { loading: PendingView });
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
    | "commerce" | "pos" | "team" | "mail" | "account";
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
    { id: "pos" as Tab, label: "Caisse", description: "Encaissez les ventes en magasin et retrouvez vos tickets.", icon: ShoppingCart },
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
    { id: "team" as Tab, label: "Équipe et accès", description: "Les comptes et les permissions de votre équipe.", icon: Settings2 },
    { id: "mail" as Tab, label: "E-mails et SMTP", description: "Invitations et récupération des mots de passe.", icon: Settings2 },
    { id: "account" as Tab, label: "Mon compte", description: "Protégez votre accès à la boutique.", icon: Settings2 },
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
    const queryClient = useQueryClient();
    const [token, setToken] = useState<string | null>(null),
        [sessionReady, setSessionReady] = useState(false);
    const [email, setEmail] = useState(""),
        [password, setPassword] = useState(""),
        [showPassword, setShowPassword] = useState(false),
        [authError, setAuthError] = useState(""),
        [authLoading, setAuthLoading] = useState(false);
    const [mfaRequired, setMfaRequired] = useState(false), [mfaCode, setMfaCode] = useState(""), [recoveryMode, setRecoveryMode] = useState(false);
    const [resetMfa, setResetMfa] = useState(false), [resetMfaConfirmed, setResetMfaConfirmed] = useState(false), [authMessage, setAuthMessage] = useState("");
    const mfaInput = useRef<HTMLInputElement>(null), loginLock = useRef(false);
    useEffect(() => { if (mfaRequired) mfaInput.current?.focus(); }, [mfaRequired, recoveryMode]);
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
    const access = presentationAccess(token);
    const allowed = (tab: Tab) => allowedAdminTab(access, tab);
    const [openedTabs, setOpenedTabs] = useState<Tab[]>(["overview"]);
    const [orderFilters, setOrderFilters] = useState(initialOrderListFilters);
    const [inventoryFilters, setInventoryFilters] = useState(initialInventoryListFilters);
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
                // Fragment navigation must keep its own destination, including editor sections.
                // Focusing the page title here would undo the browser's anchor scroll.
                const anchor = document.getElementById(window.location.hash.slice(1));
                if (anchor?.closest("#admin-main") && anchor.getClientRects().length) {
                    if (!anchor.hasAttribute("tabindex")) anchor.tabIndex = -1;
                    anchor.focus({ preventScroll: true });
                    anchor.scrollIntoView({ block: "start", behavior: "instant" });
                } else mainTitle.current?.focus();
            });
        };
        let cancelled = false;
        const task = setTimeout(() => {
            restoreTab();
            void restoreAdminSession().then(value => { if (!cancelled) { setToken(value); setSessionReady(true); } });
        }, 0);
        window.addEventListener("popstate", previousOrNext);
        return () => {
            cancelled = true;
            clearTimeout(task);
            window.removeEventListener("popstate", previousOrNext);
        };
    }, []);
    useEffect(() => {
        const expire = (event?: Event) => {
            queryClient.clear();
            readState.current.session++;
            productSnapshot.current = [];
            setOrderFilters(initialOrderListFilters);
            setInventoryFilters(initialInventoryListFilters);
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
                event instanceof CustomEvent && event.detail === "password-changed"
                    ? "Mot de passe changé. Reconnectez-vous."
                    : event instanceof CustomEvent && event.detail === "mfa-changed"
                    ? "Protection du compte mise à jour. Reconnectez-vous."
                    : event instanceof CustomEvent && event.detail === "logout"
                    ? "Vous êtes déconnecté."
                    : "Votre session est terminée. Reconnectez-vous pour continuer.",
            );
        };
        const changed = (e: Event) => {
            if (e.type === "pageshow" && !(e as PageTransitionEvent).persisted) return;
            if (e instanceof StorageEvent && e.key !== "adminToken" && e.key !== ADMIN_PROFILE_KEY && e.key !== null) return;
            const value = readAdminPresentation();
            if (!value) { expire(); return; }
            const previous = presentationSessionKey(token), next = presentationSessionKey(value);
            if (!previous || previous !== next) {
                expire(); setOpenedTabs([tabFromLocation()]); setFocusedOrder(null); setFocusedProduct(undefined); setAuthError("");
            }
            setToken(value);
        };
        window.addEventListener("storage", changed);
        window.addEventListener("imad:session-changed", changed);
        window.addEventListener("pageshow", changed);
        window.addEventListener("imad:session-expired", expire);
        return () => {
            window.removeEventListener("storage", changed);
            window.removeEventListener("imad:session-changed", changed);
            window.removeEventListener("pageshow", changed);
            window.removeEventListener("imad:session-expired", expire);
        };
    }, [token, queryClient]);
    useEffect(() => {
        if (!token) return;
        const access = presentationAccess(token);
        let alive = true,
            busy = false;
        const sync = async () => {
            if (busy || document.hidden) return;
            busy = true;
            setSyncing(true);
            const request = startAdminRead(readState.current);
            const results = await Promise.allSettled([
                canAdmin(access, "orders.read") ? getAllOrders({ limit: 100 }) : Promise.resolve({ data: [], total: 0 }),
                (canAdmin(access, "catalogue.manage") || canAdmin(access, "content.manage")) ? getAdminProducts({ limit: 100 }) : Promise.resolve({ data: [], total: 0 }),
                getCategories(),
                canAdmin(access, "orders.read") ? getAdminNotifications() : Promise.resolve({ data: [], unread: 0 }),
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
        if (!token || !canAdmin(presentationAccess(token), "orders.read") || activeTab !== "orders" || orderTotal > orders.length) return;
        let alive = true,
            busy = false;
        const controller = new AbortController();
        const refreshOrders = async () => {
            if (busy || document.hidden) return;
            busy = true;
            const request = startAdminRead(readState.current);
            try {
                const result = await getAllOrders({ limit: 100 }, controller.signal);
                if (alive && acceptAdminRead(readState.current, "orders", request)) {
                    setOrders(result.data);
                    setOrderTotal(result.total);
                }
            } catch {
                // Retain the last successful list during an outage; the next tick retries.
            } finally {
                busy = false;
            }
        };
        const interval = setInterval(refreshOrders, ADMIN_ORDERS_REFRESH_MS);
        document.addEventListener("visibilitychange", refreshOrders);
        return () => {
            alive = false;
            controller.abort();
            clearInterval(interval);
            document.removeEventListener("visibilitychange", refreshOrders);
        };
    }, [token, activeTab, orderTotal, orders.length]);
    useEffect(() => {
        if (mobileMenu)
            (
                nav.current?.querySelector<HTMLButtonElement>('[aria-current="page"]') ||
                nav.current?.querySelector<HTMLButtonElement>("button")
            )?.focus();
    }, [mobileMenu]);
    const selectTab = (tab: Tab, productId?: string, orderId?: string) => {
        if (!allowed(tab)) return;
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
        if (loginLock.current) return;
        loginLock.current = true;
        setAuthLoading(true);
        setAuthError("");
        setAuthMessage("");
        try {
            if (mfaRequired && recoveryMode && resetMfa) {
                if (!resetMfaConfirmed) return;
                await recoverAdminMfa(email, password, mfaCode);
                setAuthError("");
                setMfaRequired(false); setRecoveryMode(false); setResetMfa(false); setResetMfaConfirmed(false); setMfaCode(""); setPassword("");
                setAuthMessage("Votre protection a été réinitialisée. Reconnectez-vous, puis configurez votre nouvelle application dans Mon compte.");
                return;
            }
            const r = await adminLogin(email, password, mfaRequired ? mfaCode : undefined);
            if (r.data.mfaRequired) { setMfaRequired(true); return; }
            if (!["ADMIN", "STAFF"].includes(presentationAccess(r.data.presentation).role)) throw new Error("Staff access required");
            readState.current.session++;
            productSnapshot.current = [];
            setPassword("");
            setMfaCode(""); setMfaRequired(false); setRecoveryMode(false);
            setOrderFilters(initialOrderListFilters);
            setAnalyticsDays(7);
            setInitialSyncReady(false);
            setSyncError("");
            setToken(r.data.presentation);
        } catch (error) {
            const message = isAxiosError(error) && typeof error.response?.data?.error === "string" ? error.response.data.error : null;
            setAuthError(mfaRequired && message && message !== "Invalid credentials" ? message : "Connexion impossible. Vérifiez vos identifiants et votre connexion.");
            if (mfaRequired) { if (!isAxiosError(error) || error.response?.status !== 409) setMfaCode(""); mfaInput.current?.focus(); }
        } finally {
            setAuthLoading(false);
            loginLock.current = false;
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
    useEffect(() => {
        const access = presentationAccess(token);
        if (!token) return;
        if (!["ADMIN", "STAFF"].includes(access.role)) {
            const task = setTimeout(() => clearAdminSession(), 0); return () => clearTimeout(task);
        }
        if (allowedAdminTab(access, activeTab)) return;
        const first = sections.find(s => s.id !== "account" && allowedAdminTab(access, s.id))?.id || "account";
        const timer = setTimeout(() => {
        setActiveTab(first); setOpenedTabs([first]);
        const url = new URL(window.location.href); url.searchParams.set("tab", first); url.searchParams.delete("order"); url.searchParams.delete("product");
        window.history.replaceState(null, "", url.pathname + url.search);
        }, 0);
        return () => clearTimeout(timer);
    }, [token, activeTab]);
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
                        <BrandLogo dark />
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
                    <span><BrandName /> · {t("Administration")}</span>
                </div>
                <main className="admin-auth-main">
                    <AdminLanguageSelect />
                    <form onSubmit={handleLogin} className="admin-login-card">
                        <p className="admin-eyebrow">{t("HEUREUX DE VOUS RETROUVER")}</p>
                        <h2>{t("Connexion à votre espace")}</h2>
                        <p className="admin-muted">
                            {t("Utilisez votre compte de la boutique pour continuer.")}
                        </p>
                        {authError && (
                            <p className="admin-alert" role="alert">
                                {t(authError)}
                            </p>
                        )}
                        {authMessage && <p role="status">{t(authMessage)}</p>}
                        <label htmlFor="admin-email">{t("Adresse e-mail")}</label>
                        <input
                            dir="auto"
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            readOnly={mfaRequired}
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
                                readOnly={mfaRequired}
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
                        {mfaRequired && <div className="admin-mfa-login">
                            <p role="status">{t("Votre mot de passe est correct. Confirmez maintenant votre identité.")}</p>
                            <label htmlFor="admin-mfa-code">{t(recoveryMode ? "Code de secours" : "Code de l’application")}</label>
                            <input ref={mfaInput} id="admin-mfa-code" dir="ltr" autoComplete="one-time-code" inputMode={recoveryMode ? "text" : "numeric"} required
                                pattern={recoveryMode ? undefined : "[0-9]{6}"} maxLength={recoveryMode ? 80 : 6} value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                            <p className="admin-scope">{t(recoveryMode ? "Chaque code de secours ne peut servir qu’une seule fois." : "Saisissez les 6 chiffres de votre application. Un code déjà utilisé ne peut pas resservir.")}</p>
                            {recoveryMode && <>
                                <button type="button" className="admin-text-button" disabled={authLoading} onClick={() => { setResetMfa(v => !v); setResetMfaConfirmed(false); setAuthError(""); }}>{t(resetMfa ? "Revenir à la connexion" : "J’ai perdu mon téléphone")}</button>
                                {resetMfa && <label className="team-check"><input type="checkbox" required checked={resetMfaConfirmed} onChange={e => setResetMfaConfirmed(e.target.checked)} />{t("Réinitialiser ma double authentification et fermer toutes mes sessions avec ce code de secours.")}</label>}
                            </>}
                            <button type="button" className="admin-text-button" disabled={authLoading} onClick={() => { setRecoveryMode(v => !v); setResetMfa(false); setResetMfaConfirmed(false); setMfaCode(""); setAuthError(""); }}>{t(recoveryMode ? "Utiliser l’application" : "Utiliser un code de secours")}</button>
                            <button type="button" className="admin-text-button" disabled={authLoading} onClick={() => { setMfaRequired(false); setMfaCode(""); setPassword(""); setRecoveryMode(false); setResetMfa(false); setResetMfaConfirmed(false); setAuthError(""); }}>{t("Changer de compte")}</button>
                        </div>}
                        <button className="admin-button primary" disabled={authLoading || resetMfa && !resetMfaConfirmed}>
                            {authLoading ? t("Connexion en cours…") : t(resetMfa ? "Réinitialiser ma protection" : "Se connecter")}
                            <ArrowUpRight size={18} aria-hidden="true" />
                        </button>
                        <Link href="/admin/password" className="admin-text-button">{t("Mot de passe oublié")}</Link>
                        <Link href="/" className="admin-back-link">
                            {t("Retour à la boutique")}
                        </Link>
                    </form>
                </main>
            </div>
        );
    return (
        <AdminAccessContext.Provider key={presentationSessionKey(token) ?? token} value={access}><div
            className="admin-app admin-workspace"
            data-tab={activeTab}
            dir={locale === "ar" ? "rtl" : "ltr"}
            lang={locale}
        >
            <a className="skip-link" href="#admin-main">
                {t("Aller au contenu")}
            </a>
            <aside className="admin-sidebar">
                <Link href="/" className="brand-wordmark">
                    <BrandLogo dark />
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
                    {sections.filter(({ id }) => allowed(id)).map(({ id, label, icon: Icon }) => (
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
                        {canAdmin(access, "orders.read") && (
                        <button
                            className="admin-icon-button"
                            aria-label={t("Notifications, {0} non lues", { "0": unread })}
                            onClick={() => selectTab("notifications")}
                        >
                            <Bell size={19} />
                            {unread > 0 && <span className="admin-dot" />}
                        </button>
                        )}
                    </div>
                </header>
                <main id="admin-main" className="admin-main">
                    <div className="admin-page-heading">
                        <div>
                            <p className="admin-eyebrow"><BrandName original="IMAD" /> · {t("GESTION DE LA BOUTIQUE")}</p>
                            <h1 ref={mainTitle} tabIndex={-1}>
                                {t(current.label)}
                            </h1>
                            <p>{t(current.description)}</p>
                        </div>
                        {allowed("overview") && activeTab === "overview" && (
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
                    {!initialSyncReady || !allowed(activeTab) ? (
                        <div className="admin-loading" role="status">
                            {t("Chargement des données…")}
                        </div>
                    ) : (
                        <>
                            {allowed("overview") && activeTab === "overview" && (
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
                                        setInventoryFilters({ ...initialInventoryListFilters, stock });
                                        selectTab("inventory");
                                    }}
                                />
                            )}
                            {activeTab === "pos" && <PosTab />}
                            {activeTab === "team" && <TeamTab />}
                            {activeTab === "mail" && <GmailSettingsPanel />}
                            {activeTab === "account" && <AccountTab />}
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
                                    filters={inventoryFilters} onFilters={setInventoryFilters}
                                    onProduct={(id) => selectTab("products", id)} />
                            )}
                            {allowed("products") && openedTabs.includes("products") && (
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
                            {allowed("categories") && openedTabs.includes("categories") && (
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
                            {allowed("content") && openedTabs.includes("content") && (
                                <div hidden={activeTab !== "content"}>
                                    <ContentTab />
                                </div>
                            )}
                            {activeTab === "analytics" && (
                                <AnalyticsTab days={analyticsDays} setDays={setAnalyticsDays}
                                    onOpenOrders={allowed("orders") ? () => selectTab("orders") : undefined} />
                            )}
                            {allowed("commerce") && openedTabs.includes("commerce") && (
                                <div hidden={activeTab !== "commerce"}>
                                    <CommerceTab active={activeTab === "commerce"} />
                                </div>
                            )}
                            {allowed("deskcomm") && openedTabs.includes("deskcomm") && (
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
                        <span><BrandName /> · {t("Votre espace de gestion")}</span>
                        <Link href="/" target="_blank" rel="noreferrer">
                            {t("Ouvrir la boutique ")}
                            <ArrowUpRight size={14} />
                        </Link>
                    </footer>
                </main>
            </div>
        </div></AdminAccessContext.Provider>
    );
}
