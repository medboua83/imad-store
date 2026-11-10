"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/lib/api";
import { ProductPhoto } from "../store/ProductPhoto";
import { trapDialogFocus } from "./dialog-focus";
import styles from "./StoreSearch.module.css";

export function StoreSearch() {
    const trigger = useRef<HTMLButtonElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [settled, setSettled] = useState("");
    const term = value.trim();

    useEffect(() => {
        if (!open) return;
        const timeout = window.setTimeout(() => setSettled(term), 250);
        return () => window.clearTimeout(timeout);
    }, [open, term]);

    useEffect(() => {
        if (!open) return;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = overflow; };
    }, [open]);

    useEffect(() => { dialog.current?.close(); }, [path]);

    const ready = open && term.length >= 2 && term === settled;
    const suggestions = useQuery({
        queryKey: ["product-suggestions", settled],
        queryFn: ({ signal }) => getProducts({ search: settled, limit: 5 }, signal),
        enabled: ready,
        retry: false,
        staleTime: 30_000,
    });
    const products = ready ? suggestions.data?.data ?? [] : [];
    const status = term.length < 2
        ? "اكتبوا حرفين على الأقل لرؤية اقتراحات."
        : !ready || suggestions.isPending
            ? "جارٍ البحث…"
            : suggestions.isError
                ? "تعذر تحميل الاقتراحات. يمكنكم عرض جميع النتائج."
                : products.length === 0
                    ? "لم نجد منتجات مطابقة."
                    : "";

    function close() {
        dialog.current?.close();
    }

    return (
        <>
            <button
                type="button"
                ref={trigger}
                className="action nav-search"
                aria-label="البحث في المتجر"
                aria-haspopup="dialog"
                aria-controls="store-search"
                aria-expanded={open}
                onClick={() => {
                    dialog.current?.showModal();
                    setOpen(true);
                    input.current?.focus();
                }}
            >
                <Search size={20} aria-hidden="true" />
                <span className="header-search-label">بحث</span>
            </button>
            <dialog
                id="store-search"
                className={styles.dialog}
                aria-labelledby="store-search-title"
                ref={dialog}
                onKeyDown={trapDialogFocus}
                onClose={() => {
                    setOpen(false);
                    setValue("");
                    setSettled("");
                    trigger.current?.focus({ preventScroll: true });
                }}
            >
                <div className={styles.heading}>
                    <h2 id="store-search-title">البحث في المتجر</h2>
                    <button type="button" className={styles.close} onClick={close} aria-label="إغلاق البحث">
                        <X size={22} aria-hidden="true" />
                    </button>
                </div>
                <form action="/shop" role="search" className={styles.form} onSubmit={close}>
                    <input
                        ref={input}
                        name="search"
                        type="search"
                        autoComplete="off"
                        enterKeyHint="search"
                        dir="auto"
                        maxLength={100}
                        aria-label="البحث عن منتج"
                        placeholder="البحث عن منتج…"
                        value={value}
                        onChange={event => setValue(event.target.value)}
                    />
                    <button type="submit" disabled={!term}>عرض النتائج</button>
                </form>
                <p className={styles.status} role="status">
                    {status || `${products.length} نتائج مقترحة`}
                </p>
                {products.length > 0 && (
                    <ul className={styles.list} aria-label="المنتجات المقترحة">
                        {products.map(product => (
                            <li key={product.id}>
                                <Link href={`/products/${encodeURIComponent(product.slug)}`} onClick={close}>
                                    <span className={styles.photo} aria-hidden="true">
                                        <ProductPhoto images={product.images} name="" sizes="44px" thumbnail />
                                    </span>
                                    <span className={styles.name}>{product.nameAr || product.nameFr || product.nameEn}</span>
                                    <span className={styles.price} dir="ltr">{product.price.toFixed(2)} MAD</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </dialog>
        </>
    );
}
