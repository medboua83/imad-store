import axios from "axios";

const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
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
    headers: { "Content-Type": "application/json" },
});

// Attach admin token from localStorage if present (only used by /admin pages)
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("adminToken");
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

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
    paymentMethod: "COD";
    crmConsent?: boolean;
    customer: {
        fullName: string;
        phone: string;
        email?: string;
        street: string;
        city: string;
        region: string;
        postalCode?: string;
    };
    items: { productId: string; variantId: string; quantity: number; price?: number; name?: string }[];
    notes?: string;
}

// ─── Products / Categories (public) ───────────────────────────────────────────

export const getProducts = async (params?: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
}): Promise<ProductsResponse> => {
    const { data } = await api.get("/products", { params });
    return data;
};

export const getProduct = async (slug: string): Promise<Product> => {
    const { data } = await api.get(`/products/${slug}`);
    return data.data;
};

export const getCategories = async (): Promise<Category[]> => {
    const { data } = await api.get("/categories");
    return data.data;
};

// ─── Guest Checkout (no auth) ─────────────────────────────────────────────────

export const createOrder = async (payload: GuestCheckoutPayload, idempotencyKey: string) => {
    const { data } = await api.post("/orders", payload, { headers: { "Idempotency-Key": idempotencyKey } });
    return data.data;
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
    codEnabled: boolean;
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

export const getAllOrders = async (params?: { status?: string; page?: number; limit?: number }) => {
    const { data } = await api.get("/orders", { params });
    return data as { success: boolean; data: AdminOrder[]; total: number; page: number; totalPages: number };
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
