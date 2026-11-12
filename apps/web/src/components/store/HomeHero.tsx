"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, ArrowUpLeft } from "lucide-react";
import { ProductPhoto } from "./ProductPhoto";

export type HeroSlide = {
  id: string;
  images: string[];
  name: string;
  href: string;
  price?: number;
  compareAtPrice?: number;
  description?: string;
  colors?: { value: string; label: string }[];
};

/** Photo and merchandise copy always resolve from the same active slide. */
export function HomeHero({
  slides,
  children,
  brand,
  collectionHref,
  preview = false,
  autoplay = true,
  minimalControls = true,
}: {
  slides: HeroSlide[];
  children: ReactNode;
  brand: string;
  collectionHref: string;
  preview?: boolean;
  autoplay?: boolean;
  minimalControls?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(preview);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const hint = useId();
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const root = useRef<HTMLElement>(null);
  const activeIndex = index % Math.max(1, slides.length);
  const active = slides[activeIndex];
  const multiple = slides.length > 1;
  const playing =
    multiple && autoplay && !paused && !reducedMotion && !hovered && visible && inView;

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
    const timer = window.setInterval(() => {
      setHasAdvanced(true);
      setIndex((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [playing, slides.length]);

  // Warm only the next original while rotating; do not fetch every slide at startup.
  useEffect(() => {
    if (!playing || preview) return;
    const source = slides[(activeIndex + 1) % slides.length]?.images[0];
    if (!source) return;
    const nextPhoto = new window.Image();
    nextPhoto.decoding = "async";
    nextPhoto.fetchPriority = "low";
    nextPhoto.src = source;
  }, [activeIndex, playing, preview, slides]);

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
    setHasAdvanced(true);
    setIndex((current) => (current + direction + slides.length) % slides.length);
  };

  if (!active) return null;
  return (
    <section
      ref={root}
      className={`home-hero-carousel${minimalControls ? " hero-minimal" : ""}`}
      data-rotation-state={
        !autoplay
          ? "manual"
          : paused
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
      aria-describedby={hint}
      onPointerDownCapture={(event) => {
        if (event.pointerType !== "touch") return;
        setPaused(true);
        if (
          multiple &&
          event.target instanceof Element &&
          event.target.closest(".hero-visual") &&
          !event.target.closest("button, a")
        )
          touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUpCapture={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x,
          dy = event.clientY - start.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
      }}
      onPointerCancelCapture={() => {
        touch.current = null;
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setPaused(true);
      }}
    >
      <p id={hint} className="sr-only">
        على الهاتف، يوقف اللمس العرض التلقائي ويمكن السحب على الصورة لتغيير المنتج. تظهر أزرار
        التنقل والإيقاف عند استخدامها بلوحة المفاتيح.
      </p>
      <div className="editorial-hero">
        {active.price !== undefined ? (
          <div className="hero-copy hero-showcase-copy">
            <p className="hero-eyebrow">
              <span aria-hidden="true" />
              <bdi>{brand}</bdi>
            </p>
            <div
              className="hero-product-summary"
              aria-live={playing ? "off" : "polite"}
              aria-atomic="true"
            >
              <div
                key={active.id}
                className={`hero-product-content${hasAdvanced ? " hero-copy-arrival" : ""}`}
              >
                <h1 dir="auto">{active.name}</h1>
                {active.description && (
                  <p className="hero-product-description" dir="auto">
                    {active.description}
                  </p>
                )}
                <div className="hero-price-row">
                  <span className="hero-product-price" dir="ltr">
                    {new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
                      active.price,
                    )}
                  </span>
                  {active.compareAtPrice !== undefined && active.compareAtPrice > active.price && (
                    <del dir="ltr">
                      {new Intl.NumberFormat("fr-MA", {
                        style: "currency",
                        currency: "MAD",
                      }).format(active.compareAtPrice)}
                    </del>
                  )}
                </div>
                {!!active.colors?.length && (
                  <div className="hero-product-colors" role="group" aria-label="الألوان المتوفرة">
                    <span className="hero-colors-label">الألوان</span>
                    {active.colors.slice(0, 4).map((color) => (
                      <span
                        key={color.value}
                        className="hero-color-swatch"
                        role="img"
                        aria-label={color.label}
                        title={color.label}
                      >
                        {/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.value) ? (
                          <i style={{ backgroundColor: color.value }} aria-hidden="true" />
                        ) : (
                          <span>{color.label}</span>
                        )}
                      </span>
                    ))}
                    {active.colors.length > 4 && (
                      <span
                        className="hero-colors-more"
                        aria-label={`${active.colors.length - 4} ألوان إضافية`}
                      >
                        <bdi>+{active.colors.length - 4}</bdi>
                      </span>
                    )}
                  </div>
                )}
                <div className="hero-actions">
                  <Link
                    prefetch={false}
                    href={active.href}
                    className="btn-primary hero-product-link"
                    target={preview ? "_blank" : undefined}
                    rel={preview ? "noopener noreferrer" : undefined}
                  >
                    اكتشفوا هذا المنتج <ArrowUpLeft size={18} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
            {collectionHref.startsWith("#") ? (
              <a className="hero-collection-link" href={collectionHref}>
                شاهدوا المجموعة كاملة
              </a>
            ) : (
              <Link
                prefetch={false}
                className="hero-collection-link"
                href={collectionHref}
                target={preview ? "_blank" : undefined}
                rel={preview ? "noopener noreferrer" : undefined}
              >
                شاهدوا المجموعة كاملة
              </Link>
            )}
          </div>
        ) : (
          children
        )}
        <div className="hero-visual">
          <ProductPhoto
            key={active.id}
            images={active.images}
            name={active.name}
            preload={activeIndex === 0}
            eager={activeIndex !== 0}
            sizes="(max-width: 767px) 48vw, 352px"
            className={`hero-photo${hasAdvanced ? " hero-photo-arrival" : ""}`}
          />
          {multiple && minimalControls && (
            <div className="hero-image-arrows" dir="ltr">
              <button type="button" onClick={() => move(-1)} aria-label="المنتج السابق">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(1)} aria-label="المنتج التالي">
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
      {multiple && (
        <div className="hero-carousel-bar">
          <div
            className="hero-carousel-controls"
            role="group"
            aria-label="التحكم في عرض المنتجات"
            dir="ltr"
          >
            {!minimalControls && (
              <button type="button" onClick={() => move(-1)} aria-label="المنتج السابق">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
            )}
            <span
              className={`hero-slide-count${minimalControls ? " sr-only" : ""}`}
              aria-label={`المنتج ${activeIndex + 1} من ${slides.length}`}
            >
              {activeIndex + 1} / {slides.length}
            </span>
            {!minimalControls && (
              <button type="button" onClick={() => move(1)} aria-label="المنتج التالي">
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            )}
            {minimalControls && (
              <div className="hero-slide-dots" role="group" aria-label="اختيار منتج من العرض">
                {slides.map((slide, number) => (
                  <button
                    type="button"
                    key={slide.id}
                    aria-label={`عرض المنتج ${number + 1} من ${slides.length}`}
                    aria-pressed={number === activeIndex}
                    onClick={() => {
                      setPaused(true);
                      setHasAdvanced(true);
                      setIndex(number);
                    }}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {autoplay && !reducedMotion && (
              <button
                className="hero-pause-toggle"
                type="button"
                onClick={() => setPaused((current) => !current)}
                aria-label={paused ? "تشغيل العرض التلقائي" : "إيقاف العرض التلقائي"}
              >
                {paused ? (
                  <Play size={17} aria-hidden="true" />
                ) : (
                  <Pause size={17} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
