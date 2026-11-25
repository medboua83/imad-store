/** Public presentation only. Never store SMTP, payment or integration credentials here. */
export interface StoreBranding {
    name: string;
    logoUrl: string;
    darkLogoUrl: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
}
export const defaultStoreBranding: StoreBranding = {
    name: "IMAD Mode", logoUrl: "", darkLogoUrl: "",
    primaryColor: "#78551f", accentColor: "#e7cf97", backgroundColor: "#fcfaf6",
    contactEmail: "", contactPhone: "", contactAddress: "",
};
export const isBrandLogo = (value: string) => value === "" || /^\/uploads\/[a-f0-9]{64}\.webp$/.test(value);
export const isBrandColor = (value: string) => /^#[a-f0-9]{6}$/i.test(value);
export function resolveStoreBranding(value?: Partial<StoreBranding> | null): StoreBranding {
    const b = { ...defaultStoreBranding };
    if (!value || typeof value !== "object") return b;
    if (typeof value.name === "string" && value.name.trim()) b.name = value.name.trim().slice(0, 120);
    for (const key of ["logoUrl", "darkLogoUrl"] as const)
        if (typeof value[key] === "string" && isBrandLogo(value[key])) b[key] = value[key];
    for (const key of ["primaryColor", "accentColor", "backgroundColor"] as const)
        if (typeof value[key] === "string" && isBrandColor(value[key])) b[key] = value[key].toLowerCase();
    for (const key of ["contactEmail", "contactPhone", "contactAddress"] as const)
        if (typeof value[key] === "string") b[key] = value[key].trim();
    return b;
}
function luminance(hex: string): number {
    const rgb = hex.slice(1).match(/../g)!.map(n => {
        const v = parseInt(n, 16) / 255;
        return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
export function brandContrast(a: string, b: string): number {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
/** Choose a readable foreground even for very light or dark merchant colours. */
export function brandForeground(hex: string): string {
    return brandContrast(hex, "#000000") > brandContrast(hex, "#ffffff") ? "#000000" : "#ffffff";
}
export function brandTheme(b: StoreBranding): Record<string, string> {
    const values: Record<string, string> = {};
    // No overrides for the original identity: preserve every existing shade and gradient.
    if (b.primaryColor !== defaultStoreBranding.primaryColor) Object.assign(values, {
        "--brand-primary": b.primaryColor, "--brand-on-primary": brandForeground(b.primaryColor),
        "--forest": b.primaryColor, "--forest-dark": b.primaryColor,
        "--gold-dark": b.primaryColor, "--brand-dark": b.primaryColor,
    });
    if (b.accentColor !== defaultStoreBranding.accentColor) Object.assign(values, {
        "--brand-accent": b.accentColor, "--brand-on-accent": brandForeground(b.accentColor),
        "--gold": b.accentColor, "--gold-light": b.accentColor,
    });
    if (b.backgroundColor !== defaultStoreBranding.backgroundColor) Object.assign(values, {
        "--brand-background": b.backgroundColor, "--brand-on-background": brandForeground(b.backgroundColor),
        "--paper": b.backgroundColor,
    });
    if (b.primaryColor !== defaultStoreBranding.primaryColor || b.accentColor !== defaultStoreBranding.accentColor) {
        const darkSurface = b.primaryColor !== defaultStoreBranding.primaryColor ? b.primaryColor : "#292319";
        values["--brand-header-mark"] = brandContrast(b.primaryColor, "#fcfaf6") >= 4.5 ? b.primaryColor : brandForeground("#fcfaf6");
        values["--brand-dark-mark"] = brandContrast(b.accentColor, darkSurface) >= 3 ? b.accentColor : brandForeground(darkSurface);
    }
    return values;
}
