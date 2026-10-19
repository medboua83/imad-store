// ─── Locales ────────────────────────────────────────────────────────────────
export type Locale = "fr" | "ar" | "en";

// ─── User ───────────────────────────────────────────────────────────────────
export type UserRole = "CUSTOMER" | "ADMIN";

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    createdAt: string;
}

// ─── Address ────────────────────────────────────────────────────────────────
export interface Address {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    isDefault: boolean;
}

// ─── Category ───────────────────────────────────────────────────────────────
export interface Category {
    id: string;
    slug: string;
    nameFr: string;
    nameAr: string;
    nameEn: string;
    image?: string;
}

// ─── Product ────────────────────────────────────────────────────────────────
export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface ProductVariant {
    id: string;
    color: string; // hex or color name
    colorNameFr: string;
    colorNameAr: string;
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
    price: number; // in MAD
    compareAtPrice?: number;
    images: string[]; // Supabase Storage URLs
    status: ProductStatus;
    categoryId: string;
    category?: Category;
    variants: ProductVariant[];
    createdAt: string;
}

// ─── Cart ───────────────────────────────────────────────────────────────────
export interface CartItem {
    productId: string;
    variantId: string;
    quantity: number;
    product: Pick<Product, "id" | "nameFr" | "nameAr" | "nameEn" | "price" | "images">;
    variant: Pick<ProductVariant, "id" | "color" | "colorNameFr" | "colorNameAr" | "size">;
}

// ─── Order ──────────────────────────────────────────────────────────────────
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "STRIPE" | "COD";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface OrderItem {
    id: string;
    productId: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    product: Pick<Product, "nameFr" | "nameAr" | "nameEn" | "images">;
    variant: Pick<ProductVariant, "colorNameFr" | "colorNameAr" | "size">;
}

export interface Order {
    id: string;
    userId?: string;
    guestEmail?: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    stripePaymentIntentId?: string;
    totalAmount: number;
    shippingCost: number;
    items: OrderItem[];
    address: Address;
    createdAt: string;
    updatedAt: string;
}

// ─── API Responses ──────────────────────────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export { defaultSiteContent } from "./site-content";
export type { SiteContent } from "./site-content";

// Version of the explicit checkout request for automated WhatsApp order assistance.
export const ORDER_WHATSAPP_NOTICE_VERSION = "order-whatsapp-v1-2026-10-19";
