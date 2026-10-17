"use client";

import { useState, useEffect } from "react";
import { Bell, Package, LogOut, RefreshCw, ExternalLink, Check, LayoutDashboard, ShoppingBag, Image as ImageIcon, Grid, Settings } from "lucide-react";
import { adminLogin, getAdminNotifications, markAllNotificationsRead, markNotificationRead, getAllOrders, getProducts, getCategories, createProduct, updateProduct, deleteProduct, createCategory, deleteCategory, Product, Category } from "@/lib/api";
import DeskcommTab from "./deskcomm-tab";
import { OverviewTab, ProductsTab, BannersTab, CategoriesTab, HomepageBuilderTab, OrdersTab } from "./tabs";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    orderId?: string;
    read: boolean;
    createdAt: string;
}

interface Order {
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    city: string | null;
    region: string | null;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
}

const POLL_INTERVAL_MS = 5000;

type Tab = "overview" | "notifications" | "orders" | "products" | "banners" | "categories" | "settings" | "deskcomm";

export default function AdminPage() {
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authError, setAuthError] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [lastSync, setLastSync] = useState<Date | null>(null);

    // Load token from localStorage on mount
    useEffect(() => {
        const t = localStorage.getItem("adminToken");
        if (t) setToken(t);
    }, []);

    // Initial load of products and categories
    useEffect(() => {
        if (!token) return;
        getProducts({ limit: 100 }).then(res => setProducts(res.data)).catch(console.error);
        getCategories().then(setCategories).catch(console.error);
    }, [token]);

    // Polling for notifications and orders when authenticated
    useEffect(() => {
        if (!token) return;

        const tick = async () => {
            try {
                const [nRes, oRes] = await Promise.all([
                    getAdminNotifications(),
                    getAllOrders({ limit: 100 }).catch(() => ({ data: [] as unknown as Order[] })),
                ]);
                setNotifications(nRes.data);
                setUnread(nRes.unread);
                setOrders((oRes.data ?? []) as Order[]);
                setLastSync(new Date());
            } catch (err) {
                console.error("Polling failed:", err);
            }
        };

        tick();
        const id = setInterval(tick, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [token]);

    // Handle login form submission
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setAuthLoading(true);
        try {
            const res = await adminLogin(email, password);
            const t = res.data.accessToken;
            localStorage.setItem("adminToken", t);
            localStorage.setItem("adminRefresh", res.data.refreshToken);
            setToken(t);
        } catch {
            setAuthError("Invalid credentials");
        } finally {
            setAuthLoading(false);
        }
    };

    // Handle logout
    const logout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminRefresh");
        setToken(null);
    };

    // Render login form when not authenticated
    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A1A2E] to-[#0f0f1e] px-4">
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-white/5 backdrop-blur border border-white/10 p-8 rounded-2xl shadow-2xl">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-light text-white tracking-widest" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            IMAD MODE
                        </h1>
                        <p className="text-[#C9A96E] text-[10px] tracking-[0.4em] uppercase mt-2">Admin Dashboard</p>
                    </div>
                    {authError ? (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded">
                            {authError}
                        </div>
                    ) : null}
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full mb-3 bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A96E]"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full mb-6 bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#C9A96E]"
                    />
                    <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-[#C9A96E] hover:bg-[#b09055] text-[#1A1A2E] text-xs tracking-[0.25em] uppercase font-bold py-3 transition-colors disabled:opacity-50"
                    >
                        {authLoading ? "..." : "Sign In"}
                    </button>
                </form>
            </div>
        );
    }

    const tabClass = (id: Tab) => `relative px-4 py-4 text-xs tracking-[0.2em] uppercase font-medium transition-colors ${activeTab === id ? "text-[#C9A96E]" : "text-white/50 hover:text-white/80"}`;

    return (
        <div className="min-h-screen bg-[#0f0f1e] text-white">
            <header className="border-b border-white/10 bg-[#1A1A2E] sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-light tracking-widest" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            IMAD <span className="text-[#C9A96E]">Mode</span>
                        </h1>
                        <p className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">Admin Dashboard</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] text-white/50 tracking-widest uppercase" suppressHydrationWarning>
                            <span className={`w-2 h-2 rounded-full ${lastSync ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
                            {lastSync ? `Live · ${lastSync.toLocaleTimeString()}` : "Connecting…"}
                        </div>
                        <button onClick={logout} className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Logout">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="border-b border-white/10 overflow-x-auto hide-scrollbar bg-[#1A1A2E]/50">
                <div className="max-w-7xl mx-auto px-4 flex min-w-max">
                    <button onClick={() => setActiveTab("overview")} className={tabClass("overview")}>
                        <LayoutDashboard size={14} className="inline mr-2" /> Overview
                        {activeTab === "overview" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("orders")} className={tabClass("orders")}>
                        <Package size={14} className="inline mr-2" /> Orders ({orders.length})
                        {activeTab === "orders" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("products")} className={tabClass("products")}>
                        <ShoppingBag size={14} className="inline mr-2" /> Products ({products.length})
                        {activeTab === "products" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("categories")} className={tabClass("categories")}>
                        <Grid size={14} className="inline mr-2" /> Categories
                        {activeTab === "categories" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("banners")} className={tabClass("banners")}>
                        <ImageIcon size={14} className="inline mr-2" /> Banners
                        {activeTab === "banners" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("settings")} className={tabClass("settings")}>
                        <Settings size={14} className="inline mr-2" /> Home Builder
                        {activeTab === "settings" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("deskcomm")} className={tabClass("deskcomm")}>
                        <Settings size={14} className="inline mr-2" /> DeskcommCRM
                        {activeTab === "deskcomm" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                    <button onClick={() => setActiveTab("notifications")} className={tabClass("notifications")}>
                        <Bell size={14} className="inline mr-2" /> Alerts
                        {unread > 0 && <span className="ml-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unread}</span>}
                        {activeTab === "notifications" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />}
                    </button>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === "overview" && <OverviewTab orders={orders} products={products} />}
                
                {activeTab === "products" && (
                    <ProductsTab 
                        products={products} 
                        categories={categories}
                        onCreate={async (d) => { await createProduct(d); const res = await getProducts({ limit: 100 }); setProducts(res.data); }}
                        onUpdate={async (id, d) => { await updateProduct(id, d); const res = await getProducts({ limit: 100 }); setProducts(res.data); }}
                        onDelete={async (id) => { await deleteProduct(id); const res = await getProducts({ limit: 100 }); setProducts(res.data); }}
                    />
                )}

                {activeTab === "categories" && (
                    <CategoriesTab 
                        categories={categories}
                        onCreate={async (d) => { await createCategory(d); const res = await getCategories(); setCategories(res); }}
                        onDelete={async (id) => { await deleteCategory(id); const res = await getCategories(); setCategories(res); }}
                    />
                )}

                {activeTab === "settings" && <HomepageBuilderTab />}
                {activeTab === "deskcomm" && <DeskcommTab />}

                {activeTab === "banners" && <BannersTab />}

                {activeTab === "notifications" && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg tracking-widest uppercase">Real-Time Notifications</h2>
                            {unread > 0 && (
                                <button
                                    onClick={async () => { await markAllNotificationsRead(); setUnread(0); setNotifications((n) => n.map((x) => ({ ...x, read: true }))); }}
                                    className="text-[10px] text-[#C9A96E] tracking-widest uppercase flex items-center gap-1 hover:underline"
                                >
                                    <Check size={12} /> Mark all read
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {notifications.length === 0 ? (
                                <div className="text-center py-16 text-white/40 text-sm">No notifications yet</div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => !n.read && markNotificationRead(n.id).then(() => {
                                            setNotifications((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x));
                                            setUnread((u) => u - 1);
                                        })}
                                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${n.read ? "bg-white/2 border-white/5" : "bg-[#C9A96E]/10 border-[#C9A96E]/30"}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className={`text-sm ${n.read ? "text-white/60" : "text-white font-medium"}`}>{n.title}</p>
                                                <p className="text-xs text-white/40 mt-1">{n.message}</p>
                                            </div>
                                            <span className="text-[10px] text-white/30 tracking-widest uppercase shrink-0" suppressHydrationWarning>
                                                {new Date(n.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "orders" && (
                    <OrdersTab
                        orders={orders}
                        onRefresh={async () => {
                            const o = await getAllOrders({ limit: 100 });
                            setOrders((o.data ?? []) as Order[]);
                        }}
                    />
                )}
            </main>
        </div>
    );
}