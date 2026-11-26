"use client";
import { formatStoreAmount } from "@/lib/store-money";

import type { useShipping } from "@/hooks/useShipping";
import { useCartStore } from "@/store/cart.store";
import { priceCart } from "@imad-store/shared";
export function CartTotals({
    subtotal,
    shipping,
    needsReview = false,
    mode = "full",
}: {
    subtotal: number;
    shipping: ReturnType<typeof useShipping>;
    needsReview?: boolean;
    mode?: "full" | "summary" | "breakdown";
}) {
    const unavailable = shipping.error || shipping.total === null;
    const savings = priceCart(useCartStore((state) => state.items)).savings;
    return (
        <dl className={mode === "breakdown" ? "bag-breakdown-totals" : "bag-totals"} aria-label="تفاصيل المبلغ">
            {mode !== "summary" && <>
            {savings > 0 && (
                <div className="quantity-saving">
                    <dt>توفير عرض الكمية</dt>
                    <dd dir="ltr">−{formatStoreAmount(savings)} MAD</dd>
                </div>
            )}
            <div>
                <dt>قيمة المنتجات</dt>
                <dd dir="ltr">{formatStoreAmount(subtotal)} MAD</dd>
            </div>
            <div className="bag-shipping-row">
                <dt>رسوم التوصيل</dt>
                <dd>
                    {needsReview ? (
                        "بعد مراجعة الحقيبة"
                    ) : shipping.loading ? (
                        "جارٍ الحساب…"
                    ) : shipping.error || shipping.fee === null ? (
                        "تعذر تحميل الرسوم"
                    ) : shipping.fee === 0 ? (
                        "مجاني"
                    ) : (
                        <span dir="ltr">{formatStoreAmount(shipping.fee)} MAD</span>
                    )}
                </dd>
            </div>
            </>}
            {mode !== "breakdown" && <div className="bag-grand-total">
                <dt>
                    الإجمالي<span>شامل رسوم التوصيل</span>
                </dt>
                <dd>
                    {needsReview ? (
                        <span className="bag-total-pending">راجعوا الحقيبة</span>
                    ) : unavailable ? (
                        <span className="bag-total-pending">بانتظار رسوم التوصيل</span>
                    ) : (
                        <span dir="ltr">
                            {formatStoreAmount(shipping.total!)} <small>MAD</small>
                        </span>
                    )}
                </dd>
            </div>}
        </dl>
    );
}
