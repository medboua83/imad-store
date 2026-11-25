"use client";
import { useState } from "react";
import { defaultStoreBranding } from "@imad-store/shared";
import { useBranding } from "../BrandingProvider";
/** Original masked artwork is preserved until the merchant selects an identity. */
export function BrandLogo({ dark = false }: { dark?: boolean }) {
    const b = useBranding();
    const [failed, setFailed] = useState("");
    const url = dark ? b.darkLogoUrl || b.logoUrl : b.logoUrl;
    if (url && failed !== url) return <img className="brand-custom-logo" src={url} alt={b.name} width={230} height={110}
        onError={() => setFailed(url)} />;
    if (url || b.name !== defaultStoreBranding.name) return <span className="brand-text-logo" dir="auto">{b.name}</span>;
    return <span className="brand-logo" role="img" aria-label={b.name} />;
}
