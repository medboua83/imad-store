"use client";
import Image from "next/image";
import { Expand, X } from "lucide-react";
import { useRef, useState } from "react";
import { trapDialogFocus } from "../layout/dialog-focus";
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
    const [active, setActive] = useState(0);
    const zoom = useRef<HTMLDialogElement>(null);
    const src = images[active];
    return (
        <div className="product-gallery">
            <div className="gallery-stage">
                {src ? (
                    <Image
                        src={src}
                        alt={name}
                        fill
                        preload
                        sizes="(max-width: 767px) 100vw, 50vw"
                        className="gallery-photo"
                    />
                ) : (
                    <p>الصورة قيد التحضير</p>
                )}
                {src && (
                    <button
                        className="gallery-expand"
                        type="button"
                        onClick={() => zoom.current?.showModal()}
                        aria-label="تكبير صورة المنتج"
                    >
                        <Expand size={19} aria-hidden="true" />
                    </button>
                )}
                <span className="gallery-position" dir="ltr">
                    {images.length ? active + 1 : 0} / {images.length}
                </span>
            </div>
            {images.length > 1 && (
                <div className="gallery-thumbnails" aria-label="صور المنتج">
                    {images.map((image, i) => (
                        <button
                            key={`${image}-${i}`}
                            type="button"
                            aria-label={`عرض الصورة ${i + 1}`}
                            aria-pressed={active === i}
                            onClick={() => setActive(i)}
                        >
                            <Image src={image} alt="" fill sizes="80px" className="gallery-photo" />
                        </button>
                    ))}
                </div>
            )}
            <dialog
                ref={zoom}
                className="gallery-dialog"
                aria-label={`صورة ${name}`}
                onKeyDown={trapDialogFocus}
            >
                <button
                    type="button"
                    className="gallery-close"
                    aria-label="إغلاق الصورة"
                    onClick={() => zoom.current?.close()}
                >
                    <X size={24} aria-hidden="true" />
                </button>
                {src && <Image src={src} alt={name} fill sizes="100vw" className="gallery-photo" />}
            </dialog>
        </div>
    );
}
