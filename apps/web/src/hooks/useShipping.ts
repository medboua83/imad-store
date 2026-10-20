"use client";
import { useQuery } from "@tanstack/react-query";
import { shippingFee } from "@imad-store/shared";
import { getSettings } from "@/lib/api";
export function useShipping(
    subtotal: number,
    items: { freeShipping?: boolean; quantity: number }[] = [],
) {
    const query = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
        retry: 2,
    });
    const settings = query.data ?? null;
    const fee = settings ? shippingFee(subtotal, items, settings) : null;
    return {
        settings,
        fee,
        total: fee === null ? null : subtotal + fee,
        loading: query.isPending,
        error: query.isError,
        retry: query.refetch,
    };
}
