export const defaultStoreContacts = {
    whatsappUrl: "https://wa.me/message/M44N6KT35MW4N1",
    instagramUrl: "https://www.instagram.com/imad.mode?igsi=em85MTVmanRpa29p",
    facebookUrl: "https://www.facebook.com/share/1Lwh3Akcuo/",
    tiktokUrl: "https://www.tiktok.com/@imad_mode?_r=1&_t=ZS-99NC3oV9y44",
};
export type StoreContactKey = keyof typeof defaultStoreContacts;
export type StoreContacts = Record<StoreContactKey, string>;

/** Blank deliberately hides a link; null means this installation has not customized it. */
export function storeContacts(
    settings?: Partial<Record<StoreContactKey, string | null>>,
): StoreContacts {
    return Object.fromEntries(
        Object.entries(defaultStoreContacts).map(([key, fallback]) => {
            const field = key as StoreContactKey;
            const value = settings?.[field] ?? fallback;
            return [field, normalizeStoreContact(field, value) ?? ""];
        }),
    ) as StoreContacts;
}

/** Return a canonical HTTPS link, an intentional blank, or null for invalid input. */
export function normalizeStoreContact(key: StoreContactKey, input: string): string | null {
    const value = input.trim();
    if (!value) return "";
    if (value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;
    if (key === "whatsappUrl" && /^\+?[\d\s()-]+$/.test(value)) {
        const number = value.replace(/[\s()-]/g, "").replace(/^\+|^00/, "");
        return /^[1-9]\d{6,14}$/.test(number) ? `https://wa.me/${number}` : null;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
        const host = url.hostname.toLowerCase();
        if (key === "whatsappUrl") {
            if (
                host === "wa.me" &&
                (/^\/[1-9]\d{6,14}\/?$/.test(url.pathname) ||
                    /^\/message\/[a-z0-9]+\/?$/i.test(url.pathname))
            )
                return url.href;
            if (
                host === "api.whatsapp.com" &&
                url.pathname === "/send" &&
                /^[1-9]\d{6,14}$/.test(url.searchParams.get("phone") || "")
            )
                return url.href;
            return null;
        }
        const domain = {
            instagramUrl: "instagram.com",
            facebookUrl: "facebook.com",
            tiktokUrl: "tiktok.com",
        }[key];
        return host === domain || host.endsWith(`.${domain}`) ? url.href : null;
    } catch {
        return null;
    }
}
