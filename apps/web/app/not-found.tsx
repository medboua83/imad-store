import Link from "next/link";
export default function NotFound() {
    return (
        <section className="page-shell space-y-6">
            <h1 className="text-3xl">الصفحة أو المنتج غير موجود</h1>
            <p>قد يكون المنتج قد أزيل أو تغير عنوانه.</p>
            <Link href="/shop" className="btn-primary">
                العودة إلى المتجر
            </Link>
        </section>
    );
}
