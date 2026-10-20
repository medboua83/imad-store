import Link from "next/link";

export const metadata = { title: "تواصلوا معنا", alternates: { canonical: "/contact" } };

export default function ContactPage() {
    return (
        <section className="page-shell" dir="rtl">
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-4xl text-[#1A1A2E]">تواصلوا معنا</h1>
                <p className="leading-8">
                    للاستفسار عن المنتجات أو متابعة طلبكم، تواصلوا مع فريق IMAD Mode عبر واتساب.
                </p>
                <a
                    href="https://wa.me/212660560522"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-[#1A1A2E] text-white px-8 py-4"
                >
                    تواصلوا عبر واتساب
                </a>
                <p>من الإثنين إلى السبت، من 10:00 صباحاً إلى 8:00 مساءً.</p>
                <Link href="/shop" className="block underline">
                    العودة إلى المتجر
                </Link>
            </div>
        </section>
    );
}
