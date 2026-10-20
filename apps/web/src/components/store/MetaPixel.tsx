"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import {
    choosePixelConsent,
    configurePixel,
    metaPage,
    pixelConsent,
    pixelExcluded,
} from "@/lib/meta-pixel";

export function MetaPixel() {
    const path = usePathname();
    const { data } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 60_000,
    });
    const [choice, setChoice] = useState<string | null>(null),
        [eligible, setEligible] = useState(false),
        [opened, setOpened] = useState(false);
    useEffect(() => {
        const task = setTimeout(() => {
        configurePixel(Boolean(data?.metaPixelEnabled), data?.metaPixelId || "");
        const permitted = Boolean(data?.metaPixelEnabled && data.metaPixelId && !pixelExcluded());
        setEligible(permitted);
        setChoice(pixelConsent());
        if (permitted) metaPage(path);
        }, 0);
        return () => clearTimeout(task);
    }, [data?.metaPixelEnabled, data?.metaPixelId, path]);
    if (!eligible) return null;
    function choose(allow: boolean) {
        choosePixelConsent(allow);
        setChoice(allow ? "granted" : "denied");
        setOpened(false);
        if (allow) metaPage(path);
    }
    return (
        <>
            <button className="pixel-preference" onClick={() => setOpened(true)}>
                خيارات ملفات الارتباط الإعلانية
            </button>
            {(!choice || opened) && (
                <section className="pixel-choice" aria-label="ملفات الارتباط الإعلانية">
                    <p>
                        نستخدم Meta Pixel لقياس الحملات الإعلانية. هل توافقين على ملفات الارتباط
                        الإعلانية؟ يمكنكم تغيير اختياركم في أي وقت.
                    </p>
                    <button onClick={() => choose(true)}>أوافق</button>
                    <button onClick={() => choose(false)}>أرفض</button>
                </section>
            )}
        </>
    );
}
