"use client";
import { Check, Minus, Plus, ShoppingBag, MessageCircle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
const colorKey = (v: Product["variants"][number]) =>
    `${v.color.toLowerCase()}|${(v.colorNameFr || v.colorNameAr || v.colorNameEn).trim().toLowerCase()}`;
import type { Product } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";
export function ProductOptions({ product }: { product: Product }) {
    const [id, setId] = useState(
        product.variants.find((v) => v.stock > 0)?.id || product.variants[0]?.id || "",
    );
    const [quantity, setQuantity] = useState(1);
    const variant = product.variants.find((v) => v.id === id);
    const stock = variant?.stock || 0;
    const colors = [...new Map(product.variants.map((v) => [colorKey(v), v])).values()];
    const sizes = [...new Set(product.variants.map((v) => v.size || ""))];
    const selectedColor = variant ? colorKey(variant) : "";
    function selectVariant(next: Product["variants"][number] | undefined) {
        if (!next) return;
        setId(next.id);
        setQuantity(1);
    }
    return (
        <div className="product-options refined-options" id="product-options">
            <fieldset className="variant-fieldset">
                <legend>
                    اللون{" "}
                    <span>
                        {variant?.colorNameAr || variant?.colorNameFr || variant?.colorNameEn}
                    </span>
                </legend>
                <div className="color-options">
                    {colors.map((color) => {
                        const key = colorKey(color);
                        const matches = product.variants.filter((v) => colorKey(v) === key);
                        const available = matches.some((v) => v.stock > 0);
                        const label =
                            color.colorNameAr ||
                            color.colorNameFr ||
                            color.colorNameEn ||
                            "لون غير مسمى";
                        const hex = /^#[0-9a-f]{6}$/i.test(color.color) ? color.color : undefined;
                        return (
                            <button
                                type="button"
                                key={key}
                                aria-pressed={selectedColor === key}
                                disabled={!available}
                                aria-label={`${label}${available ? "" : " — غير متوفر"}`}
                                onClick={() =>
                                    selectVariant(
                                        matches.find(
                                            (v) => v.size === variant?.size && v.stock > 0,
                                        ) || matches.find((v) => v.stock > 0),
                                    )
                                }
                            >
                                {hex && (
                                    <span
                                        className="color-swatch"
                                        style={{ backgroundColor: hex }}
                                        aria-hidden="true"
                                    />
                                )}
                                <span>{label}</span>
                                {selectedColor === key && <Check size={14} aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            </fieldset>
            <fieldset className="variant-fieldset">
                <legend>
                    المقاس <span>{variant?.size || "مقاس موحد"}</span>
                </legend>
                <div className="size-options">
                    {sizes.map((size) => {
                        const match = product.variants.find(
                            (v) => colorKey(v) === selectedColor && (v.size || "") === size,
                        );
                        const label = size || "مقاس موحد";
                        return (
                            <button
                                type="button"
                                key={size}
                                aria-pressed={!!variant && (variant.size || "") === size}
                                disabled={!match?.stock}
                                aria-label={`${label}${match?.stock ? "" : " — غير متوفر لهذا اللون"}`}
                                onClick={() => selectVariant(match)}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                <p className="variant-help">المقاسات غير المتوفرة لهذا اللون تظهر مشطوبة.</p>
            </fieldset>
            {!product.variants.length && (
                <p role="status">لا توجد خيارات متاحة لهذا المنتج حالياً.</p>
            )}
            <div className="selected-variant-note" role="status">
                <span
                    className={`stock-indicator ${stock ? "" : "stock-empty"}`}
                    aria-hidden="true"
                />
                <span>
                    {stock ? "متوفر الآن" : "غير متوفر حالياً"}
                    {variant
                        ? ` · ${variant.colorNameAr || variant.colorNameFr || variant.colorNameEn}${variant.size ? ` / ${variant.size}` : ""}`
                        : ""}
                </span>
            </div>
            <div className="quantity-heading">
                <label htmlFor="product-quantity">الكمية</label>
                <span className="availability-note">
                    {stock ? `${stock} قطعة متوفرة` : "غير متوفر حالياً"}
                </span>
            </div>
            <div className="quantity-stepper">
                <button
                    type="button"
                    aria-label="تقليل الكمية"
                    disabled={quantity <= 1 || !stock}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                    <Minus size={17} aria-hidden="true" />
                </button>
                <input
                    id="product-quantity"
                    className="store-input"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={stock || 1}
                    step={1}
                    value={quantity}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        setQuantity(
                            Number.isFinite(n) ? Math.max(1, Math.min(stock, Math.floor(n))) : 1,
                        );
                    }}
                />
                <button
                    type="button"
                    aria-label="زيادة الكمية"
                    disabled={quantity >= stock || !stock}
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                >
                    <Plus size={17} aria-hidden="true" />
                </button>
            </div>
            <Link href="/contact" className="variant-contact">
                <MessageCircle size={16} aria-hidden="true" />
                سؤال عن المقاس أو اللون؟ تواصلوا معنا
            </Link>
            <div className="product-purchase-bar">
                <p className="purchase-price" dir="ltr">
                    {product.price.toFixed(2)} <span>MAD / القطعة</span>
                </p>
                <button
                    className="btn-primary w-full"
                    disabled={!variant || stock < 1}
                    onClick={() => {
                        if (variant) useCartStore.getState().addItem(product, variant, quantity);
                    }}
                >
                    <ShoppingBag size={19} aria-hidden="true" />
                    {stock ? "أضف إلى السلة" : "غير متوفر حالياً"}
                </button>
            </div>
        </div>
    );
}
