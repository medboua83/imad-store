"use client";
import { useId, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";

export function ProductShare({ name, url }: { name: string; url: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(false);
  const running = useRef(false);
  const linkId = useId();

  async function perform(copyOnly = false) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!copyOnly && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: name, url });
          // Resolution does not guarantee that a recipient received anything.
          setMessage("يمكنكم مشاركة الرابط مجدداً.");
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            setMessage("تم إلغاء المشاركة.");
          } else {
            setFallback(true);
            setMessage("المشاركة غير متاحة هنا. يمكنكم نسخ الرابط.");
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          setMessage("تم نسخ رابط المنتج.");
        } catch {
          setFallback(true);
          setMessage("تعذر النسخ تلقائياً. حددوا الرابط وانسخوه يدوياً.");
        }
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={`product-share${fallback ? " has-fallback" : ""}`}>
      <button
        type="button"
        className="product-share-trigger"
        aria-label="مشاركة المنتج"
        aria-busy={busy}
        disabled={busy}
        onClick={() => void perform()}
      >
        <Share2 size={16} aria-hidden="true" /> مشاركة
      </button>
      <p
        className="product-share-status"
        role="status"
        aria-label="حالة مشاركة المنتج"
        hidden={!message}
      >
        {message}
      </p>
      {fallback && (
        <div className="product-share-fallback">
          <label htmlFor={linkId}>رابط المنتج</label>
          <div>
            <input
              id={linkId}
              type="text"
              dir="ltr"
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              aria-label="نسخ رابط المنتج"
              disabled={busy}
              onClick={() => void perform(true)}
            >
              <Copy size={16} aria-hidden="true" /> نسخ الرابط
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
