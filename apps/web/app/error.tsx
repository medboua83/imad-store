"use client";
export default function StoreError({ reset }: { reset: () => void }) {
    return (
        <section className="page-shell space-y-6">
            <h1 className="text-3xl">تعذر تحميل هذه الصفحة</h1>
            <p role="alert">تحققوا من الاتصال ثم أعيدوا المحاولة. تبقى محتويات السلة محفوظة.</p>
            <button className="btn-primary" onClick={reset}>
                إعادة المحاولة
            </button>
        </section>
    );
}
