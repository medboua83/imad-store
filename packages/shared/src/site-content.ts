export const homeSectionKeys = ["collections", "featured", "banners", "guide"] as const;
export type HomeSection = (typeof homeSectionKeys)[number];
export const MAX_HERO_PRODUCTS = 6;

export interface SiteContent {
    homeSections?: HomeSection[];
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;
    /** Legacy content without a mode remains automatic unless it already has a selection. */
    heroProductMode?: "auto" | "manual";
    heroProductIds?: string[];
    heroAutoplay?: boolean;
    heroMinimalControls?: boolean;
    featuredTitle: string;
    banners: Array<{ title: string; image: string; href: string }>;
    deliveryText: string;
    returnsText: string;
    privacyText: string;
    businessName: string;
    businessAddress: string;
    policiesVerified: boolean;
}
export const usesManualHeroSelection = (content: Pick<SiteContent, "heroProductMode" | "heroProductIds">) =>
    content.heroProductMode === "manual" || (!content.heroProductMode && content.heroProductIds !== undefined);
export const defaultSiteContent: SiteContent = {
    heroTitle: "أناقة لكل يوم",
    heroSubtitle: "قطع مختارة للنساء والرجال.",
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
