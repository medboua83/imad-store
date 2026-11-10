"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { MetaPixel } from "@/components/store/MetaPixel";
import { StoreAnalytics } from "@/components/store/StoreAnalytics";
import { Footer } from "@/components/layout/Footer";
import { SocialIcon } from "@/components/store/StoreIcons";
import { storeWhatsAppUrl } from "@/lib/store-contact";

export default function StoreLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith("/admin");
    const isProduct = pathname?.startsWith("/products/");
    const showWhatsApp = pathname === "/" || pathname === "/shop" || isProduct;

    if (isAdmin) {
        return children;
    }

    return (
        <div
            className={`store-shell${isProduct ? " compact-product-shell" : ""}`}
        >
            <StoreAnalytics />
            <a className="skip-link" href="#main-content">
                الانتقال إلى المحتوى
            </a>
            <Navbar />
            <CartDrawer />
            <main id="main-content">{children}</main>
            {showWhatsApp && (
                <a
                    className="store-whatsapp-float"
                    href={storeWhatsAppUrl}
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
