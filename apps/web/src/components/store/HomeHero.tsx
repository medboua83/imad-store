"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, ArrowUpLeft } from "lucide-react";
import { ProductPhoto } from "./ProductPhoto";

export type HeroSlide = {
    id: string;
    images: string[];
    name: string;
    href: string;
    price?: number;
};

/** Only the current original photo is mounted; the copy and layout stay stable. */
export function HomeHero({
    slides,
    children,
    preview = false,
}: {
    slides: HeroSlide[];
    children: ReactNode;
    preview?: boolean;
}) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(preview);
    const [hovered, setHovered] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(true);
    const [visible, setVisible] = useState(false);
    const [inView, setInView] = useState(false);
    const root = useRef<HTMLElement>(null);
    const activeIndex = index % Math.max(1, slides.length);
    const active = slides[activeIndex];
    const multiple = slides.length > 1;
    const playing = multiple && !paused && !reducedMotion && !hovered && visible && inView;

    useEffect(() => {
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const updateMotion = () => setReducedMotion(motion.matches);
        const updateVisibility = () => setVisible(!document.hidden);
        updateMotion();
        updateVisibility();
        motion.addEventListener("change", updateMotion);
        document.addEventListener("visibilitychange", updateVisibility);
        const observer =
            typeof IntersectionObserver === "undefined"
                ? null
                : new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
                      threshold: 0.25,
                  });
        if (root.current && observer) observer.observe(root.current);
        return () => {
            motion.removeEventListener("change", updateMotion);
            document.removeEventListener("visibilitychange", updateVisibility);
            observer?.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!playing) return;
        const timer = window.setInterval(
            () => setIndex((current) => (current + 1) % slides.length),
            7000,
        );
        return () => window.clearInterval(timer);
    }, [playing, slides.length]);

    // Replacing the play/pause SVG under the pointer can detach the mouseout target.
    // Check the actual pointer target as well, so hover never remains latched outside.
    useEffect(() => {
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setHovered(false);
        };
        document.addEventListener("pointermove", outside, { passive: true });
        return () => document.removeEventListener("pointermove", outside);
    }, []);

    const move = (direction: number) => {
        setPaused(true);
        setIndex((current) => (current + direction + slides.length) % slides.length);
    };

    if (!active) return null;
    return (
        <section
            ref={root}
            className="home-hero-carousel"
            data-rotation-state={
                paused
                    ? "paused"
                    : reducedMotion
                      ? "reduced-motion"
                      : hovered
                        ? "hovered"
                        : !visible
                          ? "hidden-tab"
                          : !inView
                            ? "offscreen"
                            : "playing"
            }
            aria-label="مختارات IMAD Mode"
            aria-roledescription="عارض المنتجات"
            onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setHovered(true);
            }}
            onPointerLeave={() => setHovered(false)}
            onFocusCapture={(event) => {
                if (event.target.matches(":focus-visible")) setPaused(true);
            }}
        >
            <div className="editorial-hero">
                {children}
                <div className="hero-visual">
                    <ProductPhoto
                        key={active.id}
                        images={active.images}
                        name={active.name}
                        preload={activeIndex === 0}
                        eager={activeIndex !== 0}
                        sizes="(max-width: 767px) calc(45vw - 12px), 336px"
                        className="hero-photo"
                    />
                </div>
            </div>
            <div className="hero-carousel-bar">
                <div
                    className="hero-product-summary"
                    aria-live={playing ? "off" : "polite"}
                    aria-atomic="true"
                >
                    <Link
                        prefetch={false}
                        href={active.href}
                        className="hero-product-link"
                        target={preview ? "_blank" : undefined}
                        rel={preview ? "noopener noreferrer" : undefined}
                    >
                        <span>{active.name}</span>
                        <ArrowUpLeft size={16} aria-hidden="true" />
                    </Link>
                    {active.price !== undefined && (
                        <span className="hero-product-price" dir="ltr">
                            {new Intl.NumberFormat("fr-MA", {
                                style: "currency",
                                currency: "MAD",
                            }).format(active.price)}
                        </span>
                    )}
                </div>
                {multiple && (
                    <div
                        className="hero-carousel-controls"
                        role="group"
                        aria-label="التحكم في عرض المنتجات"
                        dir="ltr"
                    >
                        <button type="button" onClick={() => move(-1)} aria-label="المنتج السابق">
                            <ChevronLeft size={20} aria-hidden="true" />
                        </button>
                        <span
                            className="hero-slide-count"
                            aria-label={`المنتج ${activeIndex + 1} من ${slides.length}`}
                        >
                            {activeIndex + 1} / {slides.length}
                        </span>
                        <button type="button" onClick={() => move(1)} aria-label="المنتج التالي">
                            <ChevronRight size={20} aria-hidden="true" />
                        </button>
                        {!reducedMotion && (
                            <button
                                type="button"
                                onClick={() => setPaused((current) => !current)}
                                aria-label={
                                    paused ? "تشغيل العرض التلقائي" : "إيقاف العرض التلقائي"
                                }
                            >
                                {paused ? (
                                    <Play size={17} aria-hidden="true" />
                                ) : (
                                    <Pause size={17} aria-hidden="true" />
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
