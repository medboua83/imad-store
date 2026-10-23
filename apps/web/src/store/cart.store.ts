import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAmbiguousSize } from "@imad-store/shared";
import { getProduct, ProductVariant, Product } from "../lib/api";
import { trackCart } from "../lib/store-analytics";

export interface CartItem {
    variantId: string;
    productId: string;
    productSlug: string;
    nameFr: string;
    nameAr: string;
    nameEn: string;
    image: string;
    images?: string[];
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
    size?: string;
    price: number;
    freeShipping?: boolean;
    quantity: number;
    stock: number;
}

interface CartStore {
    items: CartItem[];
    isOpen: boolean;
    openCart: () => void;
    closeCart: () => void;
    addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
    removeItem: (variantId: string) => void;
    updateQty: (variantId: string, quantity: number) => void;
    refreshCart: () => Promise<boolean>;
    clearCart: () => void;
    total: () => number;
    itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),

            addItem: (product, variant, quantity = 1) => {
                if (!Number.isFinite(quantity) || quantity < 1 || variant.stock < 1 || isAmbiguousSize(variant.size)) return;
                set((state) => {
                    const existing = state.items.find((i) => i.variantId === variant.id);
                    if (existing) {
                        return {
                            items: state.items.map((i) =>
                                i.variantId === variant.id
                                    ? {
                                          ...i,
                                          stock: variant.stock,
                                          price: product.price,
                                          freeShipping: Boolean(product.freeShipping),
                                          image: product.images[0] ?? "",
                                          images: [...product.images],
                                          quantity: Math.min(
                                              variant.stock,
                                              i.quantity + Math.floor(quantity),
                                          ),
                                      }
                                    : i,
                            ),
                            isOpen: true,
                        };
                    }
                    const newItem: CartItem = {
                        variantId: variant.id,
                        productId: product.id,
                        productSlug: product.slug,
                        nameFr: product.nameFr,
                        nameAr: product.nameAr,
                        nameEn: product.nameEn,
                        image: product.images[0] ?? "",
                        images: [...product.images],
                        colorNameFr: variant.colorNameFr,
                        colorNameAr: variant.colorNameAr,
                        colorNameEn: variant.colorNameEn,
                        size: variant.size,
                        price: product.price,
                        freeShipping: Boolean(product.freeShipping),
                        quantity: Math.min(variant.stock, Math.floor(quantity)),
                        stock: variant.stock,
                    };
                    return { items: [...state.items, newItem], isOpen: true };
                });
                trackCart(product.slug);
            },

            removeItem: (variantId) =>
                set((state) => ({
                    items: state.items.filter((i) => i.variantId !== variantId),
                })),

            updateQty: (variantId, quantity) => {
                if (!Number.isFinite(quantity)) return;
                if (quantity <= 0) {
                    get().removeItem(variantId);
                    return;
                }
                set((state) => ({
                    items: state.items.map((i) =>
                        i.variantId === variantId
                            ? { ...i, quantity: Math.min(i.stock || 0, Math.floor(quantity)) }
                            : i,
                    ),
                }));
            },

            refreshCart: async () => {
                const before = get().items;
                const products = new Map(
                    await Promise.all(
                        [...new Set(before.map((i) => i.productSlug))].map(async (slug) => {
                            try {
                                return [slug, await getProduct(slug)] as const;
                            } catch (error) {
                                if (
                                    (error as { response?: { status: number } }).response
                                        ?.status === 404
                                )
                                    return [slug, null] as const;
                                throw error;
                            }
                        }),
                    ),
                );
                let changed = false;
                set((state) => ({
                    items: state.items.map((item) => {
                        if (!products.has(item.productSlug)) return item;
                        const product = products.get(item.productSlug),
                            variant = product?.variants.find((v) => v.id === item.variantId);
                        const stock = variant && !isAmbiguousSize(variant.size) ? variant.stock : 0,
                            price = product?.price ?? item.price;
                        const quantity = Math.min(item.quantity, stock);
                        if (
                            price !== item.price ||
                            quantity !== item.quantity ||
                            stock === 0 ||
                            (variant?.size ?? "") !== (item.size ?? "") ||
                            (variant && variant.colorNameFr !== item.colorNameFr) ||
                            Boolean(product?.freeShipping) !== Boolean(item.freeShipping)
                        )
                            changed = true;
                        return {
                            ...item,
                            price,
                            stock,
                            quantity,
                            size: variant?.size ?? item.size,
                            colorNameFr: variant?.colorNameFr ?? item.colorNameFr,
                            colorNameAr: variant?.colorNameAr ?? item.colorNameAr,
                            colorNameEn: variant?.colorNameEn ?? item.colorNameEn,
                            freeShipping: Boolean(product?.freeShipping),
                            image: product ? product.images[0] ?? "" : item.image,
                            images: product ? [...product.images] : item.images,
                        };
                    }),
                }));
                return changed;
            },
            clearCart: () => set({ items: [], isOpen: false }),
            total: () => get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),
            itemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
        }),
        {
            name: "imad-store-cart",
            partialize: (state) => ({ items: state.items }),
            // Rehydrate after React attaches to the identical empty server snapshot.
            skipHydration: true,
        },
    ),
);
