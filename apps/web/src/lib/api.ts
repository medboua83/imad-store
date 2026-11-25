import { adminPresentationBinding, readAdminPresentation, hasBrowserProfile, storeBrowserIdentity, removeAdminPresentation, type AdminBrowserIdentity } from "./admin-session";
import { analyticsOrderHeaders } from "./store-analytics";
import { assertAssistanceReceipt } from "./checkout-assistance";
import axios from "axios";
import type { SiteContent } from "@imad-store/shared";

export const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL || "/api";
    url = url.replace(/\/$/, ""); // remove trailing slash

    // Fix double /api/api if misconfigured
    if (url.endsWith("/api/api")) {
        url = url.replace(/\/api\/api$/, "/api");
    } else if (!url.endsWith("/api")) {
        // If they just provided the domain, append /api
        url += "/api";
    }
    return url;
};

const api = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
});

export function clearAdminSession(reason: "expired" | "logout" | "password-changed" = "expired") {
    if (typeof window === "undefined") return;
    removeAdminPresentation();
    window.dispatchEvent(new CustomEvent("imad:session-expired", { detail: reason }));
}
const cookieOptions = () => ({ withCredentials: true, timeout: 10000, headers: { "X-Imad-Admin-Session": "cookie" } });
function acceptBrowserResponse(data: { mode?: string; identity?: AdminBrowserIdentity }) {
    if (data?.mode !== "cookie" || !data.identity) throw new Error("Invalid browser session response");
    return storeBrowserIdentity(data.identity);
}
async function sessionLock<T>(run: () => Promise<T>) {
    if (navigator.locks) {
        let started = false;
        try { return await navigator.locks.request("imad-admin-refresh", () => { started = true; return run(); }); }
        catch (error) { if (started) throw error; }
    }
    return await run();
}
let restorePromise: Promise<string | null> | null = null;
export function restoreAdminSession(): Promise<string | null> {
    if (restorePromise) return restorePromise;
    restorePromise = sessionLock(async () => {
        const previous = readAdminPresentation(), legacy = localStorage.getItem("adminToken");
        const refresh = localStorage.getItem("adminRefresh");
        // Preserve API-token clients. Real pre-upgrade browser refresh JWTs are
        // exchanged once; test fixtures and explicitly supplied API tokens are not cookies.
        if (legacy && !hasBrowserProfile() && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(refresh ?? "")) return legacy;
        try {
            if (legacy && !hasBrowserProfile()) {
                const r = await axios.post(getBaseUrl() + "/auth/session/migrate", { token: refresh }, cookieOptions());
                return acceptBrowserResponse(r.data.data);
            }
            try {
                const r = await axios.get(getBaseUrl() + "/auth/session", cookieOptions());
                return acceptBrowserResponse(r.data.data);
            } catch (error) {
                if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
                const r = await axios.post(getBaseUrl() + "/auth/refresh", {}, cookieOptions());
                return acceptBrowserResponse(r.data.data);
            }
        } catch (error) {
            // An unavailable connection does not erase the presentation or drafts.
            if (axios.isAxiosError(error) && (!error.response || ![401,403].includes(error.response.status))) return previous;
            if (previous) clearAdminSession(); else removeAdminPresentation();
            return null;
        }
    }).catch(() => readAdminPresentation()).finally(() => { restorePromise = null; });
    return restorePromise;
}
let refreshPromise: Promise<void> | null = null;
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
        const context = config as typeof config & { _adminIdentity?: string | null };
        const binding = adminPresentationBinding();
        if (context._adminIdentity !== undefined && context._adminIdentity !== binding)
            throw new axios.CanceledError("Le compte connecté a changé. Relancez l’action depuis sa session.");
        context._adminIdentity = binding;
        const legacy = !hasBrowserProfile() && localStorage.getItem("adminToken");
        if (legacy) {
            config.headers.Authorization = `Bearer ${legacy}`;
            delete config.headers["X-Imad-Admin-Session"];
            delete config.headers["X-Imad-Admin-Identity"];
        }
        else {
            delete config.headers.Authorization;
            config.headers["X-Imad-Admin-Session"] = "cookie";
            config.withCredentials = true;
            try { const identity = JSON.parse(readAdminPresentation() || "null");
                if (identity?.id) config.headers["X-Imad-Admin-Identity"] = identity.id + ":" + identity.sv;
            } catch { /* Bootstrap reads do not have a presentation yet. */ }
        }
        (config as typeof config & { _adminRequest?: boolean })._adminRequest = true;
    }
    return config;
});
api.interceptors.response.use(response => response, async error => {
    const config = error.config;
    if (typeof window === "undefined" || !config?._adminRequest || /\/auth\/(login|refresh|session|logout|register|forgot-password|reset-password)(?:[/?]|$)/.test(config.url || "")) return Promise.reject(error);
    if (config._adminIdentity !== adminPresentationBinding())
        return Promise.reject(new axios.CanceledError("Le compte connecté a changé. Relancez l’action depuis sa session."));
    if (error.response?.status === 403 && error.response?.data?.code !== "PERMISSION_DENIED") {
        clearAdminSession(); return Promise.reject(error);
    }
    if (error.response?.data?.code === "SESSION_CHANGED") { clearAdminSession(); return Promise.reject(error); }
    if (error.response?.status !== 401) return Promise.reject(error);
    if (config._retried) { clearAdminSession(); return Promise.reject(error); }
    config._retried = true;
    if (!refreshPromise) {
        const staleToken = String(config.headers.Authorization || "").replace(/^Bearer /, "");
        refreshPromise = sessionLock(async () => {
            if (hasBrowserProfile() || !localStorage.getItem("adminToken")) {
                const r = await axios.post(getBaseUrl() + "/auth/refresh", {}, cookieOptions());
                acceptBrowserResponse(r.data.data);
            } else {
                const current = localStorage.getItem("adminToken");
                if (current && current !== staleToken) return;
                const token = localStorage.getItem("adminRefresh");
                if (!token) throw new Error("Session expirée");
                const r = await axios.post(getBaseUrl() + "/auth/refresh", { token }, { timeout: 10000 });
                localStorage.setItem("adminToken", r.data.data.accessToken);
                localStorage.setItem("adminRefresh", r.data.data.refreshToken);
            }
        }).finally(() => { refreshPromise = null; });
    }
    try { await refreshPromise; return await api.request(config); }
    catch (failure) {
        if (axios.isAxiosError(failure) && (!failure.response || ![401,403].includes(failure.response.status))) return Promise.reject(failure);
        clearAdminSession(); return Promise.reject(failure);
    }
});
export { api as adminApi };
export async function adminLogout() {
    return await sessionLock(async () => {
    if (hasBrowserProfile() || !localStorage.getItem("adminToken"))
        await axios.post(getBaseUrl() + "/auth/logout", {}, cookieOptions());
    else {
        const token = localStorage.getItem("adminRefresh");
        if (token) await axios.post(getBaseUrl() + "/auth/logout", { token }, { timeout: 10000 });
    }
    clearAdminSession("logout");
    });
}
export async function getContentAdmin() {
    return (
        await api.get<{
            data: {
                draft: SiteContent;
                published: SiteContent;
                revision: number;
                canRollback: boolean;
            };
        }>("/content/admin")
    ).data.data;
}
export async function saveContent(
    action: "draft" | "publish" | "rollback",
    revision: number,
    content?: SiteContent,
) {
    return (
        await api.post(`/content/${action}`, {
            expectedRevision: revision,
            ...(content ? { content } : {}),
        })
    ).data;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Category {
    publishedCount?: number;
    productImages?: string[];
    id: string;
    slug: string;
    nameFr: string;
    nameAr: string;
    nameEn: string;
    image?: string;
}

export interface ProductVariant {
    id: string;
    color: string;
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
    size?: string;
    stock: number;
    sku: string;
}

export interface Product {
    id: string;
    slug: string;
    nameFr: string;
    nameAr: string;
    nameEn: string;
    descriptionFr: string;
    descriptionAr: string;
    descriptionEn: string;
    price: number;
    compareAtPrice?: number;
    quantityDiscounts?: import("@imad-store/shared").QuantityDiscount[];
    freeShipping?: boolean;
    recommendationSettings?: RecommendationSettings;
    productInformation?: import("@imad-store/shared").ProductInformation | null;
    images: string[];
    colorPhotos?: import("@imad-store/shared").ProductColorPhoto[] | null;
    status: string;
    category: Category;
    variants: ProductVariant[];
}
export interface RecommendationSettings {
    enabled: boolean;
    upsellProductIds: string[];
    crossSellProductIds: string[];
}
export interface RecommendationProducts { upsell: Product[]; crossSell: Product[] }
export const getProductRecommendations = async (slug: string, signal?: AbortSignal): Promise<RecommendationProducts> => {
    const data = (await api.get(`/products/${encodeURIComponent(slug)}/recommendations`, { signal })).data.data;
    return Array.isArray(data?.upsell) && Array.isArray(data?.crossSell) ? data : { upsell: [], crossSell: [] };
};

export interface ProductsResponse {
    success: boolean;
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    filterOptions?: { sizes: string[]; colors?: { value: string; label: string }[] };
}

// Guest-only checkout — no user account required
export interface GuestCheckoutPayload {
    confirmationMode?: "SITE";
    aiServiceConsent?: boolean;
    aiServiceConsentVersion?: string;
    paymentMethod: "COD";
    expectedTotal?: number;
    customer: {
        fullName: string;
        phone: string;
        email?: string;
        street: string;
        city: string;
        region: string;
        postalCode?: string;
    };
    items: {
        productId: string;
        variantId: string;
        quantity: number;
        price?: number;
        name?: string;
    }[];
    notes?: string;
}

// ─── Products / Categories (public) ───────────────────────────────────────────

export const getProducts = async (params?: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
    availability?: string;
}, signal?: AbortSignal): Promise<ProductsResponse> => {
    const { data } = await api.get("/products", { params, signal });
    return data;
};

export const getProduct = async (slug: string): Promise<Product> => {
    const { data } = await api.get(`/products/${encodeURIComponent(slug)}`);
    return data.data;
};

export const getCategories = async (): Promise<Category[]> => {
    const { data } = await api.get("/categories");
    return data.data;
};

// ─── Guest Checkout (no auth) ─────────────────────────────────────────────────

export const createOrder = async (payload: GuestCheckoutPayload, idempotencyKey: string) => {
    const { data } = await api.post("/orders", payload, {
        headers: { "Idempotency-Key": idempotencyKey, ...analyticsOrderHeaders() },
    });
    const order = data.data;
    assertAssistanceReceipt(payload, order);
    return order;
};

export const trackOrder = async (orderId: string) => {
    const { data } = await api.get(`/orders/${orderId}`);
    return data.data;
};

// ─── Settings (public) ────────────────────────────────────────────────────────

export interface StoreSettings {
    id: string;
    whatsappPhone: string;
    whatsappUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    tiktokUrl?: string | null;
    shippingCost: number;
    freeShippingMin: number;
    deliveryMaxDays?: number | null;
    returnWindowDays?: number | null;
    returnFeePayer?: "STORE" | "CUSTOMER" | "BY_REASON" | "DELIVERY_TRY_ON" | null;
    metaPixelEnabled?: boolean;
    metaPixelId?: string | null;
    metaPixelMadPerUsd?: number | null;
    metaDomainVerification?: string | null;
    codEnabled: boolean;
    directSiteConfirmation?: boolean;
    whatsappAssistanceAvailable?: boolean;
}

export const getSettings = async (): Promise<StoreSettings> => {
    const { data } = await api.get("/settings");
    return data.data;
};

// ─── Admin (auth required — kept for /admin pages) ───────────────────────────

export interface AdminAuthResponse { success: boolean; data: { presentation: string } }
export const adminLogin = async (email: string, password: string): Promise<AdminAuthResponse> => {
    return await sessionLock(async () => {
        const { data } = await axios.post(getBaseUrl() + "/auth/login", { email, password }, cookieOptions());
        const presentation = acceptBrowserResponse(data.data);
        return { success: data.success, data: { presentation } };
    });
};

export interface GmailSettings {
    enabled: boolean; gmailUser: string; host: string; port: 465 | 587; hasPassword: boolean; revision: number;
}
export interface TeamUser {
    id: string; email: string; firstName: string; lastName: string; role: "ADMIN" | "STAFF";
    permissions: string[]; isActive: boolean; mustSetPassword: boolean; createdAt: string;
    mailState?: string | null;
}
export const readGmailSettings = async () => (await api.get<{ data: GmailSettings }>("/team/gmail")).data.data;
export const saveGmailSettings = async (body: Omit<GmailSettings, "host" | "hasPassword"> & { appPassword: string; clearPassword: boolean; currentPassword: string }) =>
    (await api.put<{ data: GmailSettings }>("/team/gmail", body, { timeout: 30000 })).data.data;
export const verifyGmailSettings = async () => (await api.post("/team/gmail/test", {}, { timeout: 30000 })).data;
export const listTeamUsers = async (page: number, signal?: AbortSignal) =>
    (await api.get<{ data: TeamUser[]; total: number; page: number; totalPages: number; currentUserId: string }>("/team", { params: { page }, signal })).data;
export const createTeamUser = async (body: { email: string; firstName: string; lastName: string; role: string; permissions: string[]; currentPassword: string }) =>
    (await api.post("/team", body, { timeout: 30000 })).data;
export const updateTeamUser = async (id: string, body: { firstName: string; lastName: string; role: string; permissions: string[]; isActive: boolean; currentPassword: string }) =>
    (await api.patch(`/team/${id}`, body, { timeout: 30000 })).data;
export const inviteTeamUser = async (id: string, currentPassword: string) => (await api.post(`/team/${id}/invite`, { currentPassword })).data;
export const requestPasswordReset = async (email: string) => (await api.post("/auth/forgot-password", { email })).data;
export const submitPasswordReset = async (token: string, password: string) => (await api.post("/auth/reset-password", { token, password }, { timeout: 30000 })).data;
export const changeOwnPassword = async (currentPassword: string, password: string) => (await api.post("/auth/change-password", { currentPassword, password }, { timeout: 30000 })).data;

export interface AdminNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    orderId?: string;
    read: boolean;
    createdAt: string;
}

export const getAdminNotifications = async (): Promise<{
    data: AdminNotification[];
    unread: number;
}> => {
    const { data } = await api.get("/notifications");
    return data;
};

export const markNotificationRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
    await api.post("/notifications/read-all");
};

export interface AdminOrder {
    customerBlacklist?: { available: boolean; blocked: boolean; cancelledCount: number };
    customerHistory?: { available: boolean; priorCancelledCount: number };
    shipment?: {
        approvedAt?: string | null;
        id: string;
        trackingId: string | null;
        carrierStatus: string | null;
        state: string;
        lastError: string | null;
        lastSyncedAt: string | null;
    } | null;
    confirmationMethod?: string | null;
    confirmedAt?: string | null;
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    city: string | null;
    region: string | null;
    fullName?: string | null;
    phone?: string | null;
    street?: string | null;
    postalCode?: string | null;
    customerEmail?: string | null;
    notes?: string | null;
    shippingCost?: number;
    updatedAt?: string;
    deletedAt?: string | null;
    address?: {
        fullName?: string;
        phone?: string;
        street?: string;
        city?: string;
        region?: string;
        postalCode?: string;
    } | null;
    items?: {
        id: string;
        quantity: number;
        unitPrice: number;
        product?: { nameFr?: string; nameAr?: string; nameEn?: string; images?: string[]; colorPhotos?: { colorKey: string; image: string }[] | null } | null;
        variant?: { color?: string; colorNameFr?: string; colorNameAr?: string; colorNameEn?: string; size?: string; sku?: string } | null;
    }[];
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
}

export type OrderPeriodDays = 1 | 7 | 30 | 90;
export interface OrderCalendar { day: string; from: string; days: OrderPeriodDays; start: string; end: string; timeZone: "Africa/Casablanca" }
export async function getOrderCalendar(days: OrderPeriodDays = 1): Promise<OrderCalendar> {
    const { data } = await api.get<{ success: boolean; data: OrderCalendar }>("/orders/calendar", { params: { days } });
    const calendar = data.data;
    const duration = Date.parse(calendar?.end) - Date.parse(calendar?.start);
    const first = new Date((calendar?.day || "") + "T00:00:00Z");
    first.setUTCDate(first.getUTCDate() - days + 1);
    const from = calendar?.from ?? (days === 1 ? calendar?.day : "");
    if (data.success !== true || !calendar || calendar.timeZone !== "Africa/Casablanca" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(calendar.day) || !Number.isFinite(first.getTime()) ||
        from !== first.toISOString().slice(0, 10) || (calendar.days ?? 1) !== days || !Number.isFinite(duration) ||
        Math.abs(duration - days * 86400_000) > 2 * 3600_000)
        throw new Error("Store calendar unavailable");
    return { ...calendar, days, from };
}

export const getAllOrders = async (params?: {
    tracking?: string;
    status?: string;
    page?: number;
    limit?: number;
    trash?: boolean;
    search?: string;
    payment?: string;
    from?: string;
    to?: string;
    sort?: string;
}, signal?: AbortSignal) => {
    const { data } = await api.get("/orders", { params, signal });
    return data as {
        success: boolean;
        data: AdminOrder[];
        total: number;
        page: number;
        totalPages: number;
        scopeTotal?: number;
        trackingFilter?: string;
        statusCounts?: Record<string, number>;
    };
};

export const getAdminOrder = async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<{ data: AdminOrder }>(`/orders/${id}/admin-details`, { signal });
    if (!data.data || data.data.id !== id) throw new Error("Order details do not match the requested reference");
    return data.data;
};

export interface DispatchBlacklistPage {
    data: { phone: string; cancelledCount: number; trashCount: number; lastOrderId: string; lastOrderCreatedAt: string }[];
    total: number; totalPages: number; page: number;
}
export const getDispatchBlacklist = async (search: string, page: number, signal?: AbortSignal) => {
    const { data } = await api.get<DispatchBlacklistPage>("/orders/dispatch-blacklist", { params: { search, page }, signal });
    return data;
};

export interface CustomerOrderHistoryPage {
    anchorOrderId: string;
    phone: string;
    priorCancelledCount: number;
    total: number;
    page: number;
    totalPages: number;
    data: { id: string; createdAt: string; status: string; paymentStatus: string;
        totalAmount: number; deletedAt: string | null; cancelledAt: string | null }[];
}
export async function getCustomerOrderHistory(id: string, page: number, signal?: AbortSignal) {
    const { data } = await api.get<CustomerOrderHistoryPage>(`/orders/${id}/customer-history`, { params: { page }, signal });
    const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
    const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
    if (data.anchorOrderId !== id || !/^\+[1-9]\d{7,14}$/.test(data.phone) || !integer(data.total) || data.total < 1
        || !integer(data.priorCancelledCount) || data.priorCancelledCount >= data.total
        || !integer(data.page) || data.page < 1 || data.totalPages !== Math.ceil(data.total / 25)
        || data.page > data.totalPages || data.page !== Math.min(page, data.totalPages)
        || !Array.isArray(data.data) || data.data.length !== Math.min(25, data.total - (data.page - 1) * 25)
        || new Set(data.data.map(row => row.id)).size !== data.data.length
        || data.data.some(row => !/^[a-f0-9]{24}$/.test(row.id) || !date(row.createdAt)
            || !["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"].includes(row.status)
            || !["PENDING", "PAID", "FAILED", "REFUNDED"].includes(row.paymentStatus)
            || !Number.isFinite(row.totalAmount) || row.deletedAt !== null && !date(row.deletedAt)
            || row.cancelledAt !== null && !date(row.cancelledAt)))
        throw new Error("Invalid customer history response");
    return data;
}

export async function exportOrders(params: {
    search?: string; status?: string; payment?: string; tracking?: string;
    from?: string; to?: string; sort: string; locale: "fr" | "ar";
}, signal: AbortSignal) {
    const response = await api.get<Blob>("/orders/export.csv", { params, signal, responseType: "blob", timeout: 45000 });
    const countHeader = response.headers["x-order-export-count"];
    const count = typeof countHeader === "string" && /^\d+$/.test(countHeader) ? Number(countHeader) : NaN;
    if (!String(response.headers["content-type"]).startsWith("text/csv") || !Number.isSafeInteger(count) || count > 10000 || !response.data.size)
        throw new Error("Invalid order export response");
    return { blob: response.data, count };
}

export interface OrderHistoryEvent {
    id: string;
    type: string;
    createdAt: string;
    source?: string;
    status?: string;
}

export const getOrderHistory = async (id: string, signal?: AbortSignal) => {
    const { data } = await api.get<{ data: OrderHistoryEvent[] }>(`/orders/${id}/history`, { signal });
    return data.data;
};

export const updateOrderStatus = async (id: string, status: string) => {
    const { data } = await api.patch(`/orders/${id}/status`, { status });
    return data;
};

export const syncOrderCarrierStatus = async (id: string) =>
    (await api.post(`/orders/${id}/olivraison-sync`)).data;

export const approveOrderCarrierDispatch = async (id: string) =>
    (await api.post(`/orders/${id}/olivraison-approve`, { approve: true })).data;

// ─── Admin Product CRUD ───────────────────────────────────────────────────────

export const createProduct = async (payload: Record<string, unknown>) => {
    const { data } = await api.post("/products", payload);
    return data;
};

export const updateProduct = async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/products/${id}`, payload);
    return data;
};

export const deleteProduct = async (id: string) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
};

// ─── Admin Category CRUD ───────────────────────────────────────────────────────

export const createCategory = async (payload: Record<string, unknown>) => {
    const { data } = await api.post("/categories", payload);
    return data;
};

export const updateCategory = async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/categories/${id}`, payload);
    return data;
};

export const deleteCategory = async (id: string) => {
    const { data } = await api.delete(`/categories/${id}`);
    return data;
};

// ─── Admin Settings Update ────────────────────────────────────────────────────

export const updateSettings = async (payload: Partial<StoreSettings>) => {
    const { data } = await api.put("/settings", payload);
    return data;
};

export default api;

export async function getAdminProducts(params: Record<string, unknown> = {}) {
    return (await api.get<ProductsResponse>("/products/admin/catalog", { params })).data;
}
export async function getAdminProductBySlug(slug: string): Promise<Product | null> {
    const { data } = await api.get<{ success: boolean; data: Product | null }>(
        `/products/admin/catalog/${encodeURIComponent(slug)}`,
    );
    if (data?.success !== true || (data.data !== null && data.data?.slug !== slug))
        throw new Error("Résultat de vérification invalide.");
    return data.data;
}
export async function uploadProductImage(file: File): Promise<string> {
    return (await api.post("/uploads", file, { headers: { "Content-Type": file.type } })).data.data
        .url;
}

export type StoreAnalyticsSummary = {
    funnel?: {cartVisits:number;checkoutVisits:number;confirmedOrders:number;shippedOrders:number;deliveredOrders:number;cancelledOrders:number;unknownOrders:number};
    days: number;
    start: string;
    end: string;
    trackingSince: string | null;
    visits: number;
    convertedVisits: number;
    orderRate: number | null;
    pageViews: number;
    productViews: number;
    attributedOrders: number;
    products: { id: string; name: string; views: number }[];
};
export async function getStoreAnalytics(days: number): Promise<StoreAnalyticsSummary> {
    return (await api.get("/analytics/summary", { params: { days } })).data.data;
}

export const trashOrders = async (ids: string[], restore = false) => {
    const { data } = await api.post("/orders/trash", { ids, restore });
    return data as { success: boolean; count: number };
};

export interface OlivraisonConfig {
    saved: boolean;
    enabled: boolean; autoPickup: boolean; configured: boolean; activatedAt: string | null;
    pickupAddress: { company: string; streetAddress: string; city: string; phone: string };
    cityMapping: Record<string, string>;
}
export interface OlivraisonShipment {
    id: string; trackingId: string | null; carrierStatus: string | null; state: string;
    lastError: string | null; stickerUrl: string | null; slipUrl: string | null; updatedAt: string;
}
export const getOlivraisonConfig = async (): Promise<OlivraisonConfig> => (await api.get("/integrations/olivraison")).data.data;
export const saveOlivraisonConfig = async (body: Omit<OlivraisonConfig, "configured" | "activatedAt" | "saved"> & { apiKey?: string; secretKey?: string }): Promise<OlivraisonConfig> => (await api.put("/integrations/olivraison", body)).data.data;
export const testOlivraison = async (): Promise<{ name: string; price: number }[]> => (await api.post("/integrations/olivraison/test")).data.data;
export const getOlivraisonShipments = async (): Promise<OlivraisonShipment[]> => (await api.get("/integrations/olivraison/shipments")).data.data;
export const retryOlivraison = async (id: string) => (await api.post(`/integrations/olivraison/shipments/${id}/retry`)).data.data;

export const deleteOlivraisonConfig = async (): Promise<OlivraisonConfig> => (await api.delete("/integrations/olivraison")).data.data;
