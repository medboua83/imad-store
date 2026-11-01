"use client";
import { CheckoutReview } from "@/components/store/CheckoutReview";
import { metaPurchase } from "@/lib/meta-pixel";
import {
    shippingFee,
    priceCart,
    searchShippingCities,
    shippingCityLabel,
    canonicalShippingCity,
    normalizeShippingPhone,
} from "@imad-store/shared";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/cart.store";
import { createOrder } from "@/lib/api";
import { useShipping } from "@/hooks/useShipping";
import { ProductPhoto } from "@/components/store/ProductPhoto";
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
import { CartRecoveryNotice } from "@/components/store/CartRecoveryNotice";
type CheckoutForm = { fullName: string; phone: string; city: string; address: string };
function checkoutFieldError(field: keyof CheckoutForm, value: string): string {
    if (field === "fullName") return value.trim().length < 3 ? "أدخلوا الاسم الكامل" : "";
    if (field === "phone") return normalizeShippingPhone(value) ? "" : "أدخلوا رقم هاتف مغربي صالحاً";
    if (field === "city") return canonicalShippingCity(value) ? "" : "اختاروا مدينة التوصيل من القائمة";
    return value.trim().length < 5 || value.trim().length > 124
        ? "أدخلوا العنوان الكامل بين 5 و124 حرفاً"
        : "";
}
export default function CheckoutPage() {
    const { items, total, clearCart, refreshCart } = useCartStore();
    const shipping = useShipping(total(), items);
    const [form, setForm] = useState<CheckoutForm>({ fullName: "", phone: "", city: "", address: "" });
    const validationAttempted = useRef(false);
    const [citySearch, setCitySearch] = useState("");
    const matchingCities = searchShippingCities(citySearch);
    const visibleCities =
        form.city && !matchingCities.includes(form.city)
            ? [form.city, ...matchingCities]
            : matchingCities;
    const [fields, setFields] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const submissionError = useRef<HTMLParagraphElement>(null);
    const [submissionErrorVersion, setSubmissionErrorVersion] = useState(0);
    useEffect(() => {
        if (submissionErrorVersion > 0) submissionError.current?.focus();
    }, [submissionErrorVersion]);
    function announceSubmissionError(message: string) {
        setError(message);
        setSubmissionErrorVersion(version => version + 1);
    }
    const [busy, setBusy] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 768px)");
        const update = () => setSummaryOpen(desktop.matches);
        update();
        desktop.addEventListener("change", update);
        return () => desktop.removeEventListener("change", update);
    }, []);
    const [orderId, setOrderId] = useState("");
    const key = useRef("");
    const submissionLock = useRef(false);
    const [review, setReview] = useState<string | null>(null);
    const [confirmedOnSite, setConfirmedOnSite] = useState(false);
    const direct = shipping.settings?.directSiteConfirmation === true;
    function reviewSignature(cart = items, amount = shipping.total) {
        return JSON.stringify({
            customer: form,
            amount,
            items: cart.map((i) => [i.productId, i.variantId, i.price, i.quantity]),
        });
    }
    const reviewReady = direct && review !== null && review === reviewSignature();
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        let active = true;
        let checked = false;
        const check = () => {
            if (!active || checked) return;
            checked = true;
            refreshCart()
                .then((changed) => {
                    if (active && changed) setError("تم تحديث تفاصيل المنتجات أو الأسعار أو الكميات. راجعوا ملخص الطلب.");
                })
                .catch(() => {
                    if (active) setError("تعذر تحديث السلة. اضغطوا تأكيد الطلب لإعادة التحقق.");
                });
        };
        // The provider restores persisted items after child effects. Checking the
        // empty server snapshot would otherwise skip the saved basket entirely.
        const unsubscribe = useCartStore.persist.onFinishHydration(check);
        if (useCartStore.persist.hasHydrated()) check();
        return () => { active = false; unsubscribe(); };
    }, [refreshCart]);
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (submissionLock.current) return;
        validationAttempted.current = true;
        const errors: Record<string, string> = {};
        for (const field of Object.keys(form) as (keyof CheckoutForm)[]) {
            const message = checkoutFieldError(field, form[field]);
            if (message) errors[field] = message;
        }
        setFields(errors);
        if (Object.keys(errors).length) {
            requestAnimationFrame(() =>
                document.getElementById(`checkout-${Object.keys(errors)[0]}`)?.focus(),
            );
            return;
        }
        submissionLock.current = true;
        setBusy(true);
        setError("");
        try {
            const changed = await refreshCart();
            const freshSettings = (await shipping.retry({ throwOnError: true })).data;
            if (changed) {
                setReview(null);
                announceSubmissionError("تغيرت تفاصيل المنتجات أو السعر أو التوفر. راجعوا ملخص الطلب ثم أكدوا مجدداً.");
                return;
            }
            const cart = useCartStore.getState().items;
            if (!cart.length || cart.some((i) => i.quantity < 1 || i.quantity > i.stock)) {
                announceSubmissionError("احذفوا المنتجات غير المتوفرة من السلة قبل المتابعة.");
                return;
            }
            if (!freshSettings) throw new Error("Shipping settings unavailable");
            if ((freshSettings.directSiteConfirmation === true) !== direct) {
                setReview(null);
                announceSubmissionError("تغيرت طريقة تأكيد الطلب. راجعوا المعلومات ثم تابعوا مجدداً.");
                return;
            }
            const subtotal = priceCart(cart).subtotal;
            const confirmedTotal = subtotal + shippingFee(subtotal, cart, freshSettings);
            if (shipping.total === null || Math.abs(confirmedTotal - shipping.total) > 0.005) {
                announceSubmissionError("تغيرت رسوم التوصيل. راجعوا الإجمالي الجديد ثم أكدوا مجدداً.");
                return;
            }
            if (direct && review !== reviewSignature(cart, confirmedTotal)) {
                setReview(reviewSignature(cart, confirmedTotal));
                requestAnimationFrame(() =>
                    document.getElementById("checkout-final-review")?.focus(),
                );
                return;
            }
            const activeKey = key.current || crypto.randomUUID();
            key.current = activeKey;
            const order = await createOrder(
                {
                    paymentMethod: "COD",
                    ...(direct ? { confirmationMode: "SITE" as const } : {}),
                    aiServiceConsent: false,
                    expectedTotal: confirmedTotal,
                    customer: {
                        fullName: form.fullName.trim(),
                        phone: form.phone.replace(/[\s().-]/g, ""),
                        city: canonicalShippingCity(form.city)!,
                        region: canonicalShippingCity(form.city)!,
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
            metaPurchase(order.id, order.totalAmount);
            if (!order.id) throw new Error("Order receipt unavailable");
            setOrderId(order.id);
            setConfirmedOnSite(order.confirmationMethod === "SITE");
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
            announceSubmissionError(
                response?.data?.error ||
                    "تعذر الاتصال. بياناتكم محفوظة هنا، ويمكنكم المحاولة مجدداً.",
            );
        } finally {
            submissionLock.current = false;
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
            maxLength: field === "address" ? 124 : 120,
            value: form[field],
            "aria-invalid": !!fields[field],
            "aria-describedby": describedBy,
            placeholder: placeholders[field],
            onChange: (
                event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
            ) => {
                const value = event.target.value;
                setReview(null);
                setForm((old) => ({ ...old, [field]: value }));
                if (validationAttempted.current) {
                    const message = checkoutFieldError(field, value);
                    setFields((old) => {
                        if ((old[field] || "") === message) return old;
                        const next = { ...old };
                        if (message) next[field] = message;
                        else delete next[field];
                        return next;
                    });
                }
            },
        };
        return (
            <div
                className={`checkout-field ${field === "address" ? "checkout-field-wide" : ""}`}
                key={field}
            >
                <label htmlFor={`checkout-${field}`}>
                    {labels[field]} <span aria-hidden="true">*</span>
                </label>
                {field === "city" ? (
                    <>
                        <label className="city-search-label" htmlFor="checkout-city-search">
                            بحث سريع عن مدينة
                        </label>
                        <input
                            id="checkout-city-search"
                            type="search"
                            className="store-input"
                            value={citySearch}
                            maxLength={80}
                            disabled={busy}
                            autoComplete="off"
                            placeholder="مثال: طنجة أو Tanger"
                            aria-controls="checkout-city"
                            aria-describedby="city-search-results"
                            onChange={(e) => setCitySearch(e.target.value)}
                        />
                        <select
                            id={common.id}
                            name={common.name}
                            className={common.className}
                            autoComplete={common.autoComplete}
                            required
                            disabled={common.disabled}
                            value={common.value}
                            onChange={common.onChange}
                            aria-invalid={common["aria-invalid"]}
                            aria-describedby={common["aria-describedby"]}
                        >
                            <option value="">اختاروا مدينة التوصيل</option>
                            {visibleCities.map((city) => (
                                <option key={city} value={city}>
                                    {shippingCityLabel(city)}
                                    {citySearch &&
                                    city === form.city &&
                                    !matchingCities.includes(city)
                                        ? " — اختياركم الحالي"
                                        : ""}
                                </option>
                            ))}
                        </select>
                        <p id="city-search-results" className="checkout-hint" role="status">
                            {citySearch
                                ? matchingCities.length
                                    ? `${matchingCities.length} نتيجة. اختاروا مدينتكم من القائمة.`
                                    : "لا توجد نتيجة. غيّروا البحث أو امسحوه لعرض كل المدن."
                                : "يمكنكم البحث بالعربية أو الفرنسية ثم اختيار المدينة من القائمة."}
                        </p>
                    </>
                ) : field === "address" ? (
                    <textarea {...common} rows={3} minLength={5} />
                ) : (
                    <input
                        {...common}
                        minLength={field === "fullName" ? 3 : undefined}
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
                {field === "address" && (
                    <p className="checkout-hint">
                        الحي، الشارع ورقم المنزل أو الشقة — 124 حرفاً كحد أقصى.
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
                <h1>وصلنا طلبكم، شكراً لكم.</h1>
                <p>
                    رقم الطلب <strong dir="ltr">{orderId.slice(-8).toUpperCase()}</strong>
                </p>
                <p>
                    {confirmedOnSite
                        ? "تم تأكيد طلبكم مباشرة على الموقع. لا يلزم تأكيد إضافي عبر واتساب."
                        : "سيتواصل معكم فريقنا لتأكيد التفاصيل."}
                </p>
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
                    <h1>طلبكم، بكل وضوح.</h1>
                    <p>راجعوا اختياراتكم وأضيفوا عنوانكم. لا حاجة لإنشاء حساب.</p>
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
            <CartRecoveryNotice />
            {!items.length ? (
                <div className="checkout-empty">
                    <ShoppingBag size={38} aria-hidden="true" />
                    <h2>حقيبتكم تنتظر اختياراتكم.</h2>
                    <p>أضيفوا منتجاً من المتجر قبل إتمام الطلب.</p>
                    <Link className="btn-primary" href="/shop">
                        اكتشفوا المجموعة <ArrowLeft size={18} aria-hidden="true" />
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
                        {error && (
                            <p ref={submissionError} role="alert" tabIndex={-1} className="checkout-alert checkout-submission-error">
                                {error}
                            </p>
                        )}
                        {invalidItems && (
                            <p role="alert" className="checkout-alert">
                                احذفوا المنتجات غير المتوفرة من ملخص الطلب للمتابعة.{" "}
                                <button type="button" className="text-link" disabled={busy}
                                    onClick={() => useCartStore.getState().openCart()}>
                                    مراجعة الحقيبة
                                </button>
                            </p>
                        )}
                        <fieldset className="checkout-field-section" disabled={busy}>
                            <legend>
                                <span>01</span>لنتواصل بشأن طلبكم
                            </legend>
                            <p className="checkout-section-note">
                                {direct
                                    ? "نستخدم هذه المعلومات لمعالجة الطلب والتوصيل."
                                    : "نستخدم هذه المعلومات لتأكيد الطلب وتوضيح تفاصيله."}
                            </p>
                            <div className="checkout-fields">
                                {field("fullName")}
                                {field("phone")}
                            </div>
                        </fieldset>
                        <fieldset className="checkout-field-section" disabled={busy}>
                            <legend>
                                <span>02</span>أين نرسل طلبكم؟
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
                                <p>راجعوا المبلغ الكامل قبل تأكيد الطلب.</p>
                            </div>
                        </div>
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
                        <p className="checkout-policy">
                            قبل التأكيد، اطلعوا على <Link href="/delivery">التوصيل</Link> و
                            <Link href="/returns">الاستبدال والإرجاع</Link> و
                            <Link href="/privacy">الخصوصية</Link>.
                        </p>
                        {reviewReady && (
                            <CheckoutReview
                                customer={form}
                                items={items}
                                subtotal={total()}
                                shipping={shipping}
                                onEdit={() => {
                                    setReview(null);
                                    document.getElementById("checkout-fullName")?.focus();
                                }}
                            />
                        )}
                        <div className="checkout-submit-bar">
                            <p>
                                <span>المبلغ عند الاستلام</span>
                                <strong dir="ltr">
                                    {invalidItems || shipping.error || shipping.total === null
                                        ? "—"
                                        : shipping.total.toFixed(2)}{" "}
                                    <small>MAD</small>
                                </strong>
                            </p>
                            <button type="submit" className="btn-primary" disabled={blocked}>
                                {busy
                                    ? "جارٍ التحقق والحفظ…"
                                    : direct
                                      ? reviewReady
                                          ? "أؤكد طلبي"
                                          : "مراجعة الطلب"
                                      : "تأكيد الطلب"}
                                <ArrowLeft size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <p className="checkout-submit-note">
                            ستظهر لكم رسالة التأكيد بعد تسجيل الطلب بنجاح.
                        </p>
                    </form>
                    <aside className="checkout-summary checkout-review" aria-label="ملخص الطلب">
                        <details className="checkout-order-disclosure" open={summaryOpen}
                            onToggle={event => setSummaryOpen(event.currentTarget.open)}>
                            <summary aria-label="عرض أو إخفاء ملخص الطلب">
                                <ShoppingBag size={20} aria-hidden="true" />
                                <span className="checkout-summary-label">
                                    <strong>ملخص طلبكم <small>{count} قطعة</small></strong>
                                    <small>{summaryOpen ? "إخفاء التفاصيل" : "عرض المنتجات والتوصيل"}</small>
                                </span>
                                <span className="checkout-compact-total" aria-live="polite">
                                    {invalidItems ? "راجعوا الحقيبة" : shipping.loading ? "جارٍ الحساب…" : shipping.error || shipping.total === null
                                        ? "بانتظار رسوم التوصيل"
                                        : <bdi>{shipping.total.toFixed(2)} <small>MAD</small></bdi>}
                                    <small>شامل التوصيل</small>
                                </span>
                                <ChevronDown size={18} aria-hidden="true" />
                            </summary>
                            <div className="checkout-summary-content">
                                <details className="checkout-item-disclosure">
                                    <summary>
                                        <span className="checkout-mini-photo">
                                            {items[0] && (
                                                <ProductPhoto
                                                    images={items[0].images ?? [items[0].image]}
                                                    name=""
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
                                <CartTotals subtotal={total()} shipping={shipping} needsReview={invalidItems} />
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
                            </div>
                        </details>
                    </aside>
                </div>
            )}
        </section>
    );
}
