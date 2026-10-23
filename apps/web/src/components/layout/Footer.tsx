"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/lib/api";
import { publishedCategories } from "@/lib/catalog-navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SocialIcon } from "../store/StoreIcons";
import { ArrowUpLeft, PackageCheck, SlidersHorizontal, MessageCircle } from "lucide-react";

const socials = [
    ["https://wa.me/message/M44N6KT35MW4N1", "WhatsApp"],
    ["https://www.instagram.com/imad.mode?igsi=em85MTVmanRpa29p", "Instagram"],
    ["https://www.facebook.com/share/1Lwh3Akcuo/", "Facebook"],
    ["https://www.tiktok.com/@imad_mode?_r=1&_t=ZS-99NC3oV9y44", "TikTok"],
];

export function Footer() {
    const {data = []} = useQuery({queryKey:["public-categories"],queryFn:getCategories,staleTime:60_000});
    return (
        <footer className="site-footer refined-footer">
            <div className="footer-service-strip section-container" aria-label="تجربة التسوق">
                <div>
                    <PackageCheck size={22} aria-hidden="true" />
                    <span>
                        الدفع عند الاستلام<small>راجعوا المبلغ قبل تأكيد الطلب</small>
                    </span>
                </div>
                <div>
                    <SlidersHorizontal size={22} aria-hidden="true" />
                    <span>
                        اختيارات على مقاسكم<small>اللون والمقاس والتوفر في كل قطعة</small>
                    </span>
                </div>
                <Link href="/contact">
                    <MessageCircle size={22} aria-hidden="true" />
                    <span>
                        نحن هنا للمساعدة<small>سؤال عن قطعة أو عن طلبكم؟</small>
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
                        <BrandLogo />
                    </Link>
                    <p className="footer-tagline">
                        أناقة في الاختيار.
                        <br />
                        بساطة في التفاصيل.
                    </p>
                    <p className="footer-brand-note">
                        قطع تختارونها بطريقتكم، وتفاصيل واضحة في كل خطوة.
                    </p>
                </div>
                <nav aria-label="اكتشفوا المتجر">
                    <h2>اكتشفوا IMAD</h2>
                    <Link href="/shop">كل المنتجات</Link>
                    {publishedCategories(data).map(c => (
                        <Link key={c.id} href={`/shop?category=${c.slug}`}>
                            {c.nameAr || c.nameFr} ({c.publishedCount})
                        </Link>
                    ))}
                </nav>
                <nav aria-label="معلومات المتجر">
                    <h2>معلومات تهمكم</h2>
                    {[
                        ["/delivery", "التوصيل"],
                        ["/returns", "الاستبدال والإرجاع"],
                        ["/privacy", "الخصوصية"],
                        ["/contact", "تواصلوا معنا"],
                        ["/contact#questions", "أسئلة قبل الطلب"],
                    ].map(([href, label]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="footer-help">
                    <span className="footer-help-label">لأن التفاصيل تهمّكم</span>
                    <h2>نساعدكم على الاختيار.</h2>
                    <p>تواصلوا معنا للاستفسار عن المنتجات أو توضيح تفاصيل طلبكم.</p>
                    <a
                        href={socials[0][0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-contact-button"
                    >
                        تواصلوا عبر واتساب <ArrowUpLeft size={18} aria-hidden="true" />
                    </a>
                    <Link href="/contact" className="footer-contact-alternative">
                        طرق التواصل الأخرى
                    </Link>
                </div>
            </div>
            <div className="footer-community section-container">
                <div>
                    <h2>لنكن على تواصل.</h2>
                    <p>تابعونا على مواقع التواصل</p>
                </div>
                <nav className="footer-socials" aria-label="تابعونا على مواقع التواصل">
                    {socials.map(([href, label]) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                            data-network={label.toLowerCase()}
                            aria-label={`${label} — نافذة جديدة`}
                        >
                            <span className="social-brand-icon">
                                <SocialIcon network={label} />
                            </span>
                            <span>{label}</span>
                            <ArrowUpLeft size={14} aria-hidden="true" />
                        </a>
                    ))}
                </nav>
            </div>
            <div className="footer-bottom section-container">
                <p dir="ltr">© {new Date().getFullYear()} IMAD Mode</p>
                <p>اختاروا. راجعوا. واطلبوا بثقة.</p>
                <Link href="/privacy">سياسة الخصوصية</Link>
            </div>
        </footer>
    );
}
