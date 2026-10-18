"use client";

import { useState, Suspense } from "react";

import { useCartStore } from "@/store/cart.store";
import { createOrder } from "@/lib/api";
import { CheckCircle, Ship, AlertCircle, User, Phone, MapPin, CreditCard, Lock } from "lucide-react";

import { useShipping } from "@/hooks/useShipping";

function CheckoutContent() {
    const { items, total, clearCart } = useCartStore();

    const { settings, fee: shippingFee, total: orderTotal } = useShipping(total());

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [crmConsent, setCrmConsent] = useState(false);
    const [checkoutKey, setCheckoutKey] = useState<string | null>(null);

    const [form, setForm] = useState({
        fullName: "",
        phone: "",
        city: "",
        address: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");

        const itemsPayload = items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            name: i.nameAr || i.nameFr || i.nameEn || "Produit",
        }));

        try {
            const activeKey = checkoutKey ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `order_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            if (!checkoutKey) setCheckoutKey(activeKey);
            const order = await createOrder({
                paymentMethod: "COD",
                customer: {
                    fullName: form.fullName,
                    phone: form.phone.replace(/[\s()-]/g, ""),
                    street: form.address,
                    city: form.city,
                    region: form.city,
                },
                items: itemsPayload,
                crmConsent,
            }, activeKey);

            setOrderId(order.id);
            setSuccess(true);
            clearCart();
            setCheckoutKey(null);
        } catch (err: unknown) {
            console.error("Order failed:", err);
            // Surface the real API error if available
            const axiosErr = err as { response?: { data?: { error?: string; details?: { message?: string }[] } }; message?: string };
            const apiMsg = axiosErr?.response?.data?.error
                ?? axiosErr?.response?.data?.details?.[0]?.message
                ?? axiosErr?.message;
            setErrorMsg(
                apiMsg
                    ? `خطأ: ${apiMsg}`
                    : "فشل في تسجيل طلبكم. برجاء التحقق من البيانات والمحاولة مجدداً."
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 max-w-lg mx-auto text-center" dir="rtl">
                <CheckCircle size={56} strokeWidth={1} className="text-emerald-500 mb-8" />
                <h1 className="text-4xl font-light text-[#1A1A2E] tracking-wide mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    تم استلام طلبكم
                </h1>
                <p className="text-[#9B8E82] text-sm tracking-wide leading-relaxed font-light mb-4">
                    شكراً لاختياركم IMAD Mode. سيتواصل معكم فريقنا قريباً لتأكيد الطلب.
                </p>
                {orderId && (
                    <p className="text-xs text-[#C9A96E] tracking-widest mb-8">
                        رقم الطلب: #{orderId.slice(-8).toUpperCase()}
                    </p>
                )}
                <a
                    href={`https://wa.me/212660560522?text=${encodeURIComponent("السلام عليكم، أؤكد طلبي رقم " + (orderId?.slice(-8).toUpperCase() ?? ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-[#25D366] text-white text-sm tracking-[0.1em] font-bold py-4 px-12 rounded-full shadow-lg hover:bg-[#128C7E] hover:scale-105 transition-all duration-300 mb-6"
                >
                    <span className="text-xl">💬</span> تأكيد الطلب عبر الواتساب
                </a>
                <a
                    href="/"
                    className="inline-block bg-[#1A1A2E] text-white text-[10px] tracking-[0.25em] uppercase font-bold py-4 px-10 hover:bg-[#C9A96E] transition-colors duration-300"
                >
                    العودة للرئيسية
                </a>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col justify-center items-center px-4 max-w-lg mx-auto text-center" dir="rtl">
                <p className="text-3xl font-light text-[#1A1A2E] tracking-wide mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    حقيبة التسوق فارغة
                </p>
                <p className="text-[#9B8E82] text-xs uppercase tracking-widest font-light mb-8">
                    تصفحي مجموعاتنا الراقية لأحدث التصاميم
                </p>
                <a
                    href="/shop"
                    className="inline-block bg-[#1A1A2E] text-white text-[10px] tracking-[0.25em] uppercase font-bold py-4 px-10 hover:bg-[#C9A96E] transition-colors duration-300"
                >
                    تسوقي الآن
                </a>
            </div>
        );
    }

    const formFields: Array<{
        key: keyof typeof form;
        label: string;
        type: string;
        placeholder: string;
        colSpan?: number;
        icon: React.ReactNode;
        required?: boolean;
    }> = [
        {
            key: "fullName",
            label: "الاسم الكامل",
            type: "text",
            placeholder: "ياسمين العلمي",
            icon: <User size={14} />,
            required: true,
        },
        {
            key: "phone",
            label: "رقم الهاتف",
            type: "tel",
            placeholder: "+212 600-000000",
            icon: <Phone size={14} />,
            required: true,
        },
        {
            key: "city",
            label: "المدينة",
            type: "text",
            placeholder: "الدار البيضاء",
            icon: <MapPin size={14} />,
            required: true,
        },
        {
            key: "address",
            label: "عنوان التوصيل",
            type: "text",
            placeholder: "شارع المسيرة، رقم 4",
            colSpan: 2,
            icon: <MapPin size={14} />,
            required: true,
        },
    ];

    return (
        <div className="max-w-[1300px] mx-auto px-6 md:px-12 py-16 md:py-24" dir="rtl">
            <div className="text-center mb-16">
                <p className="text-[#C9A96E] text-[10px] tracking-[0.3em] uppercase mb-4">Haute Couture Modeste</p>
                <h1 className="text-4xl md:text-5xl font-light text-[#1A1A2E] tracking-wide" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    إتمام الطلب
                </h1>
                <div className="w-[100px] h-px bg-[#C9A96E]/20 mx-auto mt-6" />
                <p className="text-[10px] text-[#9B8E82] tracking-widest uppercase mt-4">
                    لا حاجة لإنشاء حساب
                </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-16 items-start">
                {/* ─── Form Pane ───────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-12">
                    {errorMsg && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 text-xs tracking-wide">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <div>
                        <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-[#1A1A2E] mb-8 border-b border-[#C9A96E]/10 pb-4">
                            01. معلومات التوصيل
                        </h2>
                        <div className="grid md:grid-cols-2 gap-x-6 gap-y-6">
                            {formFields.map((f) => (
                                <div key={f.key} className={f.colSpan === 2 ? "md:col-span-2" : ""}>
                                    <label htmlFor={`checkout-${f.key}`} className="flex items-center gap-2 text-[9px] tracking-[0.2em] uppercase font-medium text-[#C9A96E] mb-2">
                                        {f.icon} {f.label} {f.required && "*"}
                                    </label>
                                    <input
                                        id={`checkout-${f.key}`}
                                        type={f.type}
                                        required={f.required}
                                        placeholder={f.placeholder}
                                        value={form[f.key]}
                                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                        className="w-full bg-[#FDFAF6] border border-[#1A1A2E]/10 px-5 py-4 text-xs tracking-wide text-[#1A1A2E] outline-none transition-colors hover:border-[#1A1A2E]/30 focus:border-[#C9A96E] focus:bg-white placeholder:text-[#9B8E82]/50 placeholder:text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-[#1A1A2E] mb-8 border-b border-[#C9A96E]/10 pb-4">
                            02. طريقة الدفع
                        </h2>
                        <div className="space-y-3">
                            {/* Active option — Cash on Delivery */}
                            <label
                                className="flex items-center justify-between p-6 border border-[#C9A96E] bg-[#fbf8f3] cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-4">
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="COD"
                                        checked
                                        readOnly
                                        className="accent-[#C9A96E] w-4 h-4 cursor-pointer"
                                    />
                                    <div>
                                        <p className="font-medium text-xs text-[#1A1A2E] tracking-wider uppercase">
                                            الدفع عند الاستلام
                                        </p>
                                        <p className="text-[10px] text-[#9B8E82] font-light mt-1">
                                            ادفعي نقداً عند استلام الطلب
                                        </p>
                                    </div>
                                </div>
                                <Ship size={20} strokeWidth={1} className="text-[#C9A96E]" />
                            </label>

                            {/* Disabled — Card payment coming soon */}
                            <div
                                role="group"
                                aria-disabled="true"
                                className="relative flex items-center justify-between p-6 border border-dashed border-[#1A1A2E]/15 bg-[#FDFAF6]/40 cursor-not-allowed select-none opacity-60"
                            >
                                <div className="flex items-center gap-4">
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="CARD"
                                        disabled
                                        aria-disabled="true"
                                        tabIndex={-1}
                                        onChange={(e) => e.preventDefault()}
                                        onClick={(e) => e.preventDefault()}
                                        className="accent-[#C9A96E] w-4 h-4 cursor-not-allowed"
                                    />
                                    <div>
                                        <p className="font-medium text-xs text-[#1A1A2E]/60 tracking-wider uppercase">
                                            بطاقة بنكية
                                        </p>
                                        <p className="text-[10px] text-[#9B8E82] font-light mt-1">
                                            قريباً
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] tracking-[0.2em] uppercase font-bold text-white bg-[#1A1A2E] px-3 py-1">
                                        قريباً
                                    </span>
                                    <CreditCard size={20} strokeWidth={1} className="text-[#1A1A2E]/30" />
                                </div>
                                <Lock size={12} className="absolute top-3 end-3 text-[#9B8E82]/60" />
                            </div>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 text-sm text-[#1A1A2E]">
                        <input type="checkbox" checked={crmConsent}
                            onChange={(e) => setCrmConsent(e.target.checked)}
                            className="mt-1" />
                        <span>أوافق على مشاركة بيانات طلبي مع فريق خدمة العملاء عبر DeskcommCRM للتواصل معي بشأن طلبي بواسطة واتساب. الموافقة اختيارية ولا تمنع إتمام الطلب.</span>
                    </label>
                    <button
                        type="submit"
                        disabled={loading || shippingFee === null || settings?.codEnabled === false}
                        className="group w-full relative flex items-center justify-center bg-[#1A1A2E] text-white text-[10px] md:text-[11px] font-bold tracking-[0.25em] py-5 px-8 uppercase overflow-hidden hover:bg-[#C9A96E] transition-colors duration-500 disabled:opacity-50"
                    >
                        {loading ? "جاري الإرسال..." : "تأكيد الطلب"}
                    </button>
                </form>

                {/* ─── Summary Pane ─────────────────────────────────── */}
                <div className="lg:col-span-5 lg:sticky lg:top-28">
                    <div className="border border-[#C9A96E]/20 bg-[#FDFAF6] p-8 md:p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[3px] bg-[#C9A96E]" />

                        <h2 className="text-[#1A1A2E] font-light text-2xl tracking-wide mb-8 border-b border-[#C9A96E]/10 pb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            ملخص الطلب
                        </h2>

                        <div className="divide-y divide-[#C9A96E]/10 max-h-[300px] overflow-y-auto pr-2">
                            {items.map((item) => (
                                <div key={item.variantId} className="flex justify-between items-center py-4 text-xs">
                                    <div className="text-start pr-4">
                                        <p className="text-[#1A1A2E] font-semibold tracking-wide truncate max-w-[200px]">
                                            {item.nameAr}
                                        </p>
                                        <p className="text-[10px] text-[#9B8E82] uppercase mt-1">
                                            الكمية {item.quantity}
                                        </p>
                                    </div>
                                    <span className="font-medium text-[#1A1A2E] select-all shrink-0">
                                        {(item.price * item.quantity).toFixed(2)} MAD
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-[#C9A96E]/15 mt-6 pt-6 space-y-4">
                            <div className="flex justify-between items-center text-xs text-[#9B8E82] tracking-wide">
                                <span>الشحن</span>
                                <span className="uppercase text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5">
                                    {shippingFee === null ? "تعذر تحميل تكلفة الشحن" : shippingFee === 0 ? "مجاني" : `${shippingFee.toFixed(2)} MAD`}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-[#C9A96E]/10 pt-4">
                                <span className="text-xs uppercase tracking-widest font-semibold text-[#1A1A2E]">المجموع</span>
                                <span className="text-xl font-bold text-[#C9A96E]">
                                    {(orderTotal ?? total()).toFixed(2)} MAD
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[85vh] flex items-center justify-center bg-[#FDFAF6]">
                <p className="text-xs tracking-[0.2em] text-[#C9A96E] uppercase animate-pulse">جاري التحميل...</p>
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
