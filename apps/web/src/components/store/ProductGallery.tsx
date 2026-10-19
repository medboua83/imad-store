"use client";
import Image from "next/image";
import { Expand, X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trapDialogFocus } from "../layout/dialog-focus";
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
    const [active, setActive] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);
    const zoom = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const src = images[active];
    function move(offset: number) {
        if (images.length > 1) setActive((i) => (i + offset + images.length) % images.length);
    }
    useEffect(() => {
        if (!zoomOpen) return;
        const old = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = old;
        };
    }, [zoomOpen]);
    const controls = (inZoom = false) =>
        images.length > 1 && (
            <div
                className={inZoom ? "gallery-navigation zoom-navigation" : "gallery-navigation"}
                dir="ltr"
            >
                <button type="button" aria-label="الصورة السابقة" onClick={() => move(-1)}>
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span aria-live="polite">
                    {active + 1} / {images.length}
                </span>
                <button type="button" aria-label="الصورة التالية" onClick={() => move(1)}>
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>
        );
    return (
        <div className="product-gallery refined-gallery">
            <div className="gallery-stage">
                {src ? (
                    <Image
                        src={src}
                        alt={`${name} — الصورة ${active + 1}`}
                        fill
                        preload={active === 0}
                        sizes="(max-width: 767px) 100vw, 50vw"
                        className="gallery-photo"
                    />
                ) : (
                    <div className="gallery-empty">
                        <ImageIcon size={36} aria-hidden="true" />
                        <p>الصورة قيد التحضير</p>
                    </div>
                )}
                {src && (
                    <button
                        ref={trigger}
                        className="gallery-expand"
                        type="button"
                        onClick={() => {
                            zoom.current?.showModal();
                            setZoomOpen(true);
                        }}
                        aria-label="تكبير صورة المنتج"
                    >
                        <Expand size={18} aria-hidden="true" />
                        <span>تكبير</span>
                    </button>
                )}
                <span className="gallery-position" dir="ltr">
                    {images.length ? active + 1 : 0} / {images.length}
                </span>
            </div>
            <div className="gallery-caption">
                <p>{src ? "شاهدي التفاصيل عن قرب" : "تواصلي معنا للاستفسار عن صور القطعة"}</p>
                {controls()}
            </div>
            {images.length > 1 && (
                <div className="gallery-thumbnails" role="group" aria-label="صور المنتج">
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
                className="gallery-dialog refined-gallery-dialog"
                aria-label={`صور ${name}`}
                onKeyDown={(event) => {
                    trapDialogFocus(event);
                    if (event.key === "ArrowRight") {
                        event.preventDefault();
                        move(1);
                    }
                    if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        move(-1);
                    }
                }}
                onClose={() => {
                    setZoomOpen(false);
                    trigger.current?.focus({ preventScroll: true });
                }}
            >
                <div className="zoom-heading">
                    <p>{name}</p>
                    <button
                        type="button"
                        className="gallery-close"
                        aria-label="إغلاق الصورة"
                        onClick={() => zoom.current?.close()}
                    >
                        <X size={24} aria-hidden="true" />
                    </button>
                </div>
                <div className="zoom-photo">
                    {src && (
                        <Image
                            src={src}
                            alt={`${name} — الصورة ${active + 1}`}
                            fill
                            sizes="100vw"
                            className="gallery-photo"
                        />
                    )}
                </div>
                {controls(true)}
            </dialog>
        </div>
    );
}
