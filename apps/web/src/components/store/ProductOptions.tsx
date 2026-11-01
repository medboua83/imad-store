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
export function ProductOptions({ product, preferredSize }: { product: Product; preferredSize?: string }) {
    const variants = product.variants.filter((v) => !isAmbiguousSize(v.size));
    const [id, setId] = useState(() => preferredSize
        ? variants.find(v => v.stock > 0 && (v.size || "").toLowerCase() === preferredSize.toLowerCase())?.id || ""
        : variants.find((v) => v.stock > 0)?.id || variants[0]?.id || "");
    const [quantity, setQuantity] = useState(1);
    const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
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
    const draftNumber = Number(quantityDraft);
    const quantityInvalid =
        available > 0 &&
        quantityDraft !== null &&
        (quantityDraft === "" ||
            !Number.isSafeInteger(draftNumber) ||
            draftNumber < 1 ||
            draftNumber > available);
    const quantityError = `أدخلوا عدداً صحيحاً من 1 إلى ${available}.`;
    const anticipatedQuantity = inCart + (available ? selectedQuantity : 0);
    const selectionQuantity = available ? selectedQuantity : 0;
    const pricing = quantityPriceBreakdown(product.price, tiers, selectionQuantity);
    const anticipatedTotal = quantityPriceBreakdown(
        product.price,
        tiers,
        anticipatedQuantity,
    ).total;
    const total = pricing.total;
    const unitPrice = selectionQuantity ? total / selectionQuantity : product.price;
    const savings = Math.round((product.price * selectionQuantity - total) * 100) / 100;
    const choices = [...new Set([1, 2, 3, ...tiers.map((tier) => tier.minQuantity)])].sort(
        (a, b) => a - b,
    );
    const colors = [...new Map(variants.map((v) => [colorKey(v), v])).values()];
    const sizes = orderedSizes(variants);
    const selectedColor = variant ? colorKey(variant) : "";
    function chooseQuantity(value: number) {
        setQuantity(value);
        setQuantityDraft(null);
    }
    function selectVariant(next: Product["variants"][number] | undefined) {
        if (!next) return;
        const remaining = Math.max(
            0,
            next.stock - (cart.find((item) => item.variantId === next.id)?.quantity ?? 0),
        );
        setId(next.id);
        chooseQuantity(Math.max(1, Math.min(selectedQuantity, remaining)));
    }
    return (
        <div className="product-options refined-options" id="product-options">
            <div className="product-variant-grid">
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
                            const hex = /^#[0-9a-f]{6}$/i.test(color.color)
                                ? color.color
                                : undefined;
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
                                    {selectedColor === key && (
                                        <Check size={14} aria-hidden="true" />
                                    )}
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
            </div>
            {!variants.length && <p role="status">لا توجد خيارات متاحة لهذا المنتج حالياً.</p>}
            <section className="quantity-offers" aria-label="عروض الكمية">
                <h2>اختاروا الكمية المناسبة</h2>
                <div className="quantity-choice-grid" role="group" aria-label="اختيار عدد القطع">
                    {choices.map((count) => (
                        <button
                            type="button"
                            key={count}
                            className="quantity-choice"
                            aria-pressed={
                                selectedQuantity === count && available > 0 && !quantityInvalid
                            }
                            aria-label={
                                count === 1
                                    ? "اختيار قطعة واحدة"
                                    : count === 2
                                      ? "اختيار قطعتين"
                                      : `اختيار ${count} قطع`
                            }
                            disabled={count > available}
                            onClick={() => chooseQuantity(count)}
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
                    {quantityInvalid ? (
                        <p id="product-quantity-error" className="quantity-input-error">
                            {quantityError}
                        </p>
                    ) : available > 0 ? (
                        <>
                            <p>سعر الكمية المختارة</p>
                            <strong className="quantity-selection-total" dir="ltr">
                                {total.toFixed(2)} <span>MAD</span>
                            </strong>
                            {savings > 0 && (
                                <p className="quantity-selection-saving">
                                    <del dir="ltr">
                                        {(product.price * selectionQuantity).toFixed(2)} MAD
                                    </del>
                                    <span>
                                        توفير <bdi>{savings.toFixed(2)} MAD</bdi>
                                    </span>
                                </p>
                            )}
                            <p>
                                {`${selectedQuantity} ${selectedQuantity === 1 ? "قطعة" : "قطع"} · حسب اللون والمقاس المختارين.`}
                            </p>
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
            <div className="product-quantity-row">
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
                        onClick={() => chooseQuantity(Math.max(1, selectedQuantity - 1))}
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
                        aria-invalid={quantityInvalid}
                        aria-describedby={quantityInvalid ? "product-quantity-error" : undefined}
                        value={available && quantityDraft !== null ? quantityDraft : selectedQuantity}
                        onChange={(e) => {
                            const value = e.target.value;
                            const n = Number(value);
                            setQuantityDraft(value);
                            if (
                                value !== "" &&
                                Number.isSafeInteger(n) &&
                                n >= 1 &&
                                n <= available
                            )
                                setQuantity(n);
                        }}
                        onBlur={() => {
                            if (!quantityInvalid) setQuantityDraft(null);
                        }}
                    />
                    <button
                        type="button"
                        aria-label="زيادة الكمية"
                        disabled={selectedQuantity >= available || !available}
                        onClick={() => chooseQuantity(Math.min(available, selectedQuantity + 1))}
                    >
                        <Plus size={17} aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div className="product-purchase-bar">
                <p className="purchase-price" dir="ltr">
                    {available && !quantityInvalid ? total.toFixed(2) : "—"}{" "}
                    <span>MAD · سعر الكمية المختارة</span>
                </p>
                <button
                    className="btn-primary w-full"
                    disabled={!variant || !available || quantityInvalid}
                    onClick={() => {
                        if (variant && available && !quantityInvalid)
                            useCartStore.getState().addItem(product, variant, selectedQuantity);
                    }}
                >
                    <ShoppingBag size={19} aria-hidden="true" />
                    {available ? "إضافة إلى السلة" : stock ? "الكمية في السلة" : "غير متوفر حالياً"}
                </button>
            </div>
            {inCart > 0 && (
                <aside
                    className="quantity-cart-preview"
                    aria-label="تقدير السلة بعد الإضافة"
                    aria-live="polite"
                >
                    <p>
                        في السلة الآن: <bdi>{inCart}</bdi> قطعة من هذا المنتج.
                    </p>
                    {available > 0 && !quantityInvalid && (
                        <>
                            <p>
                                بعد إضافة <bdi>{selectedQuantity}</bdi>:{" "}
                                <bdi>{anticipatedQuantity}</bdi> قطع من هذا المنتج بإجمالي{" "}
                                <strong>
                                    <bdi>{anticipatedTotal.toFixed(2)} MAD</bdi>
                                </strong>
                                .
                            </p>
                            <small>
                                هذا تقدير لإضافة جديدة؛ سلتكم الحالية لم تتغير. تُجمع عروض هذا
                                المنتج بين مقاساته وألوانه.
                            </small>
                        </>
                    )}
                </aside>
            )}
            <details className="quantity-price-details">
                <summary>تفاصيل السعر والعروض</summary>
                <p>
                    {tiers.length
                        ? "العرض الأصغر يتكرر لكل مجموعة كاملة، والقطع المتبقية بالسعر العادي. إذا وُجد سعر خاص للعدد المختار فهو المعتمد. المقاسات والألوان من نفس المنتج تتجمع في السلة."
                        : "اختاروا عدد القطع، وشاهدوا المبلغ قبل الإضافة إلى السلة."}
                </p>
                {available > 0 && !quantityInvalid && (
                    <>
                        {pricing.packs.length > 0 && (
                            <ul className="quantity-pack-lines" aria-label="تفصيل السعر حسب العروض">
                                {pricing.packs.map((pack) => (
                                    <li key={pack.quantity}>
                                        <span>
                                            {pack.count} × عرض {pack.quantity} قطع
                                        </span>
                                        <bdi>{(pack.count * pack.totalPrice).toFixed(2)} MAD</bdi>
                                    </li>
                                ))}
                                {pricing.looseQuantity > 0 && (
                                    <li>
                                        <span>{pricing.looseQuantity} × قطعة بالسعر العادي</span>
                                        <bdi>
                                            {(pricing.looseQuantity * product.price).toFixed(2)} MAD
                                        </bdi>
                                    </li>
                                )}
                            </ul>
                        )}
                        {selectionQuantity > 1 && (
                            <p className="quantity-average" dir="ltr">
                                {Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) > 0.000001
                                    ? "≈ "
                                    : ""}
                                {unitPrice.toFixed(2)} MAD / متوسط القطعة
                            </p>
                        )}
                    </>
                )}
            </details>
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
            <Link href="/contact" className="variant-contact">
                <MessageCircle size={16} aria-hidden="true" />
                سؤال عن المقاس أو اللون؟ تواصلوا معنا
            </Link>
        </div>
    );
}
