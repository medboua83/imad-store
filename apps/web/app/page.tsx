import { HomeView } from "@/components/store/HomeView";
import {
    publicContent,
    publicHeroProducts,
    publicCategories,
    publicProducts,
    requestSiteOrigin,
} from "@/lib/server-api";
import { storefrontShareMetadata } from "@/lib/share-metadata";
import { homeCatalogueQuery } from "@/lib/home-catalogue";
import { usesManualHeroSelection } from "@imad-store/shared";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
    return storefrontShareMetadata("home", await requestSiteOrigin());
}
export default async function HomePage() {
    const [content, categories, products] = await Promise.all([
        publicContent(),
        publicCategories(),
        publicProducts(homeCatalogueQuery),
    ]);
    const heroProducts = usesManualHeroSelection(content) && content.heroProductIds?.length ? await publicHeroProducts() : [];
    return <HomeView content={content} categories={categories} products={products.data} heroProducts={heroProducts} />;
}
