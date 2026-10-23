"use client";
import { Check, Minus, Plus, ShoppingBag, MessageCircle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
const colorKey = (v: Product["variants"][number]) =>
    `${v.color.toLowerCase()}|${(v.colorNameFr || v.colorNameAr || v.colorNameEn).trim().toLowerCase()}`;
import type { Product } from "@/lib/api";
import { isAmbiguousSize, quantityDiscounts, quantityPriceBreakdown } from "@imad-store/shared";
import { orderedSizes } from "@/lib/product-presentation";
import { useCartStore } from "@/store/cart.store";
export function ProductOptions({ product }: { product: Product }) {
    const variants = product.variants.filter((v) => !isAmbiguousSize(v.size));
    const [id, setId] = useState(variants.find((v) => v.stock > 0)?.id || variants[0]?.id || "");
    const [quantity, setQuantity] = useState(1);
    const cart = useCartStore((state) => state.items);
    const inCart = cart
        .filter((item) => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
    const tiers = quantityDiscounts(product.price, product.quantityDiscounts);
    const variant = variants.find((v) => v.id === id);
    const stock = variant?.stock || 0;
    const available = Math.max(
        0,
        stock - (cart.find((item) => item.variantId === id)?.quantity ?? 0),
    );
    const selectedQuantity = Math.min(quantity, available || 1);
    const anticipatedQuantity = inCart + (available ? selectedQuantity : 0);
    const pricing = quantityPriceBreakdown(product.price, tiers, anticipatedQuantity);
    const total = pricing.total;
    const unitPrice = anticipatedQuantity ? total / anticipatedQuantity : product.price;
    const savings = Math.round((product.price * anticipatedQuantity - total) * 100) / 100;
    const choices = [...new Set([1, 2, 3, ...tiers.map((tier) => tier.minQuantity)])].sort(
        (a, b) => a - b,
    );
    const colors = [...new Map(variants.map((v) => [colorKey(v), v])).values()];
    const sizes = orderedSizes(variants);
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
                        const matches = variants.filter((v) => colorKey(v) === key);
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
                        const match = variants.find(
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
            <details className="size-advice">
                <summary>كيف تختارون المقاس المناسب؟</summary>
                <p>اختاروا مقاساً واحداً ثم اللون المطلوب. يظهر توفر كل مقاس حسب اللون المختار.</p>
                <p>
                    {/shoes|clogs/.test(product.category.slug)
                        ? "قيسوا طول القدم من الكعب إلى أطول إصبع، وتواصلوا معنا لمقارنته بقياسات هذا الموديل قبل الطلب."
                        : "تواصلوا معنا للحصول على قياسات هذا الموديل قبل الطلب، خاصة إذا كان اختياركم بين مقاسين."}
                </p>
                <Link href="/contact">مساعدة في اختيار المقاس</Link>
            </details>
            {!variants.length && <p role="status">لا توجد خيارات متاحة لهذا المنتج حالياً.</p>}
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
            <section className="quantity-offers" aria-label="عروض الكمية">
                <h2>اختاروا الكمية المناسبة</h2>
                <p>
                    {tiers.length
                        ? "العرض الأصغر يتكرر لكل مجموعة كاملة، والقطع المتبقية بالسعر العادي. إذا وُجد سعر خاص للعدد المختار فهو المعتمد. المقاسات والألوان من نفس المنتج تتجمع في السلة."
                        : "اختاروا عدد القطع، وشاهدوا المبلغ قبل الإضافة إلى السلة."}
                </p>
                <div className="quantity-choice-grid" role="group" aria-label="اختيار عدد القطع">
                    {choices.map((count) => (
                        <button
                            type="button"
                            key={count}
                            className="quantity-choice"
                            aria-pressed={selectedQuantity === count && available > 0}
                            aria-label={
                                count === 1
                                    ? "اختيار قطعة واحدة"
                                    : count === 2
                                      ? "اختيار قطعتين"
                                      : `اختيار ${count} قطع`
                            }
                            disabled={count > available}
                            onClick={() => setQuantity(count)}
                        >
                            <strong>{count}</strong>
                            <span>
                                {count === 1 ? "قطعة واحدة" : count === 2 ? "قطعتان" : "قطع"}
                            </span>
                            <Check size={15} aria-hidden="true" className="quantity-choice-check" />
                        </button>
                    ))}
                </div>
                <div className="quantity-selection-summary" aria-live="polite" aria-atomic="true">
                    {available > 0 ? (
                        <>
                            <p>
                                {inCart > 0
                                    ? "إجمالي هذا المنتج بعد الإضافة"
                                    : "إجمالي القطع المختارة"}
                            </p>
                            <strong className="quantity-selection-total" dir="ltr">
                                {total.toFixed(2)} <span>MAD</span>
                            </strong>
                            {pricing.packs.length > 0 && (
                                <ul
                                    className="quantity-pack-lines"
                                    aria-label="تفصيل السعر حسب العروض"
                                >
                                    {pricing.packs.map((pack) => (
                                        <li key={pack.quantity}>
                                            <span>
                                                {pack.count} × عرض {pack.quantity} قطع
                                            </span>
                                            <bdi>
                                                {(pack.count * pack.totalPrice).toFixed(2)} MAD
                                            </bdi>
                                        </li>
                                    ))}
                                    {pricing.looseQuantity > 0 && (
                                        <li>
                                            <span>
                                                {pricing.looseQuantity} × قطعة بالسعر العادي
                                            </span>
                                            <bdi>
                                                {(pricing.looseQuantity * product.price).toFixed(2)}{" "}
                                                MAD
                                            </bdi>
                                        </li>
                                    )}
                                </ul>
                            )}
                            {savings > 0 && (
                                <p className="quantity-selection-saving">
                                    <del dir="ltr">
                                        {(product.price * anticipatedQuantity).toFixed(2)} MAD
                                    </del>
                                    <span>
                                        توفير <bdi>{savings.toFixed(2)} MAD</bdi>
                                    </span>
                                </p>
                            )}
                            <p>
                                {inCart > 0
                                    ? `يشمل ${inCart} في السلة + ${selectedQuantity} للإضافة = ${anticipatedQuantity} قطعة من هذا المنتج.`
                                    : `${selectedQuantity} ${selectedQuantity === 1 ? "قطعة" : "قطع"} · حسب اللون والمقاس المختارين.`}
                            </p>
                            {anticipatedQuantity > 1 && (
                                <p className="quantity-average" dir="ltr">
                                    {Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) >
                                    0.000001
                                        ? "≈ "
                                        : ""}
                                    {unitPrice.toFixed(2)} MAD / متوسط القطعة
                                </p>
                            )}
                            <small>قيمة المنتجات فقط · التوصيل يُحسب في السلة.</small>
                        </>
                    ) : (
                        <p>
                            {stock
                                ? "الكمية المتوفرة لهذا الخيار موجودة في السلة. يمكن اختيار مقاس أو لون آخر."
                                : "اختاروا مقاساً ولوناً متوفرين."}
                        </p>
                    )}
                </div>
            </section>
            <div className="quantity-heading">
                <label htmlFor="product-quantity">الكمية</label>
                <span className="availability-note">
                    {available
                        ? `${available} قطعة متاحة للإضافة`
                        : stock
                          ? "الكمية المتوفرة في السلة"
                          : "غير متوفر حالياً"}
                </span>
            </div>
            <div className="quantity-stepper">
                <button
                    type="button"
                    aria-label="تقليل الكمية"
                    disabled={selectedQuantity <= 1 || !available}
                    onClick={() => setQuantity(Math.max(1, selectedQuantity - 1))}
                >
                    <Minus size={17} aria-hidden="true" />
                </button>
                <input
                    id="product-quantity"
                    className="store-input"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={available || 1}
                    step={1}
                    disabled={!available}
                    value={selectedQuantity}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        setQuantity(
                            Number.isFinite(n)
                                ? Math.max(1, Math.min(available || 1, Math.floor(n)))
                                : 1,
                        );
                    }}
                />
                <button
                    type="button"
                    aria-label="زيادة الكمية"
                    disabled={selectedQuantity >= available || !available}
                    onClick={() => setQuantity(Math.min(available, selectedQuantity + 1))}
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
                    {available ? total.toFixed(2) : "—"}{" "}
                    <span>MAD · {inCart > 0 ? "إجمالي هذا المنتج" : "إجمالي الاختيار"}</span>
                </p>
                <button
                    className="btn-primary w-full"
                    disabled={!variant || !available}
                    onClick={() => {
                        if (variant && available)
                            useCartStore.getState().addItem(product, variant, selectedQuantity);
                    }}
                >
                    <ShoppingBag size={19} aria-hidden="true" />
                    {available ? "إضافة إلى السلة" : stock ? "الكمية في السلة" : "غير متوفر حالياً"}
                </button>
            </div>
        </div>
    );
}
