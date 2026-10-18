import Link from "next/link";

export default function ContactPage() {
    return <main className="min-h-[70vh] pt-36 pb-20 px-6 bg-[#FDFAF6]" dir="rtl"><div className="max-w-2xl mx-auto space-y-6"><h1 className="text-4xl text-[#1A1A2E]">تواصل معنا</h1><p className="leading-8">للاستفسار عن المنتجات أو متابعة طلبك، تواصلي مع فريق IMAD Mode عبر واتساب.</p><a href="https://wa.me/212660560522" target="_blank" rel="noopener noreferrer" className="inline-block bg-[#1A1A2E] text-white px-8 py-4">تواصل عبر واتساب</a><p>من الإثنين إلى السبت، من 10:00 صباحاً إلى 8:00 مساءً.</p><Link href="/shop" className="block underline">العودة إلى المتجر</Link></div></main>;
}
