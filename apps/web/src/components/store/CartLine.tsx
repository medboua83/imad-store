"use client";
import { ProductPhoto } from "./ProductPhoto";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore, type CartItem } from "@/store/cart.store";
export function CartLine({ item, disabled = false }: { item: CartItem; disabled?: boolean }) {
    const { updateQty, removeItem } = useCartStore();
    const name = item.nameAr || item.nameFr;
    return (
        <article className="bag-line">
            <div className="bag-line-photo">
                {item.image && (
                    <ProductPhoto
                        images={[item.image]}
                        name={name}
                        sizes="88px"
                        className="object-contain"
                    />
                )}
            </div>
            <div className="bag-line-detail">
                <Link
                    className="bag-line-name"
                    href={`/products/${item.productSlug}`}
                    onClick={() => useCartStore.getState().closeCart()}
                >
                    {name}
                </Link>
                <p className="bag-line-variant">
                    {[item.colorNameAr || item.colorNameFr, item.size].filter(Boolean).join(" · ")}
                </p>
                <p className="bag-unit-price">
                    <span dir="ltr">{item.price.toFixed(2)} MAD</span> / القطعة
                </p>
                {!item.stock && (
                    <p className="bag-stock-error">غير متوفر حالياً. احذفي هذه القطعة للمتابعة.</p>
                )}
                <div className="bag-line-controls">
                    <div className="bag-quantity" aria-label={`كمية ${name}`}>
                        <button
                            type="button"
                            aria-label={`تقليل كمية ${name}`}
                            disabled={disabled || item.quantity <= 1 || !item.stock}
                            onClick={() => updateQty(item.variantId, item.quantity - 1)}
                        >
                            <Minus size={16} aria-hidden="true" />
                        </button>
                        <span aria-live="polite" aria-atomic="true">
                            {item.quantity}
                        </span>
                        <button
                            type="button"
                            aria-label={`زيادة كمية ${name}`}
                            disabled={disabled || item.quantity >= item.stock || !item.stock}
                            onClick={() => updateQty(item.variantId, item.quantity + 1)}
                        >
                            <Plus size={16} aria-hidden="true" />
                        </button>
                    </div>
                    <button
                        className="bag-remove"
                        type="button"
                        aria-label={`حذف ${name}`}
                        disabled={disabled}
                        onClick={() => removeItem(item.variantId)}
                    >
                        <Trash2 size={16} aria-hidden="true" />
                        <span>حذف</span>
                    </button>
                </div>
                <p className="bag-line-total" dir="ltr">
                    {(item.price * item.quantity).toFixed(2)} <span>MAD</span>
                </p>
            </div>
        </article>
    );
}
