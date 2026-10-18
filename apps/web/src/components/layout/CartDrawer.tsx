"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useCartStore } from "@/store/cart.store";


import { useShipping } from "@/hooks/useShipping";

export function CartDrawer() {
    const { items, isOpen, closeCart, updateQty, removeItem, total } = useCartStore();
    const subtotal = total();
    const { settings, fee: deliveryFee, total: orderTotal } = useShipping(subtotal);
    const freeLeft = Math.max(0, (settings?.freeShippingMin ?? 0) - subtotal);
    const progress = settings ? Math.min(100, (subtotal / Math.max(1, settings.freeShippingMin)) * 100) : 0;

    const T = {
        bag: "حقيبتي",
        items: "قطعة",
        empty: "حقيبتك فارغة",
        browse: "تصفح المجموعة",
        shippingBar: (n: number) => `أضف ${n.toFixed(0)} درهم للشحن المجاني`,
        freeShip: "🎉 شحن مجاني مفعّل",
        subtotal: "المجموع",
        delivery: "التوصيل",
        free: "مجاني",
        total: "المجموع الكلي",
        payment: "طريقة الدفع",
        byCard: "الدفع بالبطاقة",
        onDelivery: "الدفع عند الاستلام",
        order: "تأكيد الطلب",
        secure: "دفع آمن ومشفّر",
        gift: "إضافة رسالة هدية",
        size: "مقاس",
    };

    return (
        <>
            {/* ── Backdrop ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div key="backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ position: "fixed", inset: 0, zIndex: 100 }}
                        className="bg-[#1A1A2E]/70 backdrop-blur-md"
                        onClick={closeCart}
                    />
                )}
            </AnimatePresence>

            {/* ══════════════════ CART PANEL ══════════════════ */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        key="cart"
                        initial={{ x: "-100%", opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "-100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 34 }}
                        style={{ position: "fixed", top: 0, ...({ left: 0 }), bottom: 0, zIndex: 101, width: "100%", maxWidth: 520 }}
                        className="flex flex-col bg-[#FDFAF6] shadow-[40px_0_120px_rgba(0,0,0,0.35)]"
                    >
                        {/* ─── DARK EDITORIAL HEADER ─── */}
                        <div className="relative bg-[#1A1A2E] px-8 pt-7 pb-6 shrink-0">
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A96E]/60 to-transparent" />

                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                    <ShoppingBag size={21} strokeWidth={1.2} className="text-[#C9A96E]" />
                                    <h2 className="text-[26px] font-light text-white tracking-[0.12em]"
                                        style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                        {T.bag}
                                    </h2>
                                    {items.length > 0 && (
                                        <motion.span key={items.length}
                                            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                            className="bg-[#C9A96E] text-white text-[10px] font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5">
                                            {items.length}
                                        </motion.span>
                                    )}
                                </div>
                                <button aria-label="إغلاق السلة" onClick={closeCart}
                                    className="w-9 h-9 border border-white/15 flex items-center justify-center text-white/50 hover:text-[#C9A96E] hover:border-[#C9A96E]/50 transition-all">
                                    <X size={17} strokeWidth={1.5} />
                                </button>
                            </div>

                            {/* Free shipping progress */}
                            {items.length > 0 && settings && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[9px] tracking-[0.18em] uppercase text-white/40">
                                            {freeLeft > 0 ? T.shippingBar(freeLeft) : T.freeShip}
                                        </p>
                                        <span className="text-[9px] tracking-widest text-[#C9A96E] uppercase">{T.free}</span>
                                    </div>
                                    <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full bg-gradient-to-r from-[#C9A96E] to-[#F0D89A]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ─── ITEMS SCROLL AREA ─── */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {items.length === 0 ? (
                                /* Empty state */
                                <div className="flex flex-col items-center justify-center h-full gap-8 px-8 py-16 text-center">
                                    <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: "spring" }}
                                        className="relative w-32 h-32 rounded-full bg-[#F5EDE0] flex items-center justify-center">
                                        <ShoppingBag size={56} strokeWidth={0.7} className="text-[#C9A96E]/35" />
                                        <Sparkles size={22} className="absolute -top-1 -right-2 text-[#C9A96E]/50" />
                                    </motion.div>
                                    <div className="space-y-2">
                                        <p className="text-2xl font-light text-[#1A1A2E]"
                                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>{T.empty}</p>
                                        <p className="text-[9px] tracking-[0.25em] uppercase text-[#8B8399]">
                                            اكتشفي أناقتنا الفاخرة
                                        </p>
                                    </div>
                                    <Link href="/shop" onClick={closeCart}
                                        className="border border-[#C9A96E] text-[#C9A96E] text-[10px] tracking-[0.3em] uppercase px-10 py-3.5 hover:bg-[#C9A96E] hover:text-white transition-all duration-300">
                                        {T.browse}
                                    </Link>
                                </div>
                            ) : (
                                <div className="px-8 py-5 space-y-0 divide-y divide-[#C9A96E]/8">
                                    <AnimatePresence initial={false}>
                                        {items.map((item, idx) => (
                                            <motion.div key={item.variantId} layout
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: 80, transition: { duration: 0.22 } }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="flex gap-5 py-6"
                                            >
                                                {/* Image — large and prominent */}
                                                <div className="relative w-28 h-36 bg-[#F5EDE0] shrink-0 overflow-hidden group">
                                                    <Image src={item.image || "/images/cat-abayas.png"} alt={item.nameAr || "Item"} fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    {/* Gold badge overlay */}
                                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#1A1A2E]/50 to-transparent h-1/3 pointer-events-none" />
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 flex flex-col min-w-0 py-1">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <Link href={`/products/${item.productSlug}`} onClick={closeCart}
                                                            className="text-base text-[#1A1A2E] hover:text-[#C9A96E] transition-colors line-clamp-2 leading-snug"
                                                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                                            {item.nameAr}
                                                        </Link>
                                                        <button aria-label="حذف المنتج" onClick={() => removeItem(item.variantId)}
                                                            className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center text-[#1A1A2E]/20 hover:text-red-400 hover:bg-red-50 rounded-sm transition-all">
                                                            <Trash2 size={13} strokeWidth={1.5} />
                                                        </button>
                                                    </div>

                                                    {item.size && (
                                                        <span className="text-[8px] tracking-[0.25em] uppercase text-[#8B8399] mb-3">
                                                            {T.size}: {item.size}
                                                        </span>
                                                    )}

                                                    <div className="flex items-center justify-between mt-auto">
                                                        {/* Qty stepper */}
                                                        <div className="flex items-center border border-[#C9A96E]/25 divide-x divide-[#C9A96E]/20">
                                                            <button aria-label="تقليل الكمية" onClick={() => updateQty(item.variantId, item.quantity - 1)}
                                                                className="w-9 h-9 flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#C9A96E] hover:bg-[#C9A96E]/5 transition-colors">
                                                                <Minus size={11} />
                                                            </button>
                                                            <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-[#1A1A2E]">
                                                                {item.quantity}
                                                            </span>
                                                            <button aria-label="زيادة الكمية" onClick={() => updateQty(item.variantId, item.quantity + 1)}
                                                                className="w-9 h-9 flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#C9A96E] hover:bg-[#C9A96E]/5 transition-colors">
                                                                <Plus size={11} />
                                                            </button>
                                                        </div>

                                                        {/* Line price */}
                                                        <motion.p key={item.quantity}
                                                            initial={{ scale: 1.2, color: "#C9A96E" }}
                                                            animate={{ scale: 1, color: "#1A1A2E" }}
                                                            transition={{ duration: 0.35 }}
                                                            className="text-[17px] font-light"
                                                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                                            {(item.price * item.quantity).toLocaleString()} MAD
                                                        </motion.p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>


                                </div>
                            )}
                        </div>

                        {/* ─── CHECKOUT PANEL ─── */}
                        {items.length > 0 && (
                            <div className="shrink-0 border-t border-[#C9A96E]/15 bg-white">
                                <div className="px-8 pt-7 pb-5">



                                    {/* Summary rows */}
                                    <div className="space-y-2 pb-5 border-b border-[#C9A96E]/10">
                                        <div className="flex justify-between text-xs text-[#1A1A2E]/50">
                                            <span className="tracking-wider uppercase">{T.subtotal}</span>
                                            <span>{subtotal.toLocaleString()} MAD</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="tracking-wider uppercase text-[#1A1A2E]/50">{T.delivery}</span>
                                            <span className={deliveryFee === 0 ? "text-[#C9A96E] text-xs tracking-wider" : "text-[#1A1A2E]/60"}>
                                                {deliveryFee === null ? "يُحسب عند إتمام الطلب" : deliveryFee === 0 ? T.free : `${deliveryFee} MAD`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-baseline pt-4 mb-6">
                                        <span className="text-[10px] tracking-[0.25em] uppercase text-[#1A1A2E]/60">{T.total}</span>
                                        <motion.span key={orderTotal}
                                            initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                            className="text-2xl font-light text-[#1A1A2E]"
                                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                            {(orderTotal ?? subtotal).toLocaleString()} MAD
                                        </motion.span>
                                    </div>

                                    {/* ── Place Order CTA ── */}
                                    <Link href="/checkout?method=delivery" onClick={closeCart}
                                        className="group w-full flex items-center justify-between bg-[#1A1A2E] text-white px-8 py-5 hover:bg-[#C9A96E] transition-all duration-500 mb-4">
                                        <span className="text-[11px] tracking-[0.35em] uppercase font-medium">{T.order}</span>
                                        <div className="w-8 h-8 border border-white/30 group-hover:border-white/60 flex items-center justify-center group-hover:translate-x-1 transition-all">
                                            <ArrowRight size={15} strokeWidth={1.5} />
                                        </div>
                                    </Link>

                                    {/* Security */}
                                    <div className="flex items-center justify-center gap-2">
                                        <ShieldCheck size={11} strokeWidth={1.5} className="text-[#8B8399]" />
                                        <p className="text-[9px] tracking-wider text-[#8B8399]">{T.secure}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
