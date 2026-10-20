"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import {
    choosePixelConsent,
    configurePixel,
    metaPage,
    pixelExcluded,
} from "@/lib/meta-pixel";

export function MetaPixel() {
    const path = usePathname();
    const { data } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
    });
    const [eligible, setEligible] = useState(false),
        [opened, setOpened] = useState(false);
    useEffect(() => {
        const task = setTimeout(() => {
        configurePixel(Boolean(data?.metaPixelEnabled), data?.metaPixelId || "", data?.metaPixelMadPerUsd);
        const permitted = Boolean(data?.metaPixelEnabled && data.metaPixelId && !pixelExcluded());
        setEligible(permitted);
        if (permitted) metaPage(path);
        }, 0);
        return () => clearTimeout(task);
    }, [data?.metaPixelEnabled, data?.metaPixelId, data?.metaPixelMadPerUsd, path]);
    if (!eligible) return null;
    function choose(allow: boolean) {
        choosePixelConsent(allow);
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
                        نستخدم Meta Pixel لقياس الحملات الإعلانية. يمكنكم إيقاف التتبع
                        الإعلاني أو تفعيله وتغيير اختياركم في أي وقت.
                    </p>
                    <button onClick={() => choose(true)}>تفعيل التتبع</button>
                    <button onClick={() => choose(false)}>إيقاف التتبع</button>
                    <button onClick={() => setOpened(false)}>إغلاق</button>
                </section>
            )}
        </>
    );
}
