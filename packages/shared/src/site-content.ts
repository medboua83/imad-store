export interface SiteContent {
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;
    featuredTitle: string;
    banners: Array<{ title: string; image: string; href: string }>;
    deliveryText: string;
    returnsText: string;
    privacyText: string;
    businessName: string;
    businessAddress: string;
    policiesVerified: boolean;
}
export const defaultSiteContent: SiteContent = {
    heroTitle: "أناقة للجميع",
    heroSubtitle: "اكتشفوا مجموعتنا، اختاروا اللون والمقاس، وأكملوا طلبكم بسهولة.",
    heroImage: "/images/hero-1.png",
    featuredTitle: "مختارات من المتجر",
    banners: [],
    deliveryText: "",
    returnsText: "",
    privacyText: "",
    businessName: "IMAD Mode",
    businessAddress: "",
    policiesVerified: false,
};
