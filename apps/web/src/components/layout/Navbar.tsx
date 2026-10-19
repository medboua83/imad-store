"use client";
import { trapDialogFocus } from "./dialog-focus";
import Link from "next/link";
import {
    ShoppingBag,
    Menu,
    ArrowUpLeft,
    Search,
    House,
    LayoutGrid,
    MessageCircle,
    X,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import { usePathname } from "next/navigation";
const dockLinks = [
    ["/", "الرئيسية", House],
    ["/shop", "المتجر", LayoutGrid],
    ["/contact", "تواصل معنا", MessageCircle],
] as const;
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
        <>
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
                                            ? path.startsWith("/shop") ||
                                              path.startsWith("/products/")
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
                    <div className="nav-actions flex gap-2">
                        <Link
                            href="/shop?filters=open#catalog-search"
                            className="action nav-search"
                            aria-label="البحث في المتجر"
                        >
                            <Search size={20} aria-hidden="true" />
                        </Link>
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
                    <button
                        className="action menu-close"
                        aria-label="إغلاق القائمة"
                        onClick={() => menu.current?.close()}
                    >
                        <X size={22} aria-hidden="true" />
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
                    <p className="menu-note">اختاري قطعتكِ، وراجعي التفاصيل قبل تأكيد الطلب.</p>
                </dialog>
            </header>
            {!path.startsWith("/products/") && !path.startsWith("/checkout") && (
                <nav className="mobile-dock" aria-label="التنقل السريع">
                    {dockLinks.map(([href, label, Icon]) => (
                        <Link
                            key={String(href)}
                            href={String(href)}
                            aria-current={path === href ? "page" : undefined}
                        >
                            <Icon size={20} aria-hidden="true" />
                            <span>{String(label)}</span>
                        </Link>
                    ))}
                    <button
                        type="button"
                        onClick={() => useCartStore.getState().openCart()}
                        aria-label={`فتح السلة، ${count} قطعة`}
                    >
                        <span className="dock-cart-icon">
                            <ShoppingBag size={20} aria-hidden="true" />
                            {count > 0 && <span className="dock-count">{count}</span>}
                        </span>
                        <span>السلة</span>
                    </button>
                </nav>
            )}
        </>
    );
}
