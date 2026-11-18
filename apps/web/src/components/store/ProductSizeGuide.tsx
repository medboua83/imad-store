import Link from "next/link";
import type { Product } from "@/lib/api";
import { measurementKeys, publicProductInformation } from "@imad-store/shared";
import { orderedSizes, sizeKey, sizeLabel } from "@/lib/product-presentation";
const labels = { chest: "محيط الصدر", waist: "محيط الخصر", hips: "محيط الورك", length: "الطول", footLength: "طول القدم" };
export function ProductSizeGuide({ product, selectedSize }: { product: Product; selectedSize?: string | null }) {
    const guide = publicProductInformation(product.productInformation)?.sizeGuide;
    const footwear = guide ? guide.basis === "FOOT" : /shoes|clogs/.test(product.category.slug);
    const sizes = orderedSizes(product.variants);
    const columns = measurementKeys.filter(key => guide?.rows.some(row => row[key] !== undefined));
    return <details className="size-advice product-size-guide">
        <summary>كيف تختارون المقاس المناسب؟</summary>
        <h3>دليل قياسات هذا الموديل</h3>
        <p>{product.nameAr || product.nameFr}</p>
        {guide ? <>
            <p>{guide.basis === "BODY" ? "الجدول يوضح قياسات الجسم، بالسنتيمتر (cm)." : guide.basis === "FOOT" ? "الجدول يربط المقاس بطول القدم بالسنتيمتر (cm)، حسب قياسات هذا الموديل." : "الجدول يوضح قياسات القطعة نفسها بالسنتيمتر (cm)، وليس قياسات الجسم. قارنوا بقطعة مناسبة لكم."}</p>
            {/* The overflow region needs focus so keyboard users can scroll the table. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="size-table-scroll" role="region" aria-label="جدول قياسات المنتج" tabIndex={0}>
                <table><caption>قياسات زوّد بها المتجر لهذا الموديل · cm</caption><thead><tr><th scope="col">المقاس</th>{columns.map(key => <th key={key} scope="col">{key === "length" ? guide.basis === "BODY" ? "القامة" : "طول القطعة" : labels[key]}</th>)}</tr></thead>
                    <tbody>{guide.rows.map(row => <tr key={row.size} className={selectedSize && sizeKey(selectedSize) === sizeKey(row.size) ? "size-measurement-selected" : undefined}><th scope="row"><bdi>{sizeLabel(row.size)}</bdi></th>{columns.map(key => <td key={key}><bdi>{row[key] === undefined ? "—" : row[key]}</bdi></td>)}</tr>)}</tbody>
                </table>
            </div>
            <p>« — » تعني أن هذا القياس غير محدد. الجدول للمقارنة ولا يختار المقاس أو يضيف المنتج إلى السلة.</p>
        </> : <p className="size-guide-unavailable">قياسات هذا الموديل بالسنتيمتر غير متوفرة حالياً. لا نعتمد جدولاً عاماً لتحويل المقاسات؛ اطلبوا القياسات قبل تأكيد الطلب.</p>}
        <h4>كيف تأخذون القياسات؟</h4>
        {footwear ? <ol><li>ضعوا القدم على ورقة وأنتم واقفون، وحددوا الكعب وأطول إصبع.</li><li>قيسوا طول القدم من الكعب إلى أطول إصبع بالسنتيمتر للقدمين واعتمدوا الأطول.</li><li>قارنوا بطول القدم في جدول هذا الموديل. رقم المقاس وحده لا يحدد الطول بالسنتيمتر.</li></ol> : <ol><li>لقياسات الجسم، استخدموا شريطاً مرناً حول أوسع الصدر والورك وحول الخصر، دون شده.</li><li>لقياسات القطعة، قارنوا بقطعة مناسبة لكم. محيط الصدر والخصر والورك هو المحيط الكامل؛ عند القياس مسطحاً يُضاعف العرض.</li><li>تأكدوا هل الجدول للجسم أم القطعة: القامة هي طول الجسم واقفاً؛ لطول القطعة حددوا نقطة البداية والنهاية مع المتجر، مثل أعلى الكتف إلى الحافة.</li></ol>}
        {sizes.some(size => ["unique", "one size", "taille unique", "standard", ""].includes(sizeKey(size))) && <p>المقاس الموحد أو القياسي لا يعني أنه يناسب الجميع؛ راجعوا القياسات الفعلية.</p>}
        <p>اختاروا اللون ثم المقاس من الخيارات أعلاه؛ التوفر يتغير حسب اللون. بين مقاسين؟ اطلبوا مساعدة خاصة بهذا الموديل.</p>
        <Link href="/contact">مساعدة في اختيار المقاس</Link>
    </details>;
}
