"use client";
import { trapDialogFocus } from "./dialog-focus";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Check,
    LoaderCircle,
    TriangleAlert,
    PackageCheck,
    ShoppingBag,
    X,
} from "lucide-react";
import { useCartStore } from "@/store/cart.store";
import { useShipping } from "@/hooks/useShipping";
import { CartLine } from "../store/CartLine";
import { CartTotals } from "../store/CartTotals";
import { CartRecommendations } from "../store/CartRecommendations";
import { CartRecoveryNotice } from "../store/CartRecoveryNotice";
import { CartDeliveryBenefit } from "../store/CartDeliveryBenefit";
export function CartDrawer() {
    const dialog = useRef<HTMLDialogElement>(null);
    const restoreAfterDismiss = useRef(false);
    const { items, isOpen, closeCart, total, refreshCart, itemCount } = useCartStore();
    const shipping = useShipping(total(), items);
    const [notice, setNotice] = useState("");
    const [review, setReview] = useState<"checking" | "ready" | "error">("checking");
    const [refreshVersion, setRefreshVersion] = useState(0);
    function close() {
        setReview("checking");
        closeCart();
    }
    function dismiss() {
        restoreAfterDismiss.current = true;
        close();
    }
    function closed() {
        const restore = restoreAfterDismiss.current;
        restoreAfterDismiss.current = false;
        close();
        if (!restore) return;
        const active = document.activeElement;
        if (
            active instanceof HTMLElement &&
            active !== document.body &&
            !dialog.current?.contains(active) &&
            !active.matches(":disabled") &&
            active.getClientRects().length
        )
            return;
        document.getElementById("store-cart-trigger")?.focus({ preventScroll: true });
    }
    useEffect(() => {
        const element = dialog.current;
        if (isOpen && !element?.open) {
            restoreAfterDismiss.current = false;
            element?.showModal();
        }
        if (!isOpen) {
            if (element?.open) element.close();
            return;
        }
        let active = true;
        refreshCart()
            .then((changed) => {
                if (!active) return;
                setNotice(changed ? "تم تحديث تفاصيل المنتجات أو الأسعار أو الكميات. راجعوا حقيبتكم قبل المتابعة." : "");
                setReview("ready");
            })
            .catch(() => {
                if (!active) return;
                setNotice("تعذر التحقق من السعر والتوفر. أعيدوا المحاولة قبل المتابعة.");
                setReview("error");
            });
        return () => {
            active = false;
        };
    }, [isOpen, refreshCart, refreshVersion]);
    useEffect(() => {
        if (!isOpen) return;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = old;
        };
    }, [isOpen]);
    const invalidItems = items.some(
        (item) => !item.stock || item.quantity < 1 || item.quantity > item.stock,
    );
    const canContinue =
        review === "ready" &&
        !invalidItems &&
        !shipping.loading &&
        !shipping.error &&
        shipping.total !== null &&
        shipping.settings?.codEnabled !== false;
    return (
        <dialog
            id="store-cart"
            onKeyDown={trapDialogFocus}
            ref={dialog}
            aria-labelledby="cart-title"
            onCancel={dismiss}
            onClose={closed}
            className="cart-dialog"
            dir="rtl"
        >
            <div className="bag-header">
                <div>
                    <p className="eyebrow">IMAD · حقيبتكم</p>
                    <h2 id="cart-title">
                        اختياراتكم <span>{itemCount()} قطعة</span>
                    </h2>
                </div>
                <button
                    type="button"
                    aria-label="إغلاق السلة"
                    className="bag-close"
                    onClick={dismiss}
                >
                    <X size={22} aria-hidden="true" />
                </button>
            </div>
            <div className="bag-body">
                <div className="bag-scroll">
                    <CartRecoveryNotice />
                    {notice && (
                        <div
                            className={`bag-notice ${review === "error" ? "bag-notice-error" : ""}`}
                            role="status"
                        >
                            <p>{notice}</p>
                            {review === "error" && (
                                <button
                                    type="button"
                                    className="text-link"
                                    onClick={() => {
                                        setReview("checking");
                                        setRefreshVersion((v) => v + 1);
                                    }}
                                >
                                    إعادة التحقق من السلة
                                </button>
                            )}
                        </div>
                    )}
                    {!items.length ? (
                        <div className="bag-empty">
                            <span className="empty-bag-icon">
                                <ShoppingBag size={32} aria-hidden="true" />
                            </span>
                            <h3>مساحة لاختياراتكم القادمة.</h3>
                            <p>أضيفوا القطع التي تفضلونها، وستجدون تفاصيلها هنا.</p>
                            <Link href="/shop" onClick={close} className="btn-primary">
                                اكتشفوا المجموعة <ArrowLeft size={18} aria-hidden="true" />
                            </Link>
                        </div>
                    ) : (
                        <>
                            <p className="bag-review-status" role="status">
                                {review === "ready" ? (
                                    <Check size={15} aria-hidden="true" />
                                ) : review === "error" ? (
                                    <TriangleAlert size={15} aria-hidden="true" />
                                ) : (
                                    <LoaderCircle size={15} aria-hidden="true" />
                                )}
                                {review === "checking"
                                    ? "جارٍ التحقق من الأسعار والتوفر…"
                                    : review === "ready"
                                      ? "الأسعار والتوفر محدثان"
                                      : "يلزم التحقق من السلة"}
                            </p>
                            <CartDeliveryBenefit
                                subtotal={total()}
                                shipping={shipping}
                                needsReview={invalidItems || review !== "ready"}
                            />
                            <div className="bag-items">
                                {items.map((item) => (
                                    <CartLine key={item.variantId} item={item} />
                                ))}
                            </div>
                            {isOpen && <CartRecommendations active onNavigate={close} />}
                        </>
                    )}
                </div>
                {!!items.length && (
                    <div className="bag-footer">
                        <CartTotals subtotal={total()} shipping={shipping} needsReview={invalidItems} />
                        {shipping.error && (
                            <p role="alert" className="bag-notice-error">
                                تعذر تحميل رسوم التوصيل.{" "}
                                <button
                                    type="button"
                                    className="text-link"
                                    onClick={() => shipping.retry()}
                                >
                                    إعادة المحاولة
                                </button>
                            </p>
                        )}
                        {invalidItems && (
                            <p role="alert" className="bag-notice-error">
                                احذفوا القطع غير المتوفرة للمتابعة.
                            </p>
                        )}
                        {shipping.settings?.codEnabled === false && (
                            <p role="alert" className="bag-notice-error">
                                الطلب بالدفع عند الاستلام متوقف مؤقتاً.
                            </p>
                        )}
                        {canContinue ? (
                            <Link
                                href="/checkout"
                                onClick={close}
                                className="btn-primary bag-checkout-link"
                            >
                                متابعة الطلب <ArrowLeft size={19} aria-hidden="true" />
                            </Link>
                        ) : (
                            <button type="button" className="btn-primary bag-checkout-link" disabled>
                                متابعة الطلب <ArrowLeft size={19} aria-hidden="true" />
                            </button>
                        )}
                        <p className="bag-payment-note">
                            <PackageCheck size={17} aria-hidden="true" />
                            الدفع عند الاستلام · بدون إنشاء حساب
                        </p>
                        <button type="button" className="bag-continue" onClick={dismiss}>
                            متابعة التسوق
                        </button>
                    </div>
                )}
            </div>
        </dialog>
    );
}
