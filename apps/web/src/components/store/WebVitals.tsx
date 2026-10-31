"use client";
import { useEffect } from "react";
let registered = false;
/** Opt-in local diagnostics only. No metric is sent to an external service. */
export function WebVitals() {
    useEffect(() => {
        if (registered || !new URLSearchParams(window.location.search).has("measure")) return;
        registered = true;
        void import("web-vitals/attribution").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
            const report = (metric: { name: string; value: number; rating: string }) =>
                console.info(
                    "[IMAD_VITALS]",
                    JSON.stringify({
                        name: metric.name,
                        value: metric.value,
                        rating: metric.rating,
                        viewportWidth: window.innerWidth,
                        visibility: document.visibilityState,
                    }),
                );
            onCLS(report, { reportAllChanges: true });
            onINP(metric => {
                report(metric);
                // Timings only: never log the event target, selectors, URLs or field values.
                console.info("[IMAD_INTERACTION]", JSON.stringify({
                    inputDelay: metric.attribution.inputDelay,
                    processingDuration: metric.attribution.processingDuration,
                    presentationDelay: metric.attribution.presentationDelay,
                }));
            }, { reportAllChanges: true });
            onLCP(report, { reportAllChanges: true });
            onFCP(report);
            onTTFB(report);
        }).catch(() => undefined);
    }, []);
    return null;
}
