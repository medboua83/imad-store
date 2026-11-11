"use client";
import { useAdminLocale } from "./admin-locale";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function AdminProductPhoto({
    images,
    name,
    width = 64,
    height = 76,
    eager = false,
}: {
    images: string[];
    name: string;
    width?: number;
    height?: number;
    eager?: boolean;
}) {
    const { t } = useAdminLocale();
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const src = images.find((image) => image && !failed.has(image));
    return src ? (
        <Image
            src={src}
            alt={name}
            width={width}
            height={height}
            loading={eager ? "eager" : undefined}
            onError={() => setFailed((previous) => new Set([...previous, src]))}
        />
    ) : (
        <span
            className="admin-photo-unavailable"
            role="img"
            aria-label={`${name} — ${t(images.length ? "Photo indisponible" : "Sans photo")}`}
        >
            <ImageOff size={22} aria-hidden="true" />
            <span>{images.length ? t("Photo indisponible") : t("Sans photo")}</span>
        </span>
    );
}
