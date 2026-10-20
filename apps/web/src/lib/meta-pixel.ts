type Pixel = ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[][];
    push?: Pixel;
    loaded: boolean;
    version: string;
};
declare global {
    interface Window {
        fbq?: Pixel;
        _fbq?: Pixel;
    }
}
let config: { enabled: boolean; id: string; madPerUsd?: number | null } = { enabled: false, id: "" };
const initialized = new Set<string>();
const purchases = new Set<string>();
let lastPage = "";
export function pixelExcluded() {
    if (typeof window === "undefined") return true;
    try {
        return (
            window.location.protocol !== "https:" ||
            /^(localhost|127\.|\[?::1\]?)/.test(window.location.hostname) ||
            /^\/(admin|auth)(\/|$)/.test(window.location.pathname) ||
            new URLSearchParams(window.location.search).has("stats_test") ||
            navigator.doNotTrack === "1" ||
            Boolean(
                (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
            ) ||
            Boolean(localStorage.getItem("adminToken"))
        );
    } catch {
        return true;
    }
}
function consentKey() {
    return `imad-meta-consent:${config.id}`;
}
export function pixelConsent(): string | null {
    try {
        return localStorage.getItem(consentKey());
    } catch {
        return null;
    }
}
export function configurePixel(enabled: boolean, id: string, madPerUsd?: number | null) {
    if (config.id !== id || config.enabled !== enabled) {
        window.fbq?.("consent", "revoke");
        lastPage = "";
    }
    config = { enabled, id, madPerUsd };
}
function ready() {
    if (
        !config.enabled ||
        !/^[0-9]{5,25}$/.test(config.id) ||
        pixelExcluded() ||
        pixelConsent() === "denied"
    )
        return false;
    if (!window.fbq) {
        const pixel: Pixel = Object.assign(
            (...args: unknown[]) => {
                if (pixel.callMethod) pixel.callMethod(...args);
                else pixel.queue.push(args);
            },
            { queue: [] as unknown[][], loaded: true, version: "2.0" },
        );
        pixel.push = pixel;
        window.fbq = pixel;
        window._fbq = pixel;
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(script);
    }
    window.fbq("consent", "grant");
    if (!initialized.has(config.id)) {
        window.fbq("set", "autoConfig", false, config.id);
        window.fbq("init", config.id);
        initialized.add(config.id);
    }
    return true;
}
export function choosePixelConsent(allowed: boolean) {
    try {
        localStorage.setItem(consentKey(), allowed ? "granted" : "denied");
    } catch {
        return;
    }
    if (!allowed) {
        window.fbq?.("consent", "revoke");
        lastPage = "";
    }
}
export function metaPage(path: string) {
    try {
        if (!ready() || path === lastPage) return;
        lastPage = path;
        window.fbq!("trackSingle", config.id, "PageView");
        if (/^\/products\/[a-z0-9-]+$/.test(path))
            window.fbq!("trackSingle", config.id, "ViewContent", {
                content_ids: [path.split("/").pop()],
                content_type: "product",
            });
        if (path === "/checkout") window.fbq!("trackSingle", config.id, "InitiateCheckout");
    } catch {
        /* A blocked advertising script must not affect the store. */
    }
}
export function purchaseUsdValue(value: number, madPerUsd?: number | null): number | null {
    if (!Number.isFinite(value) || value < 0 || !madPerUsd ||
        !Number.isFinite(madPerUsd) || madPerUsd < 0.000001 || madPerUsd > 1000000) return null;
    const converted = Math.round((value / madPerUsd + Number.EPSILON) * 100) / 100;
    return Number.isFinite(converted) ? converted : null;
}
export function metaPurchase(orderId: string, value: number) {
    try {
        const key = `imad-meta-purchase:${config.id}:${orderId}`;
        const usdValue = purchaseUsdValue(value, config.madPerUsd);
        if (
            !orderId ||
            usdValue === null ||
            !ready() ||
            purchases.has(key) ||
            localStorage.getItem(key) ||
            sessionStorage.getItem(key)
        )
            return;
        window.fbq!(
            "trackSingle",
            config.id,
            "Purchase",
            { currency: "USD", value: usdValue },
            { eventID: `order-${orderId}` },
        );
        purchases.add(key);
        localStorage.setItem(key, "1");
        sessionStorage.setItem(key, "1");
    } catch {
        /* Advertising must never interrupt a successful order. */
    }
}
