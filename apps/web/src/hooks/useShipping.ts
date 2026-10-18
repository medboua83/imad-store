"use client";
import { useEffect, useState } from "react";
import { getSettings, type StoreSettings } from "@/lib/api";

export function useShipping(subtotal: number) {
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    useEffect(() => {
        let active = true;
        getSettings().then(value => { if (active) setSettings(value); }).catch(() => {});
        return () => { active = false; };
    }, []);
    const fee = settings ? (subtotal >= settings.freeShippingMin ? 0 : settings.shippingCost) : null;
    return { settings, fee, total: fee === null ? null : subtotal + fee };
}
