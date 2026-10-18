"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ArrowRight, MessageCircle, Mail, Star } from "lucide-react";
import { getProducts, type Product } from "@/lib/api";

/* ─── Helpers ─────────────────────────────────────────────── */
const fadeUp = {
    hidden: { opacity: 0, y: 50 },
    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const } },
};

/* ─── Mock data ──────────────────────── */
const HERO_SLIDES = [
    {
        id: 1,
        img: "/images/hero-1.png",
        video: null,
        badge: "مجموعة ربيع 2025",
        title: "الأناقة",
        title2: "المطلقة",
        sub: "اكتشفي فن الأزياء الفاخرة. إبداعات حصرية مصممة لتعزيز أناقتك.",
    },
    {
        id: 2,
        img: "/images/hero-2.png",
        video: null,
        badge: "إصدار محدود",
        title: "ليلة",
        title2: "مرصعة بالنجوم",
        sub: "الجمال في كل تفصيلة. تطريز يدوي وحرير مطرز.",
    },
    {
        id: 3,
        img: "/images/cat-abayas.png",
        video: null,
        badge: "أتيليه بريميوم",
        title: "حرفية",
        title2: "استثنائية",
        sub: "أقمشة نبيلة وتفاصيل ملكية مستوحاة من الأندلس.",
    },
];

const CATEGORIES = [
    { slug: "bags", img: "/images/cat-abayas.png", labelAr: "الحقائب" },
    { slug: "abayas", img: "/images/cat-abayas.png", labelAr: "العبايات" },
    { slug: "shailan", img: "/images/hero-1.png", labelAr: "شيلان" },
    { slug: "shoes-women", img: "/images/cat-shoes.png", labelAr: "أحذية نسائية" },
    { slug: "pyjamas", img: "/images/hero-2.png", labelAr: "بيجامات" },
    { slug: "shoes-men", img: "/images/cat-shoes.png", labelAr: "سابو رجالي" },
];



/* ─── Components ─────────────────────────────────────────── */

function HeroSection() {
    const [active, setActive] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
    const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const textY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    useEffect(() => {
        const timer = setInterval(() => {
            setActive((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    const slide = HERO_SLIDES[active];

    return (
        <section ref={containerRef} className="relative h-screen min-h-[800px] bg-[#1A1A2E] overflow-hidden flex items-center justify-center">
            {/* Cinematic Image Background with deep zoom scale */}
            <motion.div style={{ y: imgY, scale: 1.05 }} className="absolute inset-0">
                <AnimatePresence>
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 1.8, ease: "easeInOut" }}
                        className="absolute inset-0"
                    >
                        <Image src={slide.img} alt={slide.title} fill className="object-cover object-[center_20%] opacity-50" priority />
                        {/* Vignette effect */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#1A1A2E]/50 to-[#1A1A2E] opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-[#1A1A2E]/20 to-[#1A1A2E]/80" />
                    </motion.div>
                </AnimatePresence>
            </motion.div>

            {/* Content — Luxury Brand Center */}
            <motion.div style={{ y: textY, opacity }} className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 min-h-[300px]" aria-live="polite">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, y: -20, transition: { duration: 0.5 } }}
                        className="flex flex-col items-center max-w-4xl mx-auto text-center gap-8"
                    >
                        {/* Brand label */}
                        <motion.p variants={fadeUp} className="text-[#C9A96E] text-[10px] md:text-[11px] tracking-[0.5em] uppercase font-medium flex items-center gap-4">
                            <span className="w-8 h-px bg-[#C9A96E]/60" />
                            IMAD MODE — المغرب
                            <span className="w-8 h-px bg-[#C9A96E]/60" />
                        </motion.p>

                        {/* Main headline */}
                        <motion.h1
                            variants={fadeUp}
                            className="text-white leading-[1.3] font-medium max-w-5xl mx-auto"
                            style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
                            dir="rtl"
                        >
                            <>
                                🔥الهمة والأناقة لي كتقلبي عليها... اختاري لي يواتيك وتميزي بإطلالة{" "}
                                <em className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A96E] via-[#F0D89A] to-[#C9A96E] not-italic font-bold">
                                    كتحمق ✨
                                </em>
                            </>
                        </motion.h1>

                        {/* Categories */}
                        <motion.p
                            variants={fadeUp}
                            className="text-[#C9A96E] text-[10px] md:text-[12px] tracking-[0.2em] uppercase max-w-sm mb-4"
                        >
                            الحقائب • العبايات • شيلان • أحذية نسائية • بيجامات • سابو رجالي
                        </motion.p>

                        {/* CTA */}
                        <motion.div variants={fadeUp}>
                            <Link
                                href="/shop"
                                className="group inline-flex items-center gap-4 bg-transparent border border-[#C9A96E] text-[#C9A96E] text-[10px] tracking-[0.35em] uppercase px-12 py-5 font-medium transition-all duration-500 hover:bg-[#C9A96E] hover:text-white"
                            >
                                اكتشفي المجموعة
                                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1 rotate-180" />
                            </Link>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </motion.div>

            {/* Ultra-minimal slide indicators */}
            <div className="absolute bottom-12 inset-x-0 flex justify-center gap-3">
                {HERO_SLIDES.map((_, i) => (
                    <button
                        key={i}
                        aria-label={`الشريحة ${i + 1}`}
                        aria-pressed={i === active}
                        onClick={() => setActive(i)}
                        className="relative group py-2"
                    >
                        <div className={`w-8 h-[2px] transition-all duration-700 ${i === active ? "bg-[#C9A96E]" : "bg-white/20 group-hover:bg-white/40"}`} />
                        {i === active && (
                            <motion.div layoutId="active-nav" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] bg-[#C9A96E] blur-[2px]" />
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
}

function MarqueeBar() {
    const BUBBLE_ITEMS = [
        { img: "/images/cat-abayas.png", slug: "bags", labelAr: "الحقائب" },
        { img: "/images/cat-abayas.png", slug: "abayas", labelAr: "العبايات" },
        { img: "/images/hero-1.png", slug: "shailan", labelAr: "شيلان" },
        { img: "/images/cat-shoes.png", slug: "shoes-women", labelAr: "أحذية نسائية" },
        { img: "/images/hero-2.png", slug: "pyjamas", labelAr: "بيجامات" },
        { img: "/images/cat-shoes.png", slug: "shoes-men", labelAr: "سابو رجالي" },
    ];

    const MarqueeBlock = () => (
        <div className="flex gap-6 md:gap-12 items-center px-3 md:px-6">
            {BUBBLE_ITEMS.map((item, i) => (
                <Link
                    key={i}
                    href={`/shop?category=${item.slug}`}
                    className="flex flex-col items-center gap-4 group cursor-pointer w-12 md:w-20 flex-shrink-0"
                >
                    <div className="w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden relative border-2 border-[#C9A96E]/20 group-hover:border-[#C9A96E] transition-colors duration-500 shadow-xl">
                        <Image
                            src={item.img}
                            alt={item.slug}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-[1.5s] ease-out"
                        />
                    </div>
                    <span className="text-[#1A1A2E] text-[9px] md:text-[10px] tracking-[0.15em] font-bold text-center" dir="rtl">
                        {item.labelAr}
                    </span>
                </Link>
            ))}
        </div>
    );

    return (
        <div className="bg-[#FDFAF6] py-14 md:py-24 border-b border-[#1A1A2E]/5 overflow-hidden">
            <div className="text-center mb-10 md:mb-14">
                <h3 className="text-[#1A1A2E] text-2xl md:text-3xl uppercase tracking-[0.3em] font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    مجموعاتنا
                </h3>
                <div className="w-16 h-px bg-[#C9A96E]/60 mx-auto mt-6" />
            </div>

            <div className="relative w-full flex whitespace-nowrap" dir="ltr">
                <div
                    className="flex w-max"
                    style={{ animation: "bubble-marquee 35s linear infinite" }}
                >
                    <MarqueeBlock />
                    <MarqueeBlock />
                    <MarqueeBlock />
                    <MarqueeBlock />
                    <MarqueeBlock />
                    <MarqueeBlock />
                </div>
            </div>
            <style>{`
                @keyframes bubble-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(calc(-100% / 6)); }
                }
            `}</style>
        </div>
    );
}

function CollectionGallery() {
    return (
        <section className="bg-[#1A1A2E] py-20 md:py-28 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <motion.div
                    initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
                    className="flex flex-col items-center text-center mb-14 md:mb-20"
                >
                    <motion.p variants={fadeUp} className="text-[#C9A96E] text-[13px] tracking-[0.4em] uppercase mb-4">
                        مجموعاتنا
                    </motion.p>
                    <motion.h2 variants={fadeUp}
                        className="text-white font-light"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.2rem, 6vw, 4.5rem)", letterSpacing: "0.05em" }}
                    >
                        أحدث <em className="text-[#C9A96E] italic">عروضنا</em>
                    </motion.h2>
                    <motion.div variants={fadeUp} className="w-12 h-px bg-[#C9A96E]/40 mx-auto mt-8" />
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4" dir="rtl">
                    {CATEGORIES.slice(0, 2).map((cat, i) => (
                        <motion.div
                            key={cat.slug}
                            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.1 }}
                            className="col-span-2 md:col-span-3 h-[260px] md:h-[440px] relative group overflow-hidden"
                        >
                            <BentoCard cat={cat} large />
                        </motion.div>
                    ))}

                    {CATEGORIES.slice(2).map((cat, i) => (
                        <motion.div
                            key={cat.slug}
                            initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.06 * i }}
                            className="col-span-1 md:col-span-2 h-[200px] md:h-[320px] relative group overflow-hidden"
                        >
                            <BentoCard cat={cat} />
                        </motion.div>
                    ))}
                </div>

                <div className="flex justify-center mt-12 md:mt-16">
                    <Link
                        href="/shop"
                        className="group inline-flex items-center gap-4 border border-[#C9A96E]/40 text-[#C9A96E] text-[13px] tracking-[0.2em] uppercase px-12 py-4 hover:bg-[#C9A96E] hover:text-white transition-all duration-300"
                    >
                        تصفح كامل المجموعة
                        <span className="w-8 h-px bg-current group-hover:w-12 transition-all duration-300" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

function BentoCard({ cat, large }: { cat: typeof CATEGORIES[0]; large?: boolean }) {
    return (
        <Link href={`/shop?category=${cat.slug}`} className="block w-full h-full relative">
            <Image
                src={cat.img}
                alt={cat.labelAr}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-[2s] ease-[cubic-bezier(0.25,1,0.5,1)]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E]/90 via-[#1A1A2E]/20 to-transparent" />
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#C9A96E]/50 transition-all duration-500 pointer-events-none" />

            <div className="absolute bottom-0 inset-x-0 p-5 md:p-8">
                <h3
                    className="text-white font-light leading-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: large ? "clamp(1.8rem, 4vw, 2.8rem)" : "clamp(1.3rem, 2.5vw, 2rem)" }}
                    dir="rtl"
                >
                    {cat.labelAr}
                </h3>
                <div className="flex items-center gap-2 mt-3 text-[#C9A96E] text-[11px] md:text-[12px] tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    <span className="w-5 h-px bg-[#C9A96E]" />
                    اكتشفي
                </div>
            </div>
        </Link>
    );
}

function CatalogHighlights({ products, loading, error }: { products: Product[]; loading: boolean; error: boolean }) {
    return <section className="bg-[#1A1A2E] py-20 text-white" dir="rtl">
        <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-center justify-between gap-5 mb-10"><h2 className="text-3xl text-[#C9A96E]">مختارات من المتجر</h2><Link href="/shop" className="underline underline-offset-4">عرض المجموعة</Link></div>
            {loading ? <p role="status">جارٍ تحميل المنتجات...</p> : error ? <p role="alert">تعذر تحميل المنتجات. <Link href="/shop" className="underline">الانتقال إلى المتجر</Link></p> : products.length === 0 ? <p>لا توجد منتجات متاحة حالياً.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {products.map(product => {
                    const name = product.nameAr || product.nameFr || product.nameEn;
                    const image = product.images.find(value => (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\/(res\.cloudinary\.com|placeholder\.co)\//.test(value));
                    return <Link key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="group block border border-white/10 bg-white/5">
                        <div className="relative aspect-[3/4] bg-[#F5EDE0] overflow-hidden">{image ? <Image src={image} alt={name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform group-hover:scale-105"/> : <span className="absolute inset-0 flex items-center justify-center text-gray-500">لا توجد صورة</span>}</div>
                        <div className="p-5"><h3 className="text-xl mb-3">{name}</h3><p>{product.price.toLocaleString()} MAD</p><span className="inline-block mt-4 text-[#C9A96E]">عرض التفاصيل</span></div>
                    </Link>;
                })}
            </div>}
        </div>
    </section>;
}

function MaisonStory() {
    return (
        <section className="bg-[#FDFAF6] relative overflow-hidden py-32 md:py-48">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none opacity-[0.03] overflow-hidden whitespace-nowrap">
                <span className="text-[30vw] font-bold tracking-tighter text-[#1A1A2E]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    IMAD
                </span>
            </div>

            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 md:gap-24 items-center">

                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="relative aspect-[3/4] w-full max-w-md mx-auto md:mr-auto"
                >
                    <Image src="/images/hero-2.png" alt="الدار" fill className="object-cover" />
                    <div className="absolute -inset-4 border border-[#C9A96E]/40 pointer-events-none translate-y-8 translate-x-8" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                    className="flex flex-col relative z-10"
                >
                    <p className="text-[#C9A96E] text-[10px] tracking-[0.4em] uppercase mb-8 flex items-center gap-4">
                        <span className="w-12 h-px bg-[#C9A96E]" />
                        قصة الدار
                    </p>
                    <h2 className="text-[#1A1A2E] text-4xl md:text-6xl font-black uppercase tracking-[0.1em] leading-tight mb-8">
                        فن <br />
                        <em className="text-[#C9A96E] font-serif font-light italic normal-case tracking-normal text-5xl md:text-7xl block mt-2">
                            الأناقة
                        </em>
                    </h2>
                    <p className="text-[#1A1A2E]/60 text-sm md:text-base leading-relaxed mb-6 font-light">
                        تجسد كل قطعة من تجميعتنا التوازن المثالي بين الحشمة والرقي. تصاميمنا ليست مجرد أزياء، بل هي قصة تُروى بخيوط من الحرير ولمسات من الذهب.
                    </p>
                    <p className="text-[#1A1A2E]/60 text-sm md:text-base leading-relaxed mb-12 font-light">
                        صُنعت في ورشنا بأيدي خبراء، كل تفصيلة تحتفي بالمرأة العصرية.
                    </p>

                    <Link href="/contact" className="flex items-center gap-4 group self-start">
                        <span className="w-14 h-14 rounded-full border border-[#1A1A2E]/20 flex items-center justify-center group-hover:border-[#C9A96E] transition-colors">
                            <Mail size={16} className="text-[#1A1A2E] group-hover:text-[#C9A96E] transition-colors" />
                        </span>
                        <span className="text-[#1A1A2E] font-medium text-[10px] tracking-[0.3em] uppercase group-hover:text-[#C9A96E] transition-colors">
                            تواصل معنا
                        </span>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}

function WhatsAppCTA() {
    const phone = "212660560522";
    return (
        <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="fixed bottom-8 end-8 z-50 flex items-center justify-center group gap-3">
            <div className="bg-white/90 backdrop-blur border border-[#C9A96E] px-5 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none hidden md:block">
                <span className="text-[#1A1A2E] text-[15px] tracking-widest font-bold uppercase whitespace-nowrap">
                    تواصل معنا
                </span>
            </div>
            <div className="relative">
                <span className="absolute inline-flex w-24 h-24 rounded-full bg-[#C9A96E]/30 animate-ping-gold left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <span className="relative w-20 h-20 rounded-full bg-[#1A1A2E] border-2 border-[#C9A96E] flex items-center justify-center shadow-2xl group-hover:bg-[#C9A96E] group-hover:border-white transition-all duration-300">
                    <MessageCircle size={36} className="text-[#C9A96E] group-hover:text-white transition-colors" />
                </span>
            </div>
        </a>
    );
}

const TESTIMONIALS = [
    { id: 1, img: "/images/hero-1.png", quoteAr: "التعريف المطلق للرفاهية المحتشمة. التشطيبات مثالية بشكل مذهل.", author: "نور الس.", role: "لندن", tag: "إصدار الحرير" },
    { id: 2, img: "/images/hero-2.png", quoteAr: "ارتداء هذه القطع يجعلك تشعرين كالملوك. ثنيات مهيبة وانسيابية.", author: "صوفيا م.", role: "باريس", tag: "مجموعة خاصة" },
    { id: 3, img: "/images/cat-abayas.png", quoteAr: "الأناقة في أنقى صورها. الاهتمام بالتفاصيل يضاهي أكبر دور الأزياء.", author: "ليلى ك.", role: "دبي", tag: "هاوت كوتور" },
];

function Testimonials() {
    const [active, setActive] = useState(0);

    return (
        <section className="bg-[#1A1A2E] py-32 md:py-48 font-light overflow-hidden">
            <div className="max-w-[1400px] mx-auto px-6 relative">
                <div className="flex flex-col items-center mb-16 md:mb-32">
                    <p className="flex items-center gap-4 text-[#C9A96E] text-[10px] tracking-[0.4em] uppercase mb-4">
                        <span className="w-12 h-px bg-[#C9A96E]/50" />
                        آراء
                        <span className="w-12 h-px bg-[#C9A96E]/50" />
                    </p>
                    <h2 className="text-white text-4xl md:text-6xl font-black uppercase tracking-widest flex flex-wrap justify-center items-center gap-x-4">
                        صوت
                        <em className="text-[#C9A96E] font-serif font-light italic normal-case tracking-normal text-5xl md:text-7xl">
                            عملائنا
                        </em>
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 items-center gap-16 md:gap-24 relative z-10">
                    <div className="order-2 md:order-1 flex flex-col justify-center">
                        <AnimatePresence>
                            <motion.div
                                key={active}
                                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                                className="relative"
                            >
                                <div className="text-[#C9A96E] opacity-10 text-[250px] leading-[0] absolute -top-10 -left-8 md:-left-16 font-serif select-none pointer-events-none">
                                    &quot;
                                </div>
                                <h3 className="text-white text-3xl md:text-5xl lg:text-6xl leading-[1.3] mb-12 relative z-10" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                    {TESTIMONIALS[active].quoteAr}
                                </h3>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-white text-[12px] tracking-[0.25em] uppercase font-bold mb-2">{TESTIMONIALS[active].author}</span>
                                        <span className="text-[#8B8399] text-[10px] tracking-[0.2em] uppercase">{TESTIMONIALS[active].role}</span>
                                    </div>
                                    <div className="w-px h-10 bg-white/20 mx-4" />
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} size={14} fill="#C9A96E" className="text-[#C9A96E]" />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        <div className="flex items-center gap-4 mt-20">
                            {TESTIMONIALS.map((t, i) => (
                                <motion.button
                                    key={i}
                                    aria-label={`الشريحة ${i + 1}`}
                        aria-pressed={i === active}
                        onClick={() => setActive(i)}
                                    animate={{
                                        y: [0, i % 2 === 0 ? -8 : 10, 0, i % 2 === 0 ? 6 : -8, 0],
                                        x: [0, i % 3 === 0 ? 6 : -6, 0, i % 3 === 0 ? -5 : 8, 0]
                                    }}
                                    transition={{
                                        duration: 6 + (i * 1.5),
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden transition-all duration-500 shadow-xl border border-white/10 ${i === active ? "scale-[1.25] ring-2 ring-[#C9A96E] ring-offset-2 ring-offset-[#1A1A2E] opacity-100 z-10" : "opacity-40 hover:opacity-80 hover:scale-110 grayscale"}`}
                                >
                                    <Image src={t.img} alt={t.author} fill className="object-cover" />
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div className="order-1 md:order-2 flex justify-end relative h-[500px] md:h-[700px] lg:h-[800px]">
                        <div className="w-full md:w-[85%] h-full relative overflow-hidden bg-[#F5EDE0]">
                            <AnimatePresence>
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                    transition={{ duration: 1.2, ease: "easeInOut" }}
                                    className="absolute inset-0"
                                >
                                    <Image src={TESTIMONIALS[active].img} alt="عميل" fill className="object-cover" />
                                    <div className="absolute inset-0 bg-[#1A1A2E]/10" />

                                    <div className="absolute bottom-10 left-10 lg:-left-6 bg-[#1A1A2E]/80 backdrop-blur-md px-8 py-5 border border-white/10 shadow-2xl">
                                        <span className="text-white text-[10px] tracking-[0.3em] uppercase whitespace-nowrap">
                                            {TESTIMONIALS[active].tag}
                                        </span>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className="absolute bottom-24 -left-8 md:-left-16 w-32 h-32 md:w-64 md:h-64 border border-[#C9A96E]/30 z-20 pointer-events-none" />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function LuxuryHomePage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        getProducts({ status: "ACTIVE", limit: 6 }).then(result => { if (active) setProducts(result.data); })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);
    return (
        <div className="bg-[#FDFAF6] min-h-screen">
            <HeroSection />
            <MarqueeBar />
            <CollectionGallery />
            <CatalogHighlights products={products} loading={loading} error={error} />
            <Testimonials />
            <MaisonStory />
            <WhatsAppCTA />
        </div>
    );
}
