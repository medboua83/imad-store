"use client";
import { useEffect, useState } from "react";
import { getProductRecommendations, type Product } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";
import { RecommendationList } from "./RecommendationList";
export function CartRecommendations({
    active,
    onNavigate,
}: {
    active: boolean;
    onNavigate: () => void;
}) {
    const items = useCartStore((s) => s.items);
    const sources = [...new Set(items.map((i) => i.productSlug))].slice(0, 3).sort().join("|");
    const [result, setResult] = useState<{ source: string; products: Product[] }>({
        source: "",
        products: [],
    });
    useEffect(() => {
        if (!active || !sources) return;
        const controller = new AbortController();
        Promise.allSettled(
            sources.split("|").map((slug) => getProductRecommendations(slug, controller.signal)),
        ).then((results) => {
            if (controller.signal.aborted) return;
            setResult({ source: sources, products: results.flatMap(r => r.status === "fulfilled" ? r.value.crossSell : []) });
        });
        return () => controller.abort();
    }, [active, sources]);
    return (
        <RecommendationList
            products={active && result.source === sources ? result.products : []}
            kind="crossSell"
            compact
            onNavigate={onNavigate}
        />
    );
}
