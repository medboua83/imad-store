"use client";
import type { useShipping } from "@/hooks/useShipping";
import type { CartItem } from "@/store/cart.store";
import { CartTotals } from "./CartTotals";
import { ProductPhoto } from "./ProductPhoto";
import { shippingCityLabel, priceCart } from "@imad-store/shared";

export function CheckoutReview({
    customer,
    items,
    subtotal,
    shipping,
    onEdit,
}: {
    customer: { fullName: string; phone: string; city: string; address: string };
    items: CartItem[];
    subtotal: number;
    shipping: ReturnType<typeof useShipping>;
    onEdit: () => void;
}) {
    return (
        <section
            className="checkout-final-review"
            aria-labelledby="checkout-review-title"
            tabIndex={-1}
            id="checkout-final-review"
        >
            <h2 id="checkout-review-title">راجعوا طلبكم قبل التأكيد النهائي</h2>
            <p>{customer.fullName}</p>
            <p dir="ltr">{customer.phone}</p>
            <address>
                {customer.address}، {shippingCityLabel(customer.city)}
            </address>
            <ul>
                {priceCart(items).lines.map(({ item, unitPrice, total, allocations }) => (
                    <li key={item.variantId}>
                        <div className="checkout-mini-photo">
                            <ProductPhoto
                                images={item.images ?? [item.image]}
                                name={item.nameAr || item.nameFr}
                                sizes="52px"
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <strong>{item.nameAr || item.nameFr}</strong>
                            <p>
                                {[item.colorNameAr || item.colorNameFr, item.size]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            <p>
                                {item.quantity} قطعة ·{" "}
                                <span dir="ltr">
                                    {Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) >
                                    0.000001
                                        ? "≈ "
                                        : ""}
                                    {unitPrice.toFixed(2)} MAD
                                </span>{" "}
                                {new Set(allocations.map((part) => part.unitPrice)).size > 1
                                    ? "متوسط القطعة"
                                    : "للقطعة"}
                                {allocations.length > 1 && (
                                    <span className="bag-pack-prices" dir="ltr">
                                        {allocations
                                            .map(
                                                (part) =>
                                                    `${part.quantity} × ${part.unitPrice.toFixed(2)} MAD`,
                                            )
                                            .join(" + ")}
                                    </span>
                                )}
                            </p>
                        </div>
                        <strong dir="ltr">{total.toFixed(2)} MAD</strong>
                    </li>
                ))}
            </ul>
            <CartTotals subtotal={subtotal} shipping={shipping} />
            <p>
                بالضغط على «أؤكد طلبي»، تؤكدون الطلب مباشرة على الموقع. لن نطلب تأكيده مرة أخرى عبر
                واتساب. الدفع عند الاستلام.
            </p>
            <button type="button" className="text-link" onClick={onEdit}>
                تعديل المعلومات
            </button>
        </section>
    );
}
