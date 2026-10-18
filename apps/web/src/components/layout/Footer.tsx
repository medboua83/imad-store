import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
export function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-main section-container">
                <div>
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
                </div>
                <nav aria-label="معلومات المتجر">
                    <h2>روابط تهمكِ</h2>
                    {[
                        ["/shop", "اكتشفي المتجر"],
                        ["/delivery", "التوصيل"],
                        ["/returns", "الاستبدال والإرجاع"],
                        ["/privacy", "الخصوصية"],
                    ].map(([href, label]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="footer-help">
                    <h2>نحن هنا لمساعدتكِ.</h2>
                    <p>
                        سؤال عن قطعة أو عن طلبكِ؟
                        <br />
                        تواصلي معنا لتوضيح التفاصيل.
                    </p>
                    <Link href="/contact" className="text-link">
                        تواصل معنا <ArrowUpLeft size={18} aria-hidden="true" />
                    </Link>
                </div>
            </div>
            <div className="footer-bottom section-container">
                <p>© {new Date().getFullYear()} IMAD Mode</p>
                <p>اختاري. راجعي. واطلبي بثقة.</p>
            </div>
        </footer>
    );
}
