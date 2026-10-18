import Link from "next/link";
import { publicContent, publicSettings } from "@/lib/server-api";
export async function PolicyPage({ kind }: { kind: "delivery" | "returns" | "privacy" }) {
    const [content, settings] = await Promise.all([publicContent(), publicSettings()]);
    const title = {
        delivery: "التوصيل والدفع",
        returns: "الاستبدال والإرجاع",
        privacy: "بياناتك وخصوصيتك",
    }[kind];
    const published = content.policiesVerified
        ? content[
              { delivery: "deliveryText", returns: "returnsText", privacy: "privacyText" }[kind] as
                  "deliveryText" | "returnsText" | "privacyText"
          ]
        : "";
    return (
        <section className="page-shell max-w-3xl space-y-6">
            <h1 className="text-3xl">{title}</h1>
            {published ? (
                <p className="whitespace-pre-line leading-8">{published}</p>
            ) : kind === "delivery" ? (
                <>
                    <p>
                        رسوم التوصيل الحالية: {settings.shippingCost.toFixed(2)} MAD. الشحن مجاني
                        ابتداءً من {settings.freeShippingMin.toFixed(2)} MAD.
                    </p>
                    <p>
                        تظهر الرسوم والإجمالي في ملخص الطلب قبل التأكيد.{" "}
                        {settings.codEnabled
                            ? "الدفع عند الاستلام متاح."
                            : "الطلب بالدفع عند الاستلام متوقف مؤقتاً."}
                    </p>
                    <p>لمعرفة آجال التوصيل المتاحة لمدينتك، تواصلي مع فريق المتجر قبل الطلب.</p>
                </>
            ) : kind === "returns" ? (
                <p>
                    للحصول على شروط الاستبدال والإرجاع المطبقة على المنتج، تواصلي مع المتجر قبل
                    الشراء، واذكري رقم الطلب عند الاستفسار عن طلب سابق.
                </p>
            ) : (
                <>
                    <p>
                        نطلب الاسم ورقم الهاتف والمدينة وعنوان التوصيل لمعالجة الطلب. لا يطلب هذا
                        الموقع بيانات بطاقة بنكية عند الدفع عند الاستلام.
                    </p>
                    <p>
                        مشاركة بيانات الطلب مع فريق خدمة العملاء عبر DeskcommCRM اختيارية، ويمكن
                        إتمام الطلب دون هذه الموافقة. تحفظ السلة على هذا المتصفح ويمكنك إفراغها في
                        أي وقت.
                    </p>
                    <p>للاستفسار عن استخدام بيانات طلبك أو طلب تصحيحها، تواصلي مع فريق المتجر.</p>
                </>
            )}
            {content.policiesVerified && content.businessAddress && (
                <p>
                    {content.businessName} — {content.businessAddress}
                </p>
            )}
            <Link className="btn-primary" href="/contact">
                تواصل معنا
            </Link>
        </section>
    );
}
