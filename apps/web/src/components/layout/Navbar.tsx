"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useCartStore } from "@/store/cart.store";

/* Arabic-only */

const NAV_LINKS = [
    { href: "/", labelAr: "الرئيسية" },
    { href: "/shop", labelAr: "المتجر" },
    { href: "/shop?category=bags", labelAr: "الحقائب" },
    { href: "/shop?category=abayas", labelAr: "العبايات" },
    { href: "/shop?category=shailan", labelAr: "شيلان" },
    { href: "/shop?category=shoes-women", labelAr: "أحذية نسائية" },
    { href: "/shop?category=pyjamas", labelAr: "بيجامات" },
    { href: "/shop?category=shoes-men", labelAr: "سابو رجالي" },
];

const DELIVERY_MSG = "📦 توصيل لجميع أنحاء المغرب • الدفع عند الاستلام 📦";

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const openCart = useCartStore(s => s.openCart);
    const cartItems = useCartStore(s => s.items);
    const count = mounted ? cartItems.reduce((acc, i) => acc + i.quantity, 0) : 0;

    useEffect(() => {
        const task = window.setTimeout(() => setMounted(true), 0);
        const fn = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", fn, { passive: true });
        return () => { window.clearTimeout(task); window.removeEventListener("scroll", fn); };
    }, []);

    return (
        <>
            <motion.header
                initial={{ y: -80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="fixed top-0 inset-x-0 z-50"
                style={{
                    background: "rgba(255,255,255,0.98)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(201,169,110,0.2)",
                }}
            >
                {/* ── Top row: Logo · Delivery Ticker · Cart ─────────── */}
                <div
                    className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between gap-4"
                    style={{ paddingTop: scrolled ? 10 : 16, paddingBottom: scrolled ? 10 : 16, transition: "padding 0.3s" }}
                >
                    <Link href="/" className="flex flex-col leading-none shrink-0 group">
                        <span
                            className="text-[26px] md:text-[30px] font-light tracking-[0.15em] text-[#1A1A2E] group-hover:text-[#C9A96E] transition-colors"
                            style={{ fontFamily: "'Cormorant Garamond', serif" }}
                        >
                            IMAD
                        </span>
                        <span className="text-[7px] tracking-[0.55em] text-[#C9A96E] uppercase font-semibold -mt-1">
                            Mode
                        </span>
                    </Link>

                    <div className="flex-1 overflow-hidden flex items-center justify-center h-7" dir="ltr">
                        <motion.p
                            key="ticker"
                            animate={{ x: [220, -220] }}
                            transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", repeatType: "reverse" }}
                            className="whitespace-nowrap text-[17px] md:text-[19px] font-bold tracking-wide text-[#1A1A2E] select-none"
                            dir="rtl"
                        >
                            {DELIVERY_MSG}
                        </motion.p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button aria-label="فتح السلة" onClick={openCart} className="relative flex items-center text-[#1A1A2E] hover:text-[#C9A96E] transition-colors p-2">
                            <ShoppingBag size={28} strokeWidth={1.5} />
                            <AnimatePresence>
                                {mounted && count > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                        className="absolute -top-1 -right-1 bg-[#C9A96E] text-white text-[9px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center"
                                    >
                                        {count}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </button>
                        <button
                            aria-label="فتح القائمة"
                            onClick={() => setMobileOpen(true)}
                            className="lg:hidden text-[#1A1A2E] hover:text-[#C9A96E] transition-colors p-1"
                        >
                            <Menu size={24} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="hidden lg:block border-t border-[#C9A96E]/10">
                    <nav className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-8 py-3" dir="rtl">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="relative text-[14px] tracking-[0.1em] font-semibold text-[#1A1A2E]/80 hover:text-[#C9A96E] transition-colors duration-200 group whitespace-nowrap"
                            >
                                {link.labelAr}
                                <span className="absolute -bottom-0.5 right-0 w-0 h-[1.5px] bg-[#C9A96E] group-hover:w-full transition-all duration-300 origin-right" />
                            </Link>
                        ))}
                    </nav>
                </div>
            </motion.header>

            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.7)" }}
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.div
                            key="drawer"
                            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 250 }}
                            style={{ position: "fixed", top: 0, bottom: 0, zIndex: 91, width: 300, left: 0 }}
                            className="bg-[#FDFAF6] flex flex-col shadow-2xl"
                        >
                            <div className="bg-[#1A1A2E] px-6 py-5 flex items-center justify-between shrink-0">
                                <span className="text-xl font-light text-white tracking-[0.2em]"
                                    style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                    IMAD <span className="text-[#C9A96E] text-xs">Mode</span>
                                </span>
                                <button
                                    aria-label="إغلاق القائمة"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center border border-white/20 text-white/50 hover:text-[#C9A96E] hover:border-[#C9A96E]/40 transition-colors"
                                >
                                    <X size={16} strokeWidth={1.5} />
                                </button>
                            </div>

                            <nav className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-0" dir="rtl">
                                {NAV_LINKS.map((link, i) => (
                                    <motion.div
                                        key={link.href}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.04 * i }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setMobileOpen(false)}
                                            className="flex items-center justify-between py-4 border-b border-[#C9A96E]/10 text-[17px] tracking-[0.05em] font-semibold text-[#1A1A2E]/80 hover:text-[#C9A96E] transition-colors group"
                                        >
                                            {link.labelAr}
                                            <span className="text-[#C9A96E]/0 group-hover:text-[#C9A96E] text-lg transition-colors">‹</span>
                                        </Link>
                                    </motion.div>
                                ))}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
