"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebVitals } from "@/components/store/WebVitals";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
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
