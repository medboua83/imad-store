import { HomeView } from "@/components/store/HomeView";
import { publicContent, publicCategories, publicProducts } from "@/lib/server-api";
export const dynamic = "force-dynamic";
export default async function HomePage() {
    const [content, categories, products] = await Promise.all([
        publicContent(),
        publicCategories(),
        publicProducts({ limit: 8, availability: "in-stock" }),
    ]);
    return <HomeView content={content} categories={categories} products={products.data} />;
}
