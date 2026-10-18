import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import StoreLayoutWrapper from "@/components/layout/StoreLayoutWrapper";

export const metadata: Metadata = {
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    title: { default: "IMAD Mode — أناقة محتشمة", template: "%s | IMAD Mode" },
    description: "تصفحي منتجات IMAD Mode واختاري اللون والمقاس مع ملخص واضح لطلبك.",
    alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ar" dir="rtl">
            <head>
                <link
                    rel="preload"
                    href="/fonts/900a7f3430df5f05.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
                <link
                    rel="preload"
                    href="/fonts/8091de8f5e738f1d.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </head>
            <body className="font-arabic">
                <Providers>
                    <StoreLayoutWrapper>{children}</StoreLayoutWrapper>
                </Providers>
            </body>
        </html>
    );
}
