"use client";
import { trapDialogFocus } from "./dialog-focus";
import Link from "next/link";
import { ShoppingBag, Menu, ArrowUpLeft } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import { usePathname } from "next/navigation";
const links = [
    ["/", "الرئيسية"],
    ["/shop", "المتجر"],
    ["/contact", "تواصل معنا"],
];
export function Navbar() {
    const menu = useRef<HTMLDialogElement>(null);
    const path = usePathname();
    const [count, setCount] = useState(0);
    useEffect(() => {
        const update = () => setCount(useCartStore.getState().itemCount());
        const task = setTimeout(update, 0);
        const unsubscribe = useCartStore.subscribe(update);
        return () => {
            clearTimeout(task);
            unsubscribe();
        };
    }, []);
    return (
        <header className="site-header">
            <div className="nav-inner">
                <Link
                    href="/"
                    aria-label="IMAD Mode — الرئيسية"
                    className="brand-wordmark"
                    dir="ltr"
                >
                    IMAD <span>MODE</span>
                </Link>
                <nav aria-label="التنقل الرئيسي" className="hidden md:flex gap-5">
                    {links.map(([href, label]) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={
                                (
                                    href === "/shop"
                                        ? path.startsWith("/shop") || path.startsWith("/products/")
                                        : path === href
                                )
                                    ? "page"
                                    : undefined
                            }
                            className="action nav-link"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="flex gap-2">
                    <button
                        className="action cart-toggle"
                        aria-label={`فتح السلة، ${count} قطعة`}
                        onClick={() => useCartStore.getState().openCart()}
                    >
                        <ShoppingBag size={20} aria-hidden="true" />
                        <span className="cart-label">السلة</span>
                        <span className="cart-count">{count}</span>
                    </button>
                    <button
                        className="action mobile-menu-toggle"
                        aria-label="فتح القائمة"
                        onClick={() => menu.current?.showModal()}
                    >
                        <Menu size={22} aria-hidden="true" />
                        <span className="sr-only">القائمة</span>
                    </button>
                </div>
            </div>
            <div className="announcement-bar">
                <p>
                    الدفع عند الاستلام <span aria-hidden="true">✦</span> تفاصيل واضحة قبل تأكيد
                    الطلب
                </p>
                <Link href="/delivery">
                    معلومات التوصيل <ArrowUpLeft size={14} aria-hidden="true" />
                </Link>
            </div>
            <dialog
                onKeyDown={trapDialogFocus}
                className="menu-dialog"
                ref={menu}
                aria-labelledby="menu-title"
            >
                <h2 id="menu-title" className="text-xl">
                    القائمة
                </h2>
                <button className="action" onClick={() => menu.current?.close()}>
                    إغلاق ×
                </button>
                <nav className="flex flex-col gap-4 mt-6">
                    {links.map(([href, label]) => (
                        <Link
                            className="action"
                            href={href}
                            key={href}
                            onClick={() => menu.current?.close()}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </dialog>
        </header>
    );
}
