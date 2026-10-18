"use client";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
export function useShipping(subtotal: number) {
    const query = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
        retry: 2,
    });
    const settings = query.data ?? null;
    const fee = settings
        ? subtotal >= settings.freeShippingMin
            ? 0
            : settings.shippingCost
        : null;
    return {
        settings,
        fee,
        total: fee === null ? null : subtotal + fee,
        loading: query.isPending,
        error: query.isError,
        retry: query.refetch,
    };
}
