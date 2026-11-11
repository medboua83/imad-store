"use client";
import { useQuery } from "@tanstack/react-query";
import { storeContacts } from "@imad-store/shared";
import { getSettings } from "./api";

export function useStoreContacts(enabled = true) {
    const { data } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
        enabled,
    });
    // Wait for this installation's settings, rather than briefly linking to an old account.
    return data ? storeContacts(data) : undefined;
}
