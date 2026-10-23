import { publicRecommendations } from "@/lib/server-api";
import { RecommendationList } from "./RecommendationList";
export async function ProductSuggestions({ slug }: { slug: string }) {
    const suggestions = await publicRecommendations(slug);
    const upsell = new Set(suggestions.upsell.map((p) => p.id));
    return (
        <>
            <RecommendationList products={suggestions.upsell} kind="upsell" />
            <RecommendationList
                products={suggestions.crossSell.filter((p) => !upsell.has(p.id))}
                kind="crossSell"
            />
        </>
    );
}
