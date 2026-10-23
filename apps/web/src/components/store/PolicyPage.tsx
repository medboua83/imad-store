import Link from "next/link";
import { publicContent, publicSettings } from "@/lib/server-api";
export async function PolicyPage({ kind }: { kind: "delivery" | "returns" | "privacy" }) {
    const [content, settings] = await Promise.all([publicContent(), publicSettings()]);
    const title = {
        delivery: "التوصيل والدفع",
        returns: "الاستبدال والإرجاع",
        privacy: "بياناتكم وخصوصيتكم",
    }[kind];
    const published = content.policiesVerified
        ? content[
              { delivery: "deliveryText", returns: "returnsText", privacy: "privacyText" }[kind] as
                  "deliveryText" | "returnsText" | "privacyText"
          ]
        : "";
    return (
        <section className="page-shell policy-page max-w-3xl space-y-6">
            <h1 className="text-3xl">{title}</h1>
            {kind === "delivery" && <div className="policy-facts">
                <div><h2>رسوم التوصيل</h2><p dir="ltr">{settings.shippingCost.toFixed(2)} MAD</p></div>
                <div><h2>التوصيل المجاني</h2><p>من <bdi>{settings.freeShippingMin.toFixed(2)} MAD</bdi> أو مع منتج مؤهل</p></div>
                <div><h2>الدفع</h2><p>{settings.codEnabled ? "عند الاستلام" : "تواصلوا معنا لمعرفة المتاح"}</p></div>
            </div>}
            {published ? (
                <p className="whitespace-pre-line leading-8">{published}</p>
            ) : kind === "delivery" ? (
                <>
                    <h2>قبل تأكيد الطلب</h2>
                    <p>
                        تظهر الرسوم والإجمالي في ملخص الطلب قبل التأكيد.{" "}
                        {settings.codEnabled
                            ? "الدفع عند الاستلام متاح."
                            : "الطلب بالدفع عند الاستلام متوقف مؤقتاً."}
                    </p>
                    <h2>موعد التوصيل</h2>
                    <p>لم يُنشر أجل توصيل محدد بعد. تواصلوا مع فريق المتجر لتأكيد المدة المتاحة لمدينتكم قبل الطلب.</p>
                </>
            ) : kind === "returns" ? (
                <>
                    <h2>شروط يجب معرفتها قبل الشراء</h2>
                    <p>لم تُنشر بعد مدة طلب الاستبدال أو الإرجاع، وحالة المنتج المطلوبة، ورسوم إعادة الشحن وطريقة معالجة المبلغ. تواصلوا معنا لتوضيح هذه المعلومات قبل تأكيد الطلب.</p>
                    <h2>التواصل بخصوص طلبكم</h2>
                    <ol className="policy-steps">
                        <li>اذكروا رقم الطلب والمنتج والمقاس أو اللون المعني.</li>
                        <li>وضحوا سبب طلب الاستبدال أو الإرجاع، وأرفقوا صورة إذا كانت تساعد على توضيح المشكلة.</li>
                        <li>اطلبوا من الفريق توضيح الخطوات والعنوان والرسوم المطبقة قبل إرسال المنتج.</li>
                    </ol>
                </>
            ) : (
                <>
                    <p>
                        نطلب الاسم ورقم الهاتف والمدينة وعنوان التوصيل لمعالجة الطلب. لا يطلب هذا
                        الموقع بيانات بطاقة بنكية عند الدفع عند الاستلام.
                    </p>
                    <p>تحفظ السلة على هذا المتصفح ويمكنكم إفراغها في أي وقت.</p>
                    <p>للاستفسار عن استخدام بيانات طلبكم أو طلب تصحيحها، تواصلوا مع فريق المتجر.</p>
                </>
            )}
            {kind === "privacy" && (
                <p>
                    قد يستخدم المتجر خدمة DeskcommCRM لإدارة الطلبات وخدمة العملاء عند تفعيل الربط
                    من إدارة المتجر. تُشارك بيانات التواصل وتفاصيل الطلب اللازمة لهذا الغرض. لا يُعد
                    ذلك موافقة على الرسائل التسويقية. للاستفسار عن بياناتكم أو طلب تصحيحها، تواصلوا مع
                    المتجر.
                </p>
            )}
            {kind === "privacy" && (
                <div className="space-y-3 leading-8">
                    <h2 className="text-xl">إحصاءات استخدام المتجر</h2>
                    <p>
                        نقيس الزيارات والمنتجات التي تمت مشاهدتها ونسبة الزيارات التي أدت إلى إنشاء
                        طلب. نستخدم معرّفاً عشوائياً مؤقتاً في تبويب المتصفح لمدة 30 دقيقة، دون
                        ملفات تعريف ارتباط للتتبع أو بصمة للمتصفح. لا تتضمن الإحصاءات الاسم أو
                        الهاتف أو عنوان IP أو بيانات الطلب الشخصية، وتبقى منفصلة لكل متجر. تُحذف
                        سجلات القياس تلقائياً بعد 91 يوماً. نحترم إعدادات عدم التتبع وحماية الخصوصية
                        في المتصفح.
                    </p>
                </div>
            )}
            {kind === "privacy" && settings.metaPixelEnabled && (
                <p>
                    يعمل Meta Pixel تلقائياً ما لم يتم إيقافه، وقد يرسل الصفحات والمنتجات التي
                    تزورونها، وبدء الطلب وقيمته عند إنشائه، إلى Meta لقياس الحملات. يمكنكم رفض ذلك
                    أو تغيير اختياركم من أسفل الصفحة. لا نضيف اسمكم أو هاتفكم أو عنوانكم إلى هذه
                    الأحداث.
                </p>
            )}
            {kind === "delivery" && (
                <p>
                    يصبح توصيل السلة مجانياً عند احتوائها على منتج يحمل علامة التوصيل المجاني، أو
                    بلوغ الحد الموضح، بعد احتساب التخفيضات.
                </p>
            )}
            {content.policiesVerified && content.businessAddress && (
                <p>
                    {content.businessName} — {content.businessAddress}
                </p>
            )}
            <Link className="btn-primary" href="/contact">
                تواصلوا معنا
            </Link>
        </section>
    );
}
