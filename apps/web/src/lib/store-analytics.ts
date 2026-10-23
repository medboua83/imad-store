const key = "imad:analytics:visit:v1";
export type AnalyticsVisit = { id: string; started: number; test: boolean };
export function analyticsAllowed() {
    if (typeof window === "undefined") return false;
    try {
        return (
            !localStorage.getItem("adminToken") &&
            !localStorage.getItem("imad:analytics:exclude") &&
            navigator.doNotTrack !== "1" &&
            !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl &&
            (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                new URLSearchParams(location.search).get("stats_test") === "1")
        );
    } catch {
        return false;
    }
}
export function analyticsVisit(create = false): AnalyticsVisit | null {
    if (!analyticsAllowed()) return null;
    try {
        const raw = sessionStorage.getItem(key),
            saved = raw ? (JSON.parse(raw) as AnalyticsVisit) : null;
        if (
            saved &&
            typeof saved.id === "string" &&
            /^[a-f0-9-]{36}$/i.test(saved.id) &&
            Date.now() - saved.started >= 0 &&
            Date.now() - saved.started < 30 * 60_000
        )
            return saved;
        if (!create) return null;
        const visit = {
            id: crypto.randomUUID(),
            started: Date.now(),
            test: new URLSearchParams(location.search).get("stats_test") === "1",
        };
        sessionStorage.setItem(key, JSON.stringify(visit));
        return visit;
    } catch {
        return null;
    }
}
export function analyticsOrderHeaders() {
    const visit = analyticsVisit();
    return visit
        ? { "X-Analytics-Session": visit.id, ...(visit.test ? { "X-Analytics-Test": "1" } : {}) }
        : {};
}
export function trackCart(slug: string) {
    const visit = analyticsVisit(true);
    if (!visit || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
    void fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        keepalive: true,
        body: JSON.stringify({
            session: visit.id,
            page: `/products/${slug}`,
            test: visit.test,
            action: "cart",
        }),
    }).catch(() => undefined);
}
