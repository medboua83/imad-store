"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsVisit } from "@/lib/store-analytics";
export function StoreAnalytics() {
    const path = usePathname();
    useEffect(() => {
        if (
            !/^\/(?:shop|checkout|contact|delivery|returns|privacy|products\/[a-z0-9-]+)?$/.test(
                path,
            )
        )
            return;
        const visit = analyticsVisit(true);
        if (!visit) return;
        // Query strings, customer fields, referrers and browser fingerprints never leave here.
        const send = () =>
            fetch("/api/analytics/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "omit",
                keepalive: true,
                body: JSON.stringify({ session: visit.id, page: path, test: visit.test }),
            });
        void send().catch(() => undefined);
    }, [path]);
    return null;
}
