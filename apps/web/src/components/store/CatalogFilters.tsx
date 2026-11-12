"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { trapDialogFocus } from "../layout/dialog-focus";

/** One server-rendered GET form: no copied filter values or second mobile form. */
export function CatalogFilters({ children, count, initialOpen }: {
    children: ReactNode;
    count: number;
    initialOpen: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(initialOpen);
    function show() {
        if (!dialog.current?.open) dialog.current?.showModal();
        setOpen(true);
    }
    useEffect(() => {
        if (initialOpen) {
            dialog.current?.showModal();
        }
    }, [initialOpen]);
    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [open]);
    return (
        <div className="catalog-filter-panel">
            <button ref={trigger} type="button" className="catalog-filter-trigger"
                aria-haspopup="dialog" aria-expanded={open} aria-controls="catalog-search"
                onClick={show}>
                <SlidersHorizontal size={18} aria-hidden="true" />
                البحث والفلاتر
                {count > 0 && <span className="active-filter-count">{count}</span>}
            </button>
            <dialog ref={dialog} id="catalog-search" className="catalog-filter-dialog"
                aria-labelledby="catalog-filter-title" onKeyDown={trapDialogFocus}
                onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>
                <header className="catalog-filter-dialog-heading">
                    <h2 id="catalog-filter-title">البحث والفلاتر</h2>
                    <button type="button" aria-label="إغلاق الفلاتر"
                        onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
                </header>
                {children}
            </dialog>
        </div>
    );
}
