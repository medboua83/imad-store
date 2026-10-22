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

export function clearAdminSession(reason: "expired" | "logout" = "expired") {
    if (typeof window === "undefined") return;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRefresh");
    window.dispatchEvent(new CustomEvent("imad:session-expired", { detail: reason }));
}
let refreshPromise: Promise<string> | null = null;
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
        const token = localStorage.getItem("adminToken");
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        if (
            typeof window === "undefined" ||
            !config?.headers?.Authorization ||
            /\/auth\//.test(config.url || "")
        )
            return Promise.reject(error);
        if (error.response?.status === 403) {
            clearAdminSession();
            return Promise.reject(error);
        }
        if (error.response?.status !== 401 || config._retried) return Promise.reject(error);
        config._retried = true;
        if (!refreshPromise) {
            const staleToken = String(config.headers.Authorization).replace(/^Bearer /, "");
            const refresh = async () => {
                const current = localStorage.getItem("adminToken");
                if (current && current !== staleToken) return current;
                const token = localStorage.getItem("adminRefresh");
                if (!token) throw new Error("Session expirée");
                const response = await axios.post(
                    `${getBaseUrl()}/auth/refresh`,
                    { token },
                    { timeout: 10000 },
                );
                const session = response.data.data;
                localStorage.setItem("adminToken", session.accessToken);
                localStorage.setItem("adminRefresh", session.refreshToken);
                return session.accessToken as string;
            };
            refreshPromise = (async () => {
                if (navigator.locks)
                    return await navigator.locks.request("imad-admin-refresh", refresh);
                return await refresh();
            })().finally(() => {
                refreshPromise = null;
            });
        }
        try {
            config.headers.Authorization = `Bearer ${await refreshPromise}`;
            return await api.request(config);
        } catch (failure) {
            if (axios.isAxiosError(failure) && !failure.response) return Promise.reject(failure);
            clearAdminSession();
            return Promise.reject(failure);
        }
    },
);
export async function adminLogout() {
    const token = localStorage.getItem("adminRefresh");
    if (token) await api.post("/auth/logout", { token });
    clearAdminSession("logout");
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
    freeShipping?: boolean;
    images: string[];
    status: string;
    category: Category;
    variants: ProductVariant[];
}

export interface ProductsResponse {
    success: boolean;
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
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
}): Promise<ProductsResponse> => {
    const { data } = await api.get("/products", { params });
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
    shippingCost: number;
    freeShippingMin: number;
    metaPixelEnabled?: boolean;
    metaPixelId?: string | null;
    metaPixelMadPerUsd?: number | null;
    codEnabled: boolean;
    directSiteConfirmation?: boolean;
    whatsappAssistanceAvailable?: boolean;
}

export const getSettings = async (): Promise<StoreSettings> => {
    const { data } = await api.get("/settings");
    return data.data;
};

// ─── Admin (auth required — kept for /admin pages) ───────────────────────────

export interface AdminAuthResponse {
    success: boolean;
    data: { accessToken: string; refreshToken: string };
}

export const adminLogin = async (email: string, password: string): Promise<AdminAuthResponse> => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
};

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
        product?: { nameFr?: string; nameAr?: string; nameEn?: string } | null;
        variant?: { colorNameFr?: string; colorNameAr?: string; size?: string } | null;
    }[];
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
}

export const getAllOrders = async (params?: {
    status?: string;
    page?: number;
    limit?: number;
    trash?: boolean;
}) => {
    const { data } = await api.get("/orders", { params });
    return data as {
        success: boolean;
        data: AdminOrder[];
        total: number;
        page: number;
        totalPages: number;
    };
};

export const updateOrderStatus = async (id: string, status: string) => {
    const { data } = await api.patch(`/orders/${id}/status`, { status });
    return data;
};

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
export async function uploadProductImage(file: File): Promise<string> {
    return (await api.post("/uploads", file, { headers: { "Content-Type": file.type } })).data.data
        .url;
}

export type StoreAnalyticsSummary = {
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
    enabled: boolean; autoPickup: boolean; configured: boolean; activatedAt: string | null;
    pickupAddress: { company: string; streetAddress: string; city: string; phone: string };
    cityMapping: Record<string, string>;
}
export interface OlivraisonShipment {
    id: string; trackingId: string | null; carrierStatus: string | null; state: string;
    lastError: string | null; stickerUrl: string | null; slipUrl: string | null; updatedAt: string;
}
export const getOlivraisonConfig = async (): Promise<OlivraisonConfig> => (await api.get("/integrations/olivraison")).data.data;
export const saveOlivraisonConfig = async (body: Omit<OlivraisonConfig, "configured" | "activatedAt"> & { apiKey?: string; secretKey?: string }): Promise<OlivraisonConfig> => (await api.put("/integrations/olivraison", body)).data.data;
export const testOlivraison = async (): Promise<{ name: string; price: number }[]> => (await api.post("/integrations/olivraison/test")).data.data;
export const getOlivraisonShipments = async (): Promise<OlivraisonShipment[]> => (await api.get("/integrations/olivraison/shipments")).data.data;
export const retryOlivraison = async (id: string) => (await api.post(`/integrations/olivraison/shipments/${id}/retry`)).data.data;

export const deleteOlivraisonConfig = async (): Promise<OlivraisonConfig> => (await api.delete("/integrations/olivraison")).data.data;
