"use client";
import Link from "next/link";
import { useTransition } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function StoreError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="page-shell store-page-error" aria-busy={pending}>
      <span className="store-error-icon">
        <TriangleAlert size={28} aria-hidden="true" />
      </span>
      <h1>تعذر تحميل هذه الصفحة</h1>
      <p role="alert">تحققوا من الاتصال ثم أعيدوا المحاولة. تبقى محتويات السلة محفوظة.</p>
      <div className="store-error-actions">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => startTransition(() => retry())}
        >
          <RefreshCw size={18} aria-hidden="true" />
          {pending ? "جارٍ إعادة التحميل…" : "إعادة المحاولة"}
        </button>
        {/* A full navigation clears this boundary even when only the shop query changes. */}
        <a href="/shop">عرض كل المنتجات</a>
        <Link href="/contact">تواصلوا معنا</Link>
      </div>
    </section>
  );
}
