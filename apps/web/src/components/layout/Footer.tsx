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
                    <nav className="footer-socials" aria-label="تابعينا على مواقع التواصل">
                        {[
                            ["https://wa.me/212660560522", "WhatsApp"],
                            ["https://www.instagram.com/imad.mode?igsi=em85MTVmanRpa29p", "Instagram"],
                            ["https://www.facebook.com/share/1Lwh3Akcuo/", "Facebook"],
                            ["https://www.tiktok.com/@imad_mode?_r=1&_t=ZS-99NC3oV9y44", "TikTok"],
                        ].map(([href, label]) => (
                            <a key={label} href={href} target="_blank" rel="noopener noreferrer" dir="ltr">
                                {label}
                                <ArrowUpLeft size={14} aria-hidden="true" />
                            </a>
                        ))}
                    </nav>
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
