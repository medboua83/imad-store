import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";
import "./checkout.css";
import "./footer.css";
import "./header.css";
import "./product.css";
import "./design-polish.css";
import "./shop-polish.css";
import "./gold-theme.css";
import { Providers } from "@/components/Providers";
import StoreLayoutWrapper from "@/components/layout/StoreLayoutWrapper";

import { requestSiteOrigin } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: await requestSiteOrigin(),
    title: { default: "IMAD Mode — أناقة محتشمة", template: "%s | IMAD Mode" },
    description: "تصفحوا منتجات IMAD Mode واختاروا اللون والمقاس مع ملخص واضح لطلبكم.",
    alternates: { canonical: "/" },
  };
}

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
          href="/fonts/tajawal-400-arabic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cormorant-wordmark.ttf"
          as="font"
          type="font/ttf"
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
