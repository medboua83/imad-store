"use client";
import { Suspense, useEffect, useState } from "react";
import { campaignAllowed, campaignChoiceNeeded, captureCampaign, chooseCampaignConsent } from "@/lib/campaign-attribution";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import {
    choosePixelConsent,
    configurePixel,
    metaPage,
    pixelExcluded,
} from "@/lib/meta-pixel";

export function MetaPixel() {
    return <Suspense fallback={null}><MetaPixelTracking /></Suspense>;
}
function MetaPixelTracking() {
    const path = usePathname();
    const search = useSearchParams().toString();
    const { data } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
    });
    const settingsReady = Boolean(data);
    const [eligible, setEligible] = useState(false),
        [opened, setOpened] = useState(false);
    useEffect(() => {
        const task = setTimeout(() => {
        configurePixel(Boolean(data?.metaPixelEnabled), data?.metaPixelId || "", data?.metaPixelMadPerUsd);
        const permitted = Boolean(data?.metaPixelEnabled && data.metaPixelId && !pixelExcluded());
        setEligible(settingsReady && (permitted || campaignAllowed()));
        captureCampaign();
        if (settingsReady && campaignChoiceNeeded()) setOpened(true);
        if (permitted) metaPage(path);
        }, 0);
        return () => clearTimeout(task);
    }, [settingsReady, data?.metaPixelEnabled, data?.metaPixelId, data?.metaPixelMadPerUsd, path, search]);
    if (!eligible) return null;
    function choose(allow: boolean) {
        choosePixelConsent(allow);
        chooseCampaignConsent(allow);
        setOpened(false);
        if (allow) metaPage(path);
    }
    return (
        <>
            <button className="pixel-preference" onClick={() => setOpened(true)}>
                خيارات ملفات الارتباط الإعلانية
            </button>
            {opened && (
                <section className="pixel-choice" aria-label="ملفات الارتباط الإعلانية">
                    <p>
                        بموافقتكم، نحفظ مصدر الإعلان لمدة 30 يوماً لربطه بطلبكم، ثم نحفظ هذا الربط مع الطلب لمدة 90 يوماً.
                        نستخدم Meta Pixel أيضاً إذا كان مفعلاً. يمكنكم الرفض أو تغيير اختياركم في أي وقت؛ الشراء متاح دون موافقة.
                    </p>
                    <button onClick={() => choose(true)}>تفعيل التتبع</button>
                    <button onClick={() => choose(false)}>إيقاف التتبع</button>
                    <button onClick={() => setOpened(false)}>إغلاق</button>
                </section>
            )}
        </>
    );
}
