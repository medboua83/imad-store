import Link from "next/link";
export function ShoppingQuestions() {
    return (
        <section
            id="questions"
            className="shopping-questions"
            aria-labelledby="shopping-questions-title"
        >
            <h2 id="shopping-questions-title">أسئلة قبل الطلب</h2>
            <details>
                <summary>كيف تختارون المقاس واللون؟</summary>
                <p>
                    كل خيار في صفحة المنتج يحدد مقاساً ولوناً. الخيارات غير المتوفرة مشطوبة. إذا كان
                    الاختيار بين مقاسين، اطلبوا قياسات الموديل من فريقنا قبل التأكيد.
                </p>
            </details>
            <details>
                <summary>كيف تعرفون رسوم التوصيل؟</summary>
                <p>
                    تظهر الرسوم والإجمالي في السلة وملخص الطلب، حسب المنتجات وقواعد المتجر الحالية.{" "}
                    <Link href="/delivery">راجعوا معلومات التوصيل</Link> وتأكدوا من المدة المتاحة
                    لمدينتكم.
                </p>
            </details>
            <details>
                <summary>هل يلزم إنشاء حساب؟</summary>
                <p>
                    يمكنكم الطلب دون حساب. اختاروا المنتج ثم أضيفوا الاسم والهاتف والمدينة والعنوان،
                    وراجعوا المقاس واللون والكمية والإجمالي قبل التأكيد.
                </p>
            </details>
            <details>
                <summary>كيف تتابعون طلباً أو تطلبون استبدالاً؟</summary>
                <p>
                    احتفظوا برقم الطلب الظاهر بعد التأكيد واذكروه عند التواصل مع الفريق.{" "}
                    <Link href="/returns">راجعوا شروط الاستبدال والإرجاع</Link> قبل الشراء، واطلبوا
                    توضيح أي معلومة ناقصة.
                </p>
            </details>
        </section>
    );
}
