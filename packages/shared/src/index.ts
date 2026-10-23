// ─── Locales ────────────────────────────────────────────────────────────────
/** A variant represents one size, never a list of numeric pointures. */
export function isAmbiguousSize(size?: string | null): boolean {
    const value = (size || "").trim().replace(/[٠-٩۰-۹]/g, (digit) =>
        String("٠١٢٣٤٥٦٧٨٩".includes(digit)
            ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
            : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
    );
    if (/^\d{1,3}(?:[.,]\d)?$/.test(value)) return false;
    return /^\d{1,3}(?:[.,]\d)?(?:\s*[,;/|–—-]\s*|\s+)\d{1,3}(?:[.,]\d)?(?:[\d\s.,;/|–—-]*)$/.test(value)
        || /^(?:XXS|XS|S|M|L|XL|XXL|XXXL)(?:[\s,;/|]+(?:XXS|XS|S|M|L|XL|XXL|XXXL))+$/i.test(value);
}

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
    quantityDiscounts?: import("./quantity-pricing").QuantityDiscount[];
    freeShipping?: boolean;
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

/** Any eligible product grants delivery to the whole basket; threshold is inclusive. */
export function shippingFee(
    subtotal: number,
    items: { freeShipping?: boolean; quantity: number }[],
    settings: { shippingCost: number; freeShippingMin: number },
) {
    if (
        items.some((item) => item.quantity > 0 && item.freeShipping) ||
        Math.round(subtotal * 100) >= Math.round(settings.freeShippingMin * 100)
    )
        return 0;
    return Math.round(settings.shippingCost * 100) / 100;
}

/** Merchant instruction for transactional order service; never customer consent. */
export const ORDER_SERVICE_POLICY_VERSION = "store-order-service-v1-2026-10-19";

export * from "./shipping-address";
export * from "./quantity-pricing";
