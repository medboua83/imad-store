"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { brandTheme, defaultStoreBranding, resolveStoreBranding, type StoreBranding } from "@imad-store/shared";
import { getSettings, type StoreSettings } from "@/lib/api";

const Context = createContext<StoreBranding>(defaultStoreBranding);
export const useBranding = () => useContext(Context);
export function BrandName({ original }: { original?: string }) {
    const b = useBranding();
    return <>{b.name === defaultStoreBranding.name ? original ?? b.name : b.name}</>;
}
export function BrandingProvider({ initialSettings, children }: { initialSettings: StoreSettings | null; children: React.ReactNode }) {
    const { data } = useQuery({ queryKey: ["store-settings"], queryFn: getSettings,
        staleTime: 60_000 });
    // SSR identity is a visual fallback, never an injected shipping/checkout cache value.
    const branding = resolveStoreBranding(data?.branding ?? initialSettings?.branding);
    return <Context.Provider value={branding}>
        <div className="brand-theme" style={brandTheme(branding)}
            data-custom-primary={branding.primaryColor !== defaultStoreBranding.primaryColor || undefined}
            data-custom-accent={branding.accentColor !== defaultStoreBranding.accentColor || undefined}
            data-custom-background={branding.backgroundColor !== defaultStoreBranding.backgroundColor || undefined}>
            {children}
        </div>
    </Context.Provider>;
}
