import { HomeView } from "@/components/store/HomeView";
import {
    publicContent,
    publicCategories,
    publicProducts,
    requestSiteOrigin,
} from "@/lib/server-api";
import { storefrontShareMetadata } from "@/lib/share-metadata";
import { homeCatalogueQuery } from "@/lib/home-catalogue";
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
    return <HomeView content={content} categories={categories} products={products.data} />;
}
