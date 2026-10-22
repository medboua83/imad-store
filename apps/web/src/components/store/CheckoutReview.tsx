"use client";
import type { useShipping } from "@/hooks/useShipping";
import type { CartItem } from "@/store/cart.store";
import { CartTotals } from "./CartTotals";
import { ProductPhoto } from "./ProductPhoto";

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
                {customer.address}، {customer.city}
            </address>
            <ul>
                {items.map((item) => (
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
                                {item.quantity} × <span dir="ltr">{item.price.toFixed(2)} MAD</span>
                            </p>
                        </div>
                        <strong dir="ltr">{(item.price * item.quantity).toFixed(2)} MAD</strong>
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
