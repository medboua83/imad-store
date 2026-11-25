"use client";
import { useBranding } from "../BrandingProvider";
export function BrandContactDetails() {
    const b = useBranding();
    if (!b.contactEmail && !b.contactPhone && !b.contactAddress) return null;
    return <div className="brand-contact-details">
        {b.contactEmail && <a href={`mailto:${b.contactEmail}`} dir="ltr">{b.contactEmail}</a>}
        {b.contactPhone && <a href={`tel:${b.contactPhone.replace(/[^+0-9]/g, "")}`} dir="ltr">{b.contactPhone}</a>}
        {b.contactAddress && <address dir="auto">{b.contactAddress}</address>}
    </div>;
}
