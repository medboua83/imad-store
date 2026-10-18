"use client";
import { useEffect } from "react";
let registered = false;
/** Opt-in local diagnostics only. No metric is sent to an external service. */
export function WebVitals() {
    useEffect(() => {
        if (registered || !new URLSearchParams(window.location.search).has("measure")) return;
        registered = true;
        void import("web-vitals").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
            const report = (metric: { name: string; value: number; rating: string }) =>
                console.info(
                    "[IMAD_VITALS]",
                    JSON.stringify({
                        name: metric.name,
                        value: metric.value,
                        rating: metric.rating,
                    }),
                );
            onCLS(report, { reportAllChanges: true });
            onINP(report, { reportAllChanges: true });
            onLCP(report, { reportAllChanges: true });
            onFCP(report);
            onTTFB(report);
        });
    }, []);
    return null;
}
