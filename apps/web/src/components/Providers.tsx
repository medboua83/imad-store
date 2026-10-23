"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebVitals } from "@/components/store/WebVitals";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart.store";

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        void useCartStore.persist.rehydrate();
    }, []);
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { staleTime: 60_000 } },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <WebVitals />
            {children}
        </QueryClientProvider>
    );
}
