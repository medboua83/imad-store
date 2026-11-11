"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { MetaPixel } from "@/components/store/MetaPixel";
import { StoreAnalytics } from "@/components/store/StoreAnalytics";
import { Footer } from "@/components/layout/Footer";
import { SocialIcon } from "@/components/store/StoreIcons";
import { useStoreContacts } from "@/lib/use-store-contacts";

export default function StoreLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const shell = useRef<HTMLDivElement>(null);
    const [footerVisible, setFooterVisible] = useState(false);
    const isAdmin = pathname?.startsWith("/admin");
    const contacts = useStoreContacts(!isAdmin);
    const isProduct = pathname?.startsWith("/products/");
    const showWhatsApp = pathname === "/" || pathname === "/shop" || isProduct;

    useEffect(() => {
        if (!showWhatsApp) return;
        const footer = shell.current?.querySelector("footer");
        if (!footer) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setFooterVisible(entry.isIntersecting);
            },
            { rootMargin: "0px 0px -80px 0px" },
        );
        observer.observe(footer);
        return () => observer.disconnect();
    }, [showWhatsApp]);

    if (isAdmin) {
        return children;
    }

    return (
        <div ref={shell} className={`store-shell${isProduct ? " compact-product-shell" : ""}`}>
            <StoreAnalytics />
            <a className="skip-link" href="#main-content">
                الانتقال إلى المحتوى
            </a>
            <Navbar />
            <CartDrawer />
            <main id="main-content">{children}</main>
            {showWhatsApp && contacts?.whatsappUrl && (
                <a
                    className="store-whatsapp-float"
                    data-footer-visible={footerVisible}
                    href={contacts.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="مساعدة عبر واتساب — نافذة جديدة"
                    title="مساعدة عبر واتساب"
                >
                    <SocialIcon network="WhatsApp" size={25} />
                </a>
            )}
            <Footer />
            <MetaPixel />
        </div>
    );
}
