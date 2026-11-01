"use client";
import Image from "next/image";
import { categoryThumbnail } from "../store/category-visuals";
import { trapDialogFocus } from "./dialog-focus";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import {
    ShoppingBag,
    Menu,
    ArrowUpLeft,
    Search,
    House,
    LayoutGrid,
    MessageCircle,
    X,
    Truck,
    PackageCheck,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useCartStore } from "@/store/cart.store";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/lib/api";
import { publishedCategories } from "@/lib/catalog-navigation";
const dockLinks = [
    ["/", "الرئيسية", House],
    ["/shop", "المتجر", LayoutGrid],
    ["/contact", "تواصلوا معنا", MessageCircle],
] as const;
const links = [
    ["/", "الرئيسية"],
    ["/shop", "المتجر"],
    ["/contact", "تواصلوا معنا"],
];
export function Navbar() {
    const header = useRef<HTMLElement>(null);
    useEffect(() => {
        const element = header.current;
        const shell = element?.closest<HTMLElement>(".store-shell");
        if (!element || !shell) return;
        const update = () => shell.style.setProperty("--store-header-offset", `${Math.ceil(element.getBoundingClientRect().height) + 12}px`);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const {data = []} = useQuery({queryKey:["public-categories"],queryFn:getCategories,staleTime:60_000});
    const categories = publishedCategories(data);
    const menu = useRef<HTMLDialogElement>(null);
    const path = usePathname();
    const menuTrigger = useRef<HTMLButtonElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    function closeMenu() {
        menu.current?.close();
    }
    function openMenu() {
        menu.current?.showModal();
        setMenuOpen(true);
    }
    useEffect(() => {
        if (!menuOpen) return;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = oldOverflow;
        };
    }, [menuOpen]);
    useEffect(() => {
        menu.current?.close();
    }, [path]);
    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 768px)");
        const changed = () => {
            if (desktop.matches) menu.current?.close();
        };
        desktop.addEventListener("change", changed);
        return () => desktop.removeEventListener("change", changed);
    }, []);
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
            <header ref={header} className="site-header refined-header">
                <div className="nav-inner">
                    <Link
                        href="/"
                        aria-label="IMAD Mode — الرئيسية"
                        className="brand-wordmark"
                        dir="ltr"
                    >
                        <BrandLogo />
                    </Link>
                    <nav aria-label="التنقل الرئيسي" className="desktop-navigation">
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
                            <span className="header-search-label">بحث</span>
                        </Link>
                        <button
                            className="action cart-toggle"
                            id="store-cart-trigger"
                            aria-haspopup="dialog"
                            aria-controls="store-cart"
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
                            ref={menuTrigger}
                            aria-haspopup="dialog"
                            aria-controls="store-menu"
                            aria-expanded={menuOpen}
                            onClick={openMenu}
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
                    id="store-menu"
                    onKeyDown={trapDialogFocus}
                    className="menu-dialog store-menu"
                    ref={menu}
                    aria-labelledby="menu-title"
                    onClose={() => {
                        setMenuOpen(false);
                        menuTrigger.current?.focus({ preventScroll: true });
                    }}
                >
                    <div className="store-menu-top">
                        <div>
                            <p className="menu-eyebrow" dir="ltr">
                                THE IMAD EDIT
                            </p>
                            <h2 id="menu-title">اختاروا ما يشبهكم.</h2>
                        </div>
                        <button
                            type="button"
                            className="action menu-close"
                            aria-label="إغلاق القائمة"
                            onClick={closeMenu}
                        >
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="store-menu-scroll">
                        <form
                            action="/shop"
                            method="get"
                            role="search"
                            aria-label="البحث في المتجر"
                            className="menu-search-form"
                            onSubmit={closeMenu}
                        >
                            <label htmlFor="menu-search">ما الذي تبحثون عنه؟</label>
                            <div>
                                <input
                                    id="menu-search"
                                    name="search"
                                    type="search"
                                    placeholder="البحث عن منتج…"
                                    maxLength={100}
                                    enterKeyHint="search"
                                />
                                <button type="submit" aria-label="عرض نتائج البحث">
                                    <Search size={20} aria-hidden="true" />
                                </button>
                            </div>
                        </form>
                        <Link href="/shop" className="menu-shop-all" onClick={closeMenu}>
                            <span>
                                <LayoutGrid size={20} aria-hidden="true" />
                                اكتشفوا كل المنتجات
                            </span>
                            <ArrowUpLeft size={20} aria-hidden="true" />
                        </Link>
                        <nav className="menu-categories" aria-label="فئات المنتجات">
                            <h3>تسوقوا حسب الفئة</h3>
                            {categories.map((category) => (
                                <Link
                                    href={`/shop?category=${category.slug}`}
                                    key={category.slug}
                                    onClick={closeMenu}
                                >
                                    <span className="menu-category-icon" aria-hidden="true">
                                        {categoryThumbnail(category.slug) && <Image
                                            src={categoryThumbnail(category.slug)}
                                            alt=""
                                            width={42}
                                            height={42}
                                            className="menu-category-photo"
                                        />}
                                    </span>
                                    <span>{category.nameAr || category.nameFr} <small>({category.publishedCount})</small></span>
                                    <ArrowUpLeft size={16} aria-hidden="true" />
                                </Link>
                            ))}
                        </nav>
                        <nav className="menu-practical" aria-label="روابط المساعدة">
                            <h3>كل التفاصيل، قبل الطلب</h3>
                            <Link href="/delivery" onClick={closeMenu}>
                                <Truck size={18} aria-hidden="true" />
                                التوصيل
                                <ArrowUpLeft size={16} aria-hidden="true" />
                            </Link>
                            <Link href="/returns" onClick={closeMenu}>
                                <PackageCheck size={18} aria-hidden="true" />
                                الاستبدال والإرجاع
                                <ArrowUpLeft size={16} aria-hidden="true" />
                            </Link>
                            <Link href="/contact" onClick={closeMenu}>
                                <MessageCircle size={18} aria-hidden="true" />
                                تواصلوا معنا
                                <ArrowUpLeft size={16} aria-hidden="true" />
                            </Link>
                            <Link href="/" onClick={closeMenu}>
                                <House size={18} aria-hidden="true" />
                                الرئيسية
                                <ArrowUpLeft size={16} aria-hidden="true" />
                            </Link>
                        </nav>
                    </div>
                    <div className="store-menu-bottom">
                        <ShoppingBag size={18} aria-hidden="true" />
                        <p>
                            اختاروا. راجعوا. واطلبوا بثقة.
                            <small>الدفع عند الاستلام · بدون إنشاء حساب</small>
                        </p>
                    </div>
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
                        aria-haspopup="dialog"
                        aria-controls="store-cart"
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
