"use client";
import Image from "next/image";
import { Expand, X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trapDialogFocus } from "../layout/dialog-focus";
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
    const [selected, setSelected] = useState(images[0]);
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const available = [...new Set(images.filter((src) => src && !failed.has(src)))];
    const active = Math.max(0, available.indexOf(selected));
    function fail(src: string) {
        setFailed((previous) => (previous.has(src) ? previous : new Set([...previous, src])));
    }
    const [zoomOpen, setZoomOpen] = useState(false);
    const zoom = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const src = available[active];
    function move(offset: number) {
        if (available.length > 1)
            setSelected(available[(active + offset + available.length) % available.length]);
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
        available.length > 1 && (
            <div
                className={inZoom ? "gallery-navigation zoom-navigation" : "gallery-navigation"}
                dir="ltr"
            >
                <button type="button" aria-label="الصورة السابقة" onClick={() => move(-1)}>
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span aria-live="polite">
                    {active + 1} / {available.length}
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
                        onError={() => fail(src)}
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
                    {available.length ? active + 1 : 0} / {available.length}
                </span>
            </div>
            <div className="gallery-caption">
                <p>{src ? "شاهدوا التفاصيل عن قرب" : "تواصلوا معنا للاستفسار عن صور القطعة"}</p>
                {controls()}
            </div>
            {available.length > 1 && (
                <div className="gallery-thumbnails" role="group" aria-label="صور المنتج">
                    {available.map((image, i) => (
                        <button
                            key={`${image}-${i}`}
                            type="button"
                            aria-label={`عرض الصورة ${i + 1}`}
                            aria-pressed={active === i}
                            onClick={() => setSelected(image)}
                        >
                            <Image
                                src={image}
                                alt=""
                                fill
                                sizes="80px"
                                className="gallery-photo"
                                onError={() => fail(image)}
                            />
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
                    {src ? (
                        <Image
                            src={src}
                            onError={() => fail(src)}
                            alt={`${name} — الصورة ${active + 1}`}
                            fill
                            sizes="100vw"
                            className="gallery-photo"
                        />
                    ) : (
                        <div className="gallery-empty">
                            <ImageIcon size={36} aria-hidden="true" />
                            <p>الصورة قيد التحضير</p>
                        </div>
                    )}
                </div>
                {controls(true)}
            </dialog>
        </div>
    );
}
