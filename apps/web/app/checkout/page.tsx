"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";
import { useCartStore } from "@/store/cart.store";
import { createOrder } from "@/lib/api";
import { useShipping } from "@/hooks/useShipping";
import Image from "next/image";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronDown,
    PackageCheck,
    ShoppingBag,
    Truck,
} from "lucide-react";
import { CartLine } from "@/components/store/CartLine";
import { CartTotals } from "@/components/store/CartTotals";
export default function CheckoutPage() {
    const { items, total, clearCart, refreshCart } = useCartStore();
    const shipping = useShipping(total());
    const [form, setForm] = useState({ fullName: "", phone: "", city: "", address: "" });
    const [whatsappAssistance, setWhatsappAssistance] = useState(false);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [orderId, setOrderId] = useState("");
    const [key, setKey] = useState("");
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
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
        if (whatsappAssistance && !/^\+212[5-7]\d{8}$/.test(form.phone.replace(/[\s()-]/g, "")))
            errors.phone = "للمساعدة عبر واتساب، أدخلي الرقم الدولي بنفسكِ: +212…";
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
                    aiServiceConsent: whatsappAssistance,
                    ...(whatsappAssistance
                        ? { aiServiceConsentVersion: ORDER_WHATSAPP_NOTICE_VERSION }
                        : {}),
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
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const invalidItems = items.some(
        (item) => item.quantity < 1 || item.quantity > item.stock || !item.stock,
    );
    const blocked =
        busy ||
        shipping.loading ||
        shipping.error ||
        shipping.total === null ||
        shipping.settings?.codEnabled === false ||
        invalidItems;
    const labels = {
        fullName: "الاسم الكامل",
        phone: "رقم الهاتف",
        city: "المدينة",
        address: "عنوان التوصيل",
    };
    const placeholders = {
        fullName: "الاسم والنسب",
        phone: "06XXXXXXXX",
        city: "مثال: الدار البيضاء",
        address: "الحي، الشارع، رقم المنزل أو الشقة…",
    };
    const autocomplete = {
        fullName: "name",
        phone: "tel",
        city: "address-level2",
        address: "street-address",
    };
    function field(field: keyof typeof form) {
        const describedBy =
            [field === "phone" ? "phone-hint" : "", fields[field] ? `${field}-error` : ""]
                .filter(Boolean)
                .join(" ") || undefined;
        const common = {
            className: "store-input",
            id: `checkout-${field}`,
            name: field,
            autoComplete: autocomplete[field],
            required: true,
            disabled: busy,
            maxLength: field === "address" ? 500 : 120,
            value: form[field],
            "aria-invalid": !!fields[field],
            "aria-describedby": describedBy,
            placeholder: placeholders[field],
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setForm((old) => ({ ...old, [field]: event.target.value })),
        };
        return (
            <div
                className={`checkout-field ${field === "address" ? "checkout-field-wide" : ""}`}
                key={field}
            >
                <label htmlFor={`checkout-${field}`}>
                    {labels[field]} <span aria-hidden="true">*</span>
                </label>
                {field === "address" ? (
                    <textarea {...common} rows={3} />
                ) : (
                    <input
                        {...common}
                        type={field === "phone" ? "tel" : "text"}
                        inputMode={field === "phone" ? "tel" : undefined}
                        dir={field === "phone" ? "ltr" : undefined}
                    />
                )}
                {field === "phone" && (
                    <p className="checkout-hint" id="phone-hint">
                        رقم مغربي يبدأ بـ 05 أو 06 أو 07، أو برمز +212.
                    </p>
                )}
                {fields[field] && (
                    <p id={`${field}-error`} className="checkout-field-error">
                        {fields[field]}
                    </p>
                )}
            </div>
        );
    }
    if (orderId)
        return (
            <section className="page-shell checkout-success" role="status">
                <span className="checkout-success-icon">
                    <CheckCircle2 size={38} aria-hidden="true" />
                </span>
                <p className="eyebrow">IMAD MODE</p>
                <h1>وصلنا طلبكِ، شكراً لكِ.</h1>
                <p>
                    رقم الطلب <strong dir="ltr">{orderId.slice(-8).toUpperCase()}</strong>
                </p>
                <p>سيتواصل معكم فريقنا لتأكيد التفاصيل.</p>
                <Link href="/shop" className="btn-primary">
                    العودة إلى المتجر <ArrowLeft size={18} aria-hidden="true" />
                </Link>
            </section>
        );
    return (
        <section className="page-shell checkout-page checkout-workspace">
            <Link href="/shop" className="checkout-back">
                <ArrowRight size={16} aria-hidden="true" />
                العودة إلى المتجر
            </Link>
            <div className="checkout-heading">
                <div>
                    <p className="eyebrow">IMAD · الخطوة الأخيرة</p>
                    <h1>طلبكِ، بكل وضوح.</h1>
                    <p>راجعي اختياراتكِ وأضيفي عنوانكِ. لا حاجة لإنشاء حساب.</p>
                </div>
                <span className="checkout-cod-badge">
                    <PackageCheck size={20} aria-hidden="true" />
                    الدفع عند الاستلام
                </span>
            </div>
            {!!items.length && (
                <ol className="checkout-steps" aria-label="خطوات الطلب">
                    <li>
                        <Check size={16} aria-hidden="true" />
                        الحقيبة
                    </li>
                    <li aria-current="step">
                        <span>2</span>التفاصيل والتأكيد
                    </li>
                </ol>
            )}
            {!items.length ? (
                <div className="checkout-empty">
                    <ShoppingBag size={38} aria-hidden="true" />
                    <h2>حقيبتكِ تنتظر اختياراتكِ.</h2>
                    <p>أضيفي منتجاً من المتجر قبل إتمام الطلب.</p>
                    <Link className="btn-primary" href="/shop">
                        اكتشفي المجموعة <ArrowLeft size={18} aria-hidden="true" />
                    </Link>
                </div>
            ) : (
                <div className="checkout-layout">
                    <form
                        onSubmit={submit}
                        noValidate
                        className="checkout-form checkout-details-form"
                        aria-busy={busy}
                    >
                        <fieldset className="checkout-field-section" disabled={busy}>
                            <legend>
                                <span>01</span>لنتواصل بشأن طلبكِ
                            </legend>
                            <p className="checkout-section-note">
                                نستخدم هذه المعلومات لتأكيد الطلب وتوضيح تفاصيله.
                            </p>
                            <div className="checkout-fields">
                                {field("fullName")}
                                {field("phone")}
                            </div>
                        </fieldset>
                        <fieldset className="checkout-field-section" disabled={busy}>
                            <legend>
                                <span>02</span>أين نرسل طلبكِ؟
                            </legend>
                            <div className="checkout-fields">
                                {field("city")}
                                {field("address")}
                            </div>
                        </fieldset>
                        <div className="checkout-payment">
                            <span className="checkout-payment-check">
                                <Check size={17} aria-hidden="true" />
                            </span>
                            <PackageCheck size={24} aria-hidden="true" />
                            <div>
                                <h2>الدفع عند الاستلام</h2>
                                <p>راجعي المبلغ الكامل قبل تأكيد الطلب.</p>
                            </div>
                        </div>
                        {error && (
                            <p role="alert" className="checkout-alert">
                                {error}
                            </p>
                        )}
                        {shipping.error && (
                            <p role="alert" className="checkout-alert">
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
                        {shipping.settings?.codEnabled === false && (
                            <p role="alert" className="checkout-alert">
                                الطلب بالدفع عند الاستلام متوقف مؤقتاً.
                            </p>
                        )}
                        {invalidItems && (
                            <p role="alert" className="checkout-alert">
                                احذفي المنتجات غير المتوفرة من ملخص الطلب للمتابعة.
                            </p>
                        )}
                        {shipping.settings?.whatsappAssistanceAvailable && (
                            <label className="checkout-policy flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={whatsappAssistance}
                                    onChange={(e) => setWhatsappAssistance(e.target.checked)}
                                    aria-describedby="whatsapp-assistance-details"
                                />
                                <span id="whatsapp-assistance-details">
                                    أرغب في أن تتواصل معي المساعدة الآلية للمتجر عبر واتساب لتأكيد
                                    هذه الطلبية وتوضيح تفاصيلها. يمكنني طلب التحدث إلى الفريق أو
                                    إيقاف المساعدة. هذا الاختيار اختياري ولا يخص الرسائل الإعلانية.
                                </span>
                            </label>
                        )}
                        <p className="checkout-policy">
                            قبل التأكيد، اطلعي على <Link href="/delivery">التوصيل</Link> و
                            <Link href="/returns">الاستبدال والإرجاع</Link> و
                            <Link href="/privacy">الخصوصية</Link>.
                        </p>
                        <div className="checkout-submit-bar">
                            <p>
                                <span>المبلغ عند الاستلام</span>
                                <strong dir="ltr">
                                    {shipping.error || shipping.total === null
                                        ? "—"
                                        : shipping.total.toFixed(2)}{" "}
                                    <small>MAD</small>
                                </strong>
                            </p>
                            <button type="submit" className="btn-primary" disabled={blocked}>
                                {busy ? "جارٍ التحقق والحفظ…" : "تأكيد الطلب"}
                                <ArrowLeft size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <p className="checkout-submit-note">
                            ستظهر لكِ رسالة التأكيد بعد تسجيل الطلب بنجاح.
                        </p>
                    </form>
                    <aside className="checkout-summary checkout-review" aria-label="ملخص الطلب">
                        <div className="checkout-summary-title">
                            <ShoppingBag size={20} aria-hidden="true" />
                            <h2>ملخص طلبكِ</h2>
                            <span>{count} قطعة</span>
                        </div>
                        <details className="checkout-item-disclosure">
                            <summary>
                                <span className="checkout-mini-photo">
                                    {items[0]?.image && (
                                        <Image
                                            src={items[0].image}
                                            alt=""
                                            fill
                                            sizes="52px"
                                            className="object-contain"
                                        />
                                    )}
                                </span>
                                <span>
                                    <strong>
                                        {items[0]?.nameAr || items[0]?.nameFr}
                                        {items.length > 1 ? ` + ${items.length - 1}` : ""}
                                    </strong>
                                    <small>عرض وتعديل المنتجات</small>
                                </span>
                                <ChevronDown size={18} aria-hidden="true" />
                            </summary>
                            <div>
                                {items.map((item) => (
                                    <CartLine key={item.variantId} item={item} disabled={busy} />
                                ))}
                            </div>
                        </details>
                        <CartTotals subtotal={total()} shipping={shipping} />
                        <p className="checkout-summary-note">
                            <Truck size={18} aria-hidden="true" />
                            رسوم التوصيل ضمن الإجمالي أعلاه.
                        </p>
                        <button
                            type="button"
                            className="checkout-edit-bag"
                            disabled={busy}
                            onClick={() => useCartStore.getState().openCart()}
                        >
                            فتح الحقيبة
                        </button>
                    </aside>
                </div>
            )}
        </section>
    );
}
