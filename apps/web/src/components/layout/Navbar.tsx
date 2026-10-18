"use client";
import { trapDialogFocus } from "./dialog-focus";
import Link from "next/link";
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
            <div className="max-w-7xl mx-auto flex justify-between items-center gap-3 p-4">
                <Link
                    href="/"
                    aria-label="IMAD Mode — الرئيسية"
                    className="text-2xl tracking-widest"
                >
                    IMAD <span className="text-sm">MODE</span>
                </Link>
                <nav aria-label="التنقل الرئيسي" className="hidden md:flex gap-5">
                    {links.map(([href, label]) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={path === href ? "page" : undefined}
                            className="action hover:underline"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="flex gap-2">
                    <button
                        className="action"
                        aria-label={`فتح السلة، ${count} قطعة`}
                        onClick={() => useCartStore.getState().openCart()}
                    >
                        السلة ({count})
                    </button>
                    <button
                        className="action mobile-menu-toggle"
                        aria-label="فتح القائمة"
                        onClick={() => menu.current?.showModal()}
                    >
                        ☰ القائمة
                    </button>
                </div>
            </div>
            <p className="text-center bg-[#F5EDE0] text-sm py-2 px-4">
                الدفع عند الاستلام · رسوم التوصيل واضحة قبل تأكيد الطلب
            </p>
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
