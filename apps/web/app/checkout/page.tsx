"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/cart.store";
import { createOrder } from "@/lib/api";
import { useShipping } from "@/hooks/useShipping";
export default function CheckoutPage() {
    const { items, total, clearCart, refreshCart } = useCartStore();
    const shipping = useShipping(total());
    const [form, setForm] = useState({ fullName: "", phone: "", city: "", address: "" });
    const [fields, setFields] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [orderId, setOrderId] = useState("");
    const [key, setKey] = useState("");
    const [consent, setConsent] = useState(false);
    useEffect(() => {
        refreshCart()
            .then((changed) => {
                if (changed) setError("تم تحديث الأسعار أو الكميات. راجعي ملخص الطلب.");
            })
            .catch(() => setError("تعذر تحديث السلة. اضغطي تأكيد الطلب لإعادة التحقق."));
    }, [refreshCart]);
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const errors: Record<string, string> = {};
        if (form.fullName.trim().length < 2) errors.fullName = "أدخلي الاسم الكامل";
        if (!/^(?:\+212|0)[5-7]\d{8}$/.test(form.phone.replace(/[\s()-]/g, "")))
            errors.phone = "أدخلي رقم هاتف مغربي صالحاً";
        if (!form.city.trim()) errors.city = "أدخلي المدينة";
        if (form.address.trim().length < 3) errors.address = "أدخلي عنوان التوصيل";
        setFields(errors);
        if (Object.keys(errors).length) {
            document.getElementById(`checkout-${Object.keys(errors)[0]}`)?.focus();
            return;
        }
        setBusy(true);
        setError("");
        try {
            const changed = await refreshCart();
            await shipping.retry({ throwOnError: true });
            if (changed) {
                setError("تغير السعر أو التوفر. راجعي المجموع الجديد ثم أكدي مجدداً.");
                return;
            }
            const cart = useCartStore.getState().items;
            if (!cart.length || cart.some((i) => i.quantity < 1 || i.quantity > i.stock)) {
                setError("احذفي المنتجات غير المتوفرة من السلة قبل المتابعة.");
                return;
            }
            const activeKey = key || crypto.randomUUID();
            setKey(activeKey);
            const order = await createOrder(
                {
                    paymentMethod: "COD",
                    crmConsent: consent,
                    expectedTotal: shipping.total ?? undefined,
                    customer: {
                        fullName: form.fullName.trim(),
                        phone: form.phone.replace(/[\s()-]/g, ""),
                        city: form.city.trim(),
                        region: form.city.trim(),
                        street: form.address.trim(),
                    },
                    items: cart.map((i) => ({
                        productId: i.productId,
                        variantId: i.variantId,
                        quantity: i.quantity,
                    })),
                },
                activeKey,
            );
            setOrderId(order.id);
            clearCart();
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch (failure) {
            const response = (
                failure as {
                    response?: {
                        data?: {
                            error?: string;
                            details?: { path: (string | number)[]; message: string }[];
                        };
                    };
                }
            ).response;
            if (response?.data?.details) {
                const errors: Record<string, string> = {};
                for (const issue of response.data.details) {
                    const field = String(issue.path.at(-1));
                    errors[field === "street" ? "address" : field] = issue.message;
                }
                setFields(errors);
            }
            setError(
                response?.data?.error ||
                    "تعذر الاتصال. بياناتك محفوظة هنا، ويمكنك المحاولة مجدداً.",
            );
        } finally {
            setBusy(false);
        }
    }
    if (orderId)
        return (
            <section className="page-shell text-center space-y-6" role="status">
                <h1 className="text-3xl">تم استلام طلبكم</h1>
                <p>رقم الطلب: {orderId.slice(-8).toUpperCase()}</p>
                <p>سيتواصل معكم فريقنا لتأكيد التفاصيل.</p>
                <Link href="/shop" className="btn-primary">
                    العودة إلى المتجر
                </Link>
            </section>
        );
    return (
        <section className="page-shell">
            <h1 className="text-3xl mb-4">إتمام الطلب</h1>
            <p className="mb-8">لا حاجة لإنشاء حساب. الدفع عند الاستلام.</p>
            {!items.length ? (
                <p>
                    حقيبتك فارغة.{" "}
                    <Link className="underline" href="/shop">
                        تصفحي المتجر
                    </Link>
                </p>
            ) : (
                <div className="grid lg:grid-cols-2 gap-10">
                    <form onSubmit={submit} noValidate className="space-y-5">
                        <h2 className="text-2xl">معلومات التوصيل</h2>
                        {(["fullName", "phone", "city", "address"] as const).map((field, i) => (
                            <div key={field}>
                                <label className="block mb-2" htmlFor={`checkout-${field}`}>
                                    {["الاسم الكامل", "رقم الهاتف", "المدينة", "عنوان التوصيل"][i]}{" "}
                                    *
                                </label>
                                <input
                                    className="store-input"
                                    id={`checkout-${field}`}
                                    name={field}
                                    type={field === "phone" ? "tel" : "text"}
                                    inputMode={field === "phone" ? "tel" : undefined}
                                    autoComplete={
                                        ["name", "tel", "address-level2", "street-address"][i]
                                    }
                                    required
                                    maxLength={field === "address" ? 500 : 120}
                                    value={form[field]}
                                    aria-invalid={!!fields[field]}
                                    aria-describedby={fields[field] ? `${field}-error` : undefined}
                                    onChange={(e) =>
                                        setForm((old) => ({ ...old, [field]: e.target.value }))
                                    }
                                />
                                {fields[field] && (
                                    <p id={`${field}-error`} className="text-red-800 mt-2">
                                        {fields[field]}
                                    </p>
                                )}
                            </div>
                        ))}
                        <label className="flex gap-3 leading-7">
                            <input
                                className="w-5 h-5 shrink-0 mt-1"
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                            />
                            أوافق اختيارياً على مشاركة بيانات طلبي مع فريق خدمة العملاء عبر
                            DeskcommCRM للتواصل بشأن طلبي عبر واتساب. يمكن إتمام الطلب دون هذه
                            الموافقة.
                        </label>
                        {error && (
                            <p role="alert" className="bg-red-50 text-red-900 p-4 rounded">
                                {error}
                            </p>
                        )}
                        {shipping.error && (
                            <p role="alert">
                                تعذر تحميل رسوم التوصيل.{" "}
                                <button
                                    type="button"
                                    className="underline action"
                                    onClick={() => shipping.retry()}
                                >
                                    إعادة المحاولة
                                </button>
                            </p>
                        )}
                        {shipping.settings?.codEnabled === false && (
                            <p role="alert">الطلب بالدفع عند الاستلام متوقف مؤقتاً.</p>
                        )}
                        <button
                            className="btn-primary w-full"
                            disabled={
                                busy ||
                                shipping.total === null ||
                                shipping.settings?.codEnabled === false ||
                                items.some((i) => i.quantity < 1)
                            }
                        >
                            {busy ? "جارٍ التحقق والحفظ…" : "تأكيد الطلب"}
                        </button>
                        <p className="text-sm leading-7">
                            قبل التأكيد، اطلعي على{" "}
                            <Link href="/delivery" className="underline">
                                التوصيل
                            </Link>{" "}
                            و
                            <Link href="/returns" className="underline">
                                الاستبدال والإرجاع
                            </Link>{" "}
                            و
                            <Link href="/privacy" className="underline">
                                الخصوصية
                            </Link>
                            .
                        </p>
                    </form>
                    <aside className="bg-white border rounded-xl p-6 h-fit space-y-4">
                        <h2 className="text-2xl">ملخص الطلب</h2>
                        {items.map((i) => (
                            <div key={i.variantId} className="border-b pb-3">
                                <p>
                                    {i.nameAr || i.nameFr} × {i.quantity}
                                </p>
                                <p>{(i.price * i.quantity).toFixed(2)} MAD</p>
                                {!i.stock && (
                                    <p className="text-red-800">
                                        غير متوفر —{" "}
                                        <button
                                            className="underline"
                                            onClick={() =>
                                                useCartStore.getState().removeItem(i.variantId)
                                            }
                                        >
                                            حذف من السلة
                                        </button>
                                    </p>
                                )}
                            </div>
                        ))}
                        <p>
                            التوصيل:{" "}
                            {shipping.loading
                                ? "جارٍ الحساب…"
                                : shipping.fee === null
                                  ? "تعذر تحميل الرسوم"
                                  : shipping.fee === 0
                                    ? "مجاني"
                                    : `${shipping.fee.toFixed(2)} MAD`}
                        </p>
                        <p className="text-xl">
                            المجموع:{" "}
                            {shipping.total === null
                                ? "بانتظار رسوم التوصيل"
                                : `${shipping.total.toFixed(2)} MAD`}
                        </p>
                        <button
                            className="underline action"
                            onClick={() => useCartStore.getState().openCart()}
                        >
                            تعديل السلة
                        </button>
                    </aside>
                </div>
            )}
        </section>
    );
}
