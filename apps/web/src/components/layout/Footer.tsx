import Link from "next/link";
import { ArrowUpLeft, PackageCheck, SlidersHorizontal, MessageCircle } from "lucide-react";

const socials = [
    ["https://wa.me/212660560522", "WhatsApp"],
    ["https://www.instagram.com/imad.mode?igsi=em85MTVmanRpa29p", "Instagram"],
    ["https://www.facebook.com/share/1Lwh3Akcuo/", "Facebook"],
    ["https://www.tiktok.com/@imad_mode?_r=1&_t=ZS-99NC3oV9y44", "TikTok"],
];

export function Footer() {
    return (
        <footer className="site-footer refined-footer">
            <div className="footer-service-strip section-container" aria-label="تجربة التسوق">
                <div>
                    <PackageCheck size={22} aria-hidden="true" />
                    <span>
                        الدفع عند الاستلام<small>راجعي المبلغ قبل تأكيد الطلب</small>
                    </span>
                </div>
                <div>
                    <SlidersHorizontal size={22} aria-hidden="true" />
                    <span>
                        اختيارات على مقاسكِ<small>اللون والمقاس والتوفر في كل قطعة</small>
                    </span>
                </div>
                <Link href="/contact">
                    <MessageCircle size={22} aria-hidden="true" />
                    <span>
                        نحن هنا للمساعدة<small>سؤال عن قطعة أو عن طلبكِ؟</small>
                    </span>
                    <ArrowUpLeft size={18} aria-hidden="true" />
                </Link>
            </div>
            <div className="footer-main section-container">
                <div className="footer-brand">
                    <Link
                        href="/"
                        className="brand-wordmark"
                        dir="ltr"
                        aria-label="IMAD Mode — الرئيسية"
                    >
                        IMAD <span>MODE</span>
                    </Link>
                    <p className="footer-tagline">
                        أناقة في الاختيار.
                        <br />
                        بساطة في التفاصيل.
                    </p>
                    <p className="footer-brand-note">
                        قطع تختارينها بطريقتكِ، وتفاصيل واضحة في كل خطوة.
                    </p>
                </div>
                <nav aria-label="اكتشفي المتجر">
                    <h2>اكتشفي IMAD</h2>
                    {[
                        ["/shop", "كل المنتجات"],
                        ["/shop?category=abayas", "العبايات"],
                        ["/shop?category=shawls", "الشيلان"],
                        ["/shop?category=womens-shoes", "الأحذية النسائية"],
                    ].map(([href, label]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <nav aria-label="معلومات المتجر">
                    <h2>معلومات تهمكِ</h2>
                    {[
                        ["/delivery", "التوصيل"],
                        ["/returns", "الاستبدال والإرجاع"],
                        ["/privacy", "الخصوصية"],
                        ["/contact", "تواصل معنا"],
                    ].map(([href, label]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="footer-help">
                    <span className="footer-help-label">لأن التفاصيل تهمّكِ</span>
                    <h2>نساعدكِ على الاختيار.</h2>
                    <p>تواصلي معنا للاستفسار عن المنتجات أو توضيح تفاصيل طلبكِ.</p>
                    <a
                        href={socials[0][0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-contact-button"
                    >
                        تواصلي عبر واتساب <ArrowUpLeft size={18} aria-hidden="true" />
                    </a>
                    <Link href="/contact" className="footer-contact-alternative">
                        طرق التواصل الأخرى
                    </Link>
                </div>
            </div>
            <div className="footer-community section-container">
                <div>
                    <h2>لنكن على تواصل.</h2>
                    <p>تابعينا على مواقع التواصل</p>
                </div>
                <nav className="footer-socials" aria-label="تابعينا على مواقع التواصل">
                    {socials.map(([href, label]) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                        >
                            {label}
                            <ArrowUpLeft size={14} aria-hidden="true" />
                        </a>
                    ))}
                </nav>
            </div>
            <div className="footer-bottom section-container">
                <p dir="ltr">© {new Date().getFullYear()} IMAD Mode</p>
                <p>اختاري. راجعي. واطلبي بثقة.</p>
                <Link href="/privacy">سياسة الخصوصية</Link>
            </div>
        </footer>
    );
}
