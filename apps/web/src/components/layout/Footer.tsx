"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCategories, getSettings } from "@/lib/api";
import { publishedCategories } from "@/lib/catalog-navigation";
import { storeWhatsAppUrl } from "@/lib/store-contact";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SocialIcon } from "../store/StoreIcons";
import { PackageCheck } from "lucide-react";

const socials = [
    [storeWhatsAppUrl, "WhatsApp"],
    ["https://www.instagram.com/imad.mode?igsi=em85MTVmanRpa29p", "Instagram"],
    ["https://www.facebook.com/share/1Lwh3Akcuo/", "Facebook"],
    ["https://www.tiktok.com/@imad_mode?_r=1&_t=ZS-99NC3oV9y44", "TikTok"],
];

export function Footer() {
    const { data = [] } = useQuery({
        queryKey: ["public-categories"],
        queryFn: getCategories,
        staleTime: 60_000,
    });
    const { data: settings } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
    });
    return (
        <footer className="site-footer refined-footer">
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
                    <p className="footer-brand-note">أناقة يومية للنساء والرجال.</p>
                    <nav
                        className="footer-socials footer-social-icons"
                        aria-label="تابعونا على مواقع التواصل"
                    >
                        {socials.map(([href, label]) => (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                data-network={label.toLowerCase()}
                                aria-label={`${label} — نافذة جديدة`}
                                title={label}
                            >
                                <span className="social-brand-icon" aria-hidden="true">
                                    <SocialIcon network={label} />
                                </span>
                            </a>
                        ))}
                    </nav>
                </div>
                <nav className="footer-nav" aria-labelledby="footer-catalog-title">
                    <h2 id="footer-catalog-title">المتجر</h2>
                    <Link href="/shop">كل المنتجات</Link>
                    {publishedCategories(data).map((c) => (
                        <Link key={c.id} href={`/shop?category=${c.slug}`}>
                            {c.nameAr || c.nameFr}
                        </Link>
                    ))}
                </nav>
                <nav className="footer-nav" aria-labelledby="footer-help-title">
                    <h2 id="footer-help-title">خدمة العملاء</h2>
                    {[
                        ["/delivery", "التوصيل"],
                        ["/returns", "الاستبدال والإرجاع"],
                        ["/contact#questions", "أسئلة قبل الطلب"],
                        ["/contact", "تواصلوا معنا"],
                    ].map(([href, label]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                    <a
                        href={storeWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="تواصلوا عبر واتساب — نافذة جديدة"
                        className="footer-contact-button"
                    >
                        <SocialIcon network="WhatsApp" size={18} />
                        تواصلوا عبر واتساب
                    </a>
                </nav>
            </div>
            <div className="footer-bottom section-container">
                <div className="footer-legal">
                    <small dir="ltr">© {new Date().getFullYear()} IMAD Mode</small>
                    <Link href="/privacy">سياسة الخصوصية</Link>
                </div>
                {settings?.codEnabled === true && (
                    <span className="footer-payment">
                        <PackageCheck size={18} aria-hidden="true" />
                        الدفع عند الاستلام
                    </span>
                )}
            </div>
        </footer>
    );
}
