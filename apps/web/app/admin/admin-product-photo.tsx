"use client";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function AdminProductPhoto({
    images,
    name,
    width = 64,
    height = 76,
}: {
    images: string[];
    name: string;
    width?: number;
    height?: number;
}) {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const src = images.find((image) => image && !failed.has(image));
    return src ? (
        <Image
            src={src}
            alt={name}
            width={width}
            height={height}
            onError={() => setFailed((previous) => new Set([...previous, src]))}
        />
    ) : (
        <span
            className="admin-photo-unavailable"
            role="img"
            aria-label={`${name} — ${images.length ? "Photo indisponible" : "Sans photo"}`}
        >
            <ImageOff size={22} aria-hidden="true" />
            <span>{images.length ? "Photo indisponible" : "Sans photo"}</span>
        </span>
    );
}
