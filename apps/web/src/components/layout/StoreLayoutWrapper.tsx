"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { MetaPixel } from "@/components/store/MetaPixel";
import { StoreAnalytics } from "@/components/store/StoreAnalytics";
import { Footer } from "@/components/layout/Footer";

export default function StoreLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith("/admin");

    if (isAdmin) {
        return children;
    }

    return (
        <div
            className={`store-shell${pathname?.startsWith("/products/") ? " compact-product-shell" : ""}`}
        >
            <StoreAnalytics />
            <a className="skip-link" href="#main-content">
                الانتقال إلى المحتوى
            </a>
            <Navbar />
            <CartDrawer />
            <main id="main-content">{children}</main>
            <Footer />
            <MetaPixel />
        </div>
    );
}
