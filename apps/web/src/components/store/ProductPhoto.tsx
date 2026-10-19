"use client";
import Image from "next/image";
import { useState } from "react";
export function ProductPhoto({ images, name }: { images: string[]; name: string }) {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const src = images.find((src) => src && !failed.has(src));
    return src ? (
        <Image
            src={src}
            alt={name}
            fill
            sizes="(max-width:767px) 100vw, (max-width:1023px) 50vw, 25vw"
            className="object-cover"
            onError={() =>
                setFailed((previous) =>
                    previous.has(src) ? previous : new Set([...previous, src]),
                )
            }
        />
    ) : (
        <span
            className="product-photo-placeholder"
            role="img"
            aria-label={`${name} — الصورة قيد التحضير`}
        >
            IMAD
        </span>
    );
}
