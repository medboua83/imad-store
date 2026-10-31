"use client";
import Image from "next/image";
import { useState } from "react";
export function ProductPhoto({
    images,
    name,
    className = "object-cover",
    sizes = "(max-width:767px) 100vw, (max-width:1023px) 50vw, 25vw",
    preload = false,
    eager = false,
}: {
    images: string[];
    name: string;
    className?: string;
    sizes?: string;
    preload?: boolean;
    eager?: boolean;
}) {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const src = images.find((src) => src && !failed.has(src));
    return src ? (
        <Image
            src={src}
            alt={name}
            fill
            sizes={sizes}
            className={className}
            preload={preload}
            loading={preload ? undefined : eager ? "eager" : "lazy"}
            fetchPriority={!preload && eager ? "high" : undefined}
            onError={() =>
                setFailed((previous) =>
                    previous.has(src) ? previous : new Set([...previous, src]),
                )
            }
        />
    ) : (
        <span
            className="product-photo-placeholder"
            role={name ? "img" : undefined}
            aria-hidden={!name || undefined}
            aria-label={name ? `${name} — الصورة قيد التحضير` : undefined}
        >
            IMAD
        </span>
    );
}
