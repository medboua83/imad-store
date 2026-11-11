import Image from "next/image";
import { Expand, X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
    type TouchEvent,
} from "react";
import { trapDialogFocus } from "../layout/dialog-focus";
export function ProductGallery({ images, name, selected, onSelect }: {
    images: string[];
    name: string;
    selected?: string;
    onSelect: (image: string) => void;
}) {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const available = [...new Set(images.filter((src) => src && !failed.has(src)))];
    const active = Math.max(0, selected ? available.indexOf(selected) : 0);
    function fail(src: string) {
        setFailed((previous) => (previous.has(src) ? previous : new Set([...previous, src])));
    }
    const [zoomOpen, setZoomOpen] = useState(false);
    const zoom = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const swipe = useRef<{ x: number; y: number } | null>(null);
    const thumbnails = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const src = available[active];
    const resetHoverZoom = useCallback(() => {
        const frame = stage.current;
        if (!frame) return;
        frame.removeAttribute("data-hover-zoom");
        frame.style.removeProperty("--photo-zoom-x");
        frame.style.removeProperty("--photo-zoom-y");
    }, []);
    useEffect(() => {
        resetHoverZoom();
    }, [src, zoomOpen, resetHoverZoom]);
    function hoverZoom(event: PointerEvent<HTMLDivElement>) {
        const frame = event.currentTarget;
        const photo = frame.querySelector<HTMLImageElement>(".gallery-photo");
        if (
            event.pointerType !== "mouse" ||
            zoomOpen ||
            !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
            !photo?.complete ||
            !photo.naturalWidth ||
            (event.target instanceof Element && event.target.closest("button"))
        ) {
            resetHoverZoom();
            return;
        }
        const box = frame.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const percent = (value: number, size: number) =>
            `${Math.max(0, Math.min(100, (value / size) * 100))}%`;
        // Update only the image's focal point, without rendering the product form on every move.
        frame.style.setProperty("--photo-zoom-x", percent(event.clientX - box.left, box.width));
        frame.style.setProperty("--photo-zoom-y", percent(event.clientY - box.top, box.height));
        frame.setAttribute("data-hover-zoom", "true");
    }
    const revealThumbnail = useCallback((focus = false) => {
        const strip = thumbnails.current;
        const selected = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
        if (!strip || !selected) return;
        if (focus) selected.focus({ preventScroll: true });
        const viewport = strip.getBoundingClientRect(),
            item = selected.getBoundingClientRect();
        const left =
            item.left < viewport.left
                ? item.left - viewport.left
                : item.right > viewport.right
                  ? item.right - viewport.right
                  : 0;
        // Scroll this strip only, including in RTL; never jump the document or the zoom dialog.
        if (left) strip.scrollBy({ left, behavior: "instant" });
    }, []);
    useEffect(() => {
        revealThumbnail();
        const strip = thumbnails.current;
        if (!strip) return;
        if (typeof ResizeObserver === "undefined") {
            const resized = () => revealThumbnail();
            window.addEventListener("resize", resized);
            return () => window.removeEventListener("resize", resized);
        }
        const observer = new ResizeObserver(() => revealThumbnail());
        observer.observe(strip);
        return () => observer.disconnect();
    }, [src, active, available.length, revealThumbnail]);
    function move(offset: number) {
        if (available.length > 1)
            onSelect(available[(active + offset + available.length) % available.length]);
    }
    function navigate(event: KeyboardEvent<HTMLElement>) {
        if (
            available.length < 2 ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        )
            return;
        if (event.key === "ArrowRight") move(1);
        else if (event.key === "ArrowLeft") move(-1);
        else if (event.key === "Home") onSelect(available[0]);
        else if (event.key === "End") onSelect(available[available.length - 1]);
        else return;
        event.preventDefault();
        if (thumbnails.current?.contains(event.currentTarget))
            requestAnimationFrame(() => revealThumbnail(true));
    }
    const touchNavigation = {
        onTouchStart(event: TouchEvent<HTMLDivElement>) {
            swipe.current = null;
            if (
                available.length < 2 ||
                event.touches.length !== 1 ||
                (event.target instanceof Element && event.target.closest("button"))
            )
                return;
            const touch = event.touches[0];
            swipe.current = { x: touch.clientX, y: touch.clientY };
        },
        onTouchMove(event: TouchEvent<HTMLDivElement>) {
            const start = swipe.current;
            if (!start) return;
            if (event.touches.length !== 1) {
                swipe.current = null;
                return;
            }
            const touch = event.touches[0];
            const x = Math.abs(touch.clientX - start.x),
                y = Math.abs(touch.clientY - start.y);
            // Once the gesture becomes vertical, leave the entire gesture to page scrolling.
            if (y > 32 && y > x) swipe.current = null;
        },
        onTouchEnd(event: TouchEvent<HTMLDivElement>) {
            const start = swipe.current;
            swipe.current = null;
            if (!start || event.touches.length || event.changedTouches.length !== 1) return;
            const touch = event.changedTouches[0];
            const x = touch.clientX - start.x,
                y = touch.clientY - start.y;
            if (Math.abs(x) >= 48 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1);
        },
        onTouchCancel() {
            swipe.current = null;
        },
    };
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
                <button
                    type="button"
                    aria-label="الصورة السابقة"
                    onKeyDown={inZoom ? undefined : navigate}
                    onClick={() => move(-1)}
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span aria-live="polite">
                    {active + 1} / {available.length}
                </span>
                <button
                    type="button"
                    aria-label="الصورة التالية"
                    onKeyDown={inZoom ? undefined : navigate}
                    onClick={() => move(1)}
                >
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>
        );
    return (
        <div className="product-gallery refined-gallery">
            <div
                ref={stage}
                className="gallery-stage"
                onPointerMove={hoverZoom}
                onPointerLeave={resetHoverZoom}
                onPointerCancel={resetHoverZoom}
                {...touchNavigation}
            >
                {src ? (
                    <Image
                        src={src}
                        onError={() => fail(src)}
                        alt={`${name} — الصورة ${active + 1}`}
                        fill
                        preload={active === 0}
                        loading={active === 0 ? undefined : "eager"}
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
                        onKeyDown={navigate}
                        onClick={() => {
                            resetHoverZoom();
                            zoom.current?.showModal();
                            setZoomOpen(true);
                        }}
                        aria-label="تكبير صورة المنتج"
                    >
                        <Expand size={18} aria-hidden="true" />
                        <span>تكبير</span>
                    </button>
                )}
            </div>
            {available.length > 1 && (
                <div className="gallery-tools">
                    <div
                        ref={thumbnails}
                        className="gallery-thumbnails"
                        role="group"
                        aria-label="صور المنتج"
                    >
                        {available.map((image, i) => (
                            <button
                                key={`${image}-${i}`}
                                type="button"
                                aria-label={`عرض الصورة ${i + 1}`}
                                aria-pressed={active === i}
                                onKeyDown={navigate}
                                onClick={() => onSelect(image)}
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
                    <div className="gallery-caption">{controls()}</div>
                </div>
            )}
            <dialog
                ref={zoom}
                className="gallery-dialog refined-gallery-dialog"
                aria-label={`صور ${name}`}
                onKeyDown={(event) => {
                    trapDialogFocus(event);
                    navigate(event);
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
                <div className="zoom-photo" {...touchNavigation}>
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
