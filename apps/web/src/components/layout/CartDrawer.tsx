"use client";
import { trapDialogFocus } from "./dialog-focus";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart.store";
import { useShipping } from "@/hooks/useShipping";
export function CartDrawer() {
    const dialog = useRef<HTMLDialogElement>(null);
    const { items, isOpen, closeCart, updateQty, removeItem, total, refreshCart } = useCartStore();
    const shipping = useShipping(total());
    const [notice, setNotice] = useState("");
    useEffect(() => {
        const element = dialog.current;
        if (isOpen && !element?.open) {
            element?.showModal();
            refreshCart()
                .then((changed) =>
                    setNotice(
                        changed ? "تم تحديث الأسعار أو الكميات. راجعي السلة قبل المتابعة." : "",
                    ),
                )
                .catch(() => setNotice("تعذر التحقق من التوفر. يمكنك إعادة المحاولة."));
        }
        if (!isOpen && element?.open) element.close();
    }, [isOpen, refreshCart]);
    useEffect(() => {
        if (!isOpen) return;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = old;
        };
    }, [isOpen]);
    return (
        <dialog
            onKeyDown={trapDialogFocus}
            ref={dialog}
            aria-labelledby="cart-title"
            onCancel={closeCart}
            onClose={closeCart}
            className="cart-dialog"
            dir="rtl"
        >
            <div className="flex items-center justify-between border-b p-5">
                <h2 id="cart-title" className="text-2xl">
                    حقيبتي
                </h2>
                <button
                    type="button"
                    aria-label="إغلاق السلة"
                    className="action"
                    onClick={closeCart}
                >
                    إغلاق ×
                </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                {notice && (
                    <p role="status">
                        {notice}{" "}
                        <button
                            className="underline"
                            onClick={() =>
                                refreshCart()
                                    .then(() => setNotice("تم تحديث السلة."))
                                    .catch(() => setNotice("تعذر الاتصال. حاولي مجدداً."))
                            }
                        >
                            إعادة المحاولة
                        </button>
                    </p>
                )}
                {!items.length ? (
                    <div className="py-12 text-center space-y-6">
                        <p>حقيبتك فارغة</p>
                        <Link href="/shop" onClick={closeCart} className="btn-primary">
                            تصفح المجموعة
                        </Link>
                    </div>
                ) : (
                    items.map((item) => (
                        <article key={item.variantId} className="flex gap-4 border-b pb-5">
                            <div className="relative w-20 h-28 shrink-0">
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.nameAr || item.nameFr}
                                        fill
                                        sizes="80px"
                                        className="object-cover rounded"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <Link
                                    className="font-semibold underline"
                                    href={`/products/${item.productSlug}`}
                                    onClick={closeCart}
                                >
                                    {item.nameAr || item.nameFr}
                                </Link>
                                <p>
                                    {item.colorNameAr || item.colorNameFr} {item.size}
                                </p>
                                {!item.stock && (
                                    <p className="text-red-800">
                                        هذا النوع غير متوفر. احذفيه للمتابعة.
                                    </p>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        className="action"
                                        aria-label={`تقليل كمية ${item.nameAr}`}
                                        onClick={() => updateQty(item.variantId, item.quantity - 1)}
                                    >
                                        −
                                    </button>
                                    <span aria-live="polite">{item.quantity}</span>
                                    <button
                                        className="action"
                                        disabled={item.quantity >= (item.stock || 0)}
                                        aria-label={`زيادة كمية ${item.nameAr}`}
                                        onClick={() => updateQty(item.variantId, item.quantity + 1)}
                                    >
                                        +
                                    </button>
                                    <button
                                        className="action underline"
                                        aria-label={`حذف ${item.nameAr}`}
                                        onClick={() => removeItem(item.variantId)}
                                    >
                                        حذف
                                    </button>
                                </div>
                                <p>{(item.price * item.quantity).toFixed(2)} MAD</p>
                            </div>
                        </article>
                    ))
                )}
            </div>
            {!!items.length && (
                <div className="border-t p-5 space-y-3">
                    <p>المجموع: {total().toFixed(2)} MAD</p>
                    <p>
                        التوصيل:{" "}
                        {shipping.loading
                            ? "جارٍ الحساب…"
                            : shipping.fee === null
                              ? "غير متاح حالياً"
                              : shipping.fee === 0
                                ? "مجاني"
                                : `${shipping.fee.toFixed(2)} MAD`}
                    </p>
                    {shipping.error && (
                        <p role="alert">
                            تعذر تحميل رسوم التوصيل.{" "}
                            <button className="underline action" onClick={() => shipping.retry()}>
                                إعادة المحاولة
                            </button>
                        </p>
                    )}
                    <p className="font-semibold">
                        الإجمالي:{" "}
                        {shipping.total === null
                            ? "يظهر بعد تحميل رسوم التوصيل"
                            : `${shipping.total.toFixed(2)} MAD`}
                    </p>
                    <Link href="/checkout" onClick={closeCart} className="btn-primary w-full">
                        متابعة الطلب
                    </Link>
                    <p className="text-sm">الدفع عند الاستلام</p>
                </div>
            )}
        </dialog>
    );
}
