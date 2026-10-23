"use client";
import type { useShipping } from "@/hooks/useShipping";
import { useCartStore } from "@/store/cart.store";
import { priceCart } from "@imad-store/shared";
export function CartTotals({
    subtotal,
    shipping,
}: {
    subtotal: number;
    shipping: ReturnType<typeof useShipping>;
}) {
    const unavailable = shipping.error || shipping.total === null;
    const savings = priceCart(useCartStore((state) => state.items)).savings;
    return (
        <dl className="bag-totals" aria-label="تفاصيل المبلغ">
            {savings > 0 && (
                <div className="quantity-saving">
                    <dt>توفير عرض الكمية</dt>
                    <dd dir="ltr">−{savings.toFixed(2)} MAD</dd>
                </div>
            )}
            <div>
                <dt>قيمة المنتجات</dt>
                <dd dir="ltr">{subtotal.toFixed(2)} MAD</dd>
            </div>
            <div>
                <dt>التوصيل</dt>
                <dd>
                    {shipping.loading ? (
                        "جارٍ الحساب…"
                    ) : shipping.error || shipping.fee === null ? (
                        "تعذر تحميل الرسوم"
                    ) : shipping.fee === 0 ? (
                        "مجاني"
                    ) : (
                        <span dir="ltr">{shipping.fee.toFixed(2)} MAD</span>
                    )}
                </dd>
            </div>
            <div className="bag-grand-total">
                <dt>
                    الإجمالي<span>شامل رسوم التوصيل</span>
                </dt>
                <dd>
                    {unavailable ? (
                        <span className="bag-total-pending">بانتظار رسوم التوصيل</span>
                    ) : (
                        <span dir="ltr">
                            {shipping.total!.toFixed(2)} <small>MAD</small>
                        </span>
                    )}
                </dd>
            </div>
        </dl>
    );
}
