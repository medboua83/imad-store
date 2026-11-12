"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ProductPhoto } from "./ProductPhoto";

type CategoryItem = { id: string; name: string; href: string; images: string[] };

function position(track: HTMLElement) {
  const cards = [...track.children] as HTMLElement[];
  const bounds = track.getBoundingClientRect();
  const rtl = getComputedStyle(track).direction === "rtl";
  const edge = rtl ? bounds.right : bounds.left;
  const distances = cards.map((card) => {
    const box = card.getBoundingClientRect();
    return Math.abs((rtl ? box.right : box.left) - edge);
  });
  const first = cards[0]?.getBoundingClientRect();
  const last = cards.at(-1)?.getBoundingClientRect();
  return {
    overflow: track.scrollWidth > track.clientWidth + 2,
    index: distances.length ? distances.indexOf(Math.min(...distances)) : 0,
    start: !first || (rtl ? first.right <= bounds.right + 2 : first.left >= bounds.left - 2),
    end: !last || (rtl ? last.left >= bounds.left - 2 : last.right <= bounds.right + 2),
  };
}

export function HomeCategoryRail({
  items,
  preview = false,
}: {
  items: CategoryItem[];
  preview?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLElement>(null);
  const direction = useRef(1);
  const id = useId();
  const [layout, setLayout] = useState({
    mobile: false,
    overflow: false,
    index: 0,
    start: true,
    end: true,
  });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const playing =
    layout.mobile &&
    layout.overflow &&
    !preview &&
    !paused &&
    !hovered &&
    !reduced &&
    visible &&
    inView;

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const mobile = matchMedia("(max-width: 767px)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      const next = { mobile: mobile.matches, ...position(element) };
      setLayout((old) =>
        Object.keys(next).every(
          (key) => old[key as keyof typeof old] === next[key as keyof typeof next],
        )
          ? old
          : next,
      );
    };
    const updateMotion = () => setReduced(motion.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    measure();
    updateMotion();
    updateVisibility();
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.5,
    });
    if (root.current) observer.observe(root.current);
    element.addEventListener("scroll", measure, { passive: true });
    mobile.addEventListener("change", measure);
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      resize.disconnect();
      observer.disconnect();
      element.removeEventListener("scroll", measure);
      mobile.removeEventListener("change", measure);
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [items.length]);

  const move = useCallback(
    (step: number) => {
      const element = track.current;
      if (!element) return;
      const current = position(element);
      if (!current.overflow || (step > 0 && current.end) || (step < 0 && current.start)) return;
      const target =
        element.children[Math.max(0, Math.min(items.length - 1, current.index + step))];
      if (!target) return;
      const bounds = element.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const rtl = getComputedStyle(element).direction === "rtl";
      // Scroll the rail only: scrollIntoView would also move the entire page.
      element.scrollBy({
        left: rtl ? box.right - bounds.right : box.left - bounds.left,
        behavior: reduced ? "instant" : "smooth",
      });
    },
    [items.length, reduced],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!track.current) return;
      const current = position(track.current);
      // Reverse gently at the edge, without clones or a jump across the whole list.
      if (current.end) direction.current = -1;
      else if (current.start) direction.current = 1;
      move(direction.current);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [playing, move]);

  if (!items.length) return null;
  return (
    <div
      ref={root}
      className="home-category-rail"
      data-many={items.length > 3}
      data-rotation-state={
        !layout.mobile
          ? "desktop"
          : !layout.overflow
            ? "no-overflow"
            : preview
              ? "preview"
              : paused
                ? "paused"
                : reduced
                  ? "reduced-motion"
                  : hovered
                    ? "hovered"
                    : !visible
                      ? "hidden-tab"
                      : !inView
                        ? "offscreen"
                        : "playing"
      }
      onPointerDownCapture={(event) => {
        if (event.pointerType === "touch" && !(event.target as Element).closest("button"))
          setPaused(true);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setPaused(true);
      }}
      onWheel={(event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setPaused(true);
      }}
    >
      <nav
        id={id}
        ref={track}
        className="collection-grid"
        aria-label="فئات المتجر"
        style={{ "--category-desktop-columns": Math.min(items.length, 5) } as CSSProperties}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            className="collection-tile"
            prefetch={false}
            href={item.href}
            target={preview ? "_blank" : undefined}
            rel={preview ? "noopener noreferrer" : undefined}
          >
            <span className="collection-photo">
              {item.images.length ? (
                <ProductPhoto images={item.images} name="" sizes="(max-width:767px) 82px, 96px" />
              ) : (
                <span className="category-photo-empty" aria-hidden="true">
                  IMAD
                </span>
              )}
            </span>
            <span className="collection-name">{item.name}</span>
          </Link>
        ))}
      </nav>
      {items.length > 3 && (
        <div
          className="category-rail-controls"
          role="group"
          aria-label="التحكم في تنقل الفئات"
          dir="rtl"
        >
          <button
            type="button"
            aria-label="الفئات السابقة"
            aria-controls={id}
            disabled={layout.start}
            onClick={() => {
              setPaused(true);
              move(-1);
            }}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {!preview && !reduced && (
            <button
              type="button"
              aria-controls={id}
              aria-label={paused ? "تشغيل تنقل الفئات تلقائيًا" : "إيقاف تنقل الفئات تلقائيًا"}
              onClick={() => setPaused((old) => !old)}
            >
              {paused ? (
                <Play size={16} aria-hidden="true" />
              ) : (
                <Pause size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label="الفئات التالية"
            aria-controls={id}
            disabled={layout.end}
            onClick={() => {
              setPaused(true);
              move(1);
            }}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
