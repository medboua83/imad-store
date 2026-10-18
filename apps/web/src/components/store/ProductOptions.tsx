"use client";
import { useState } from "react";
import type { Product } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";
export function ProductOptions({ product }: { product: Product }) {
    const [id, setId] = useState(product.variants.find((v) => v.stock > 0)?.id || "");
    const [quantity, setQuantity] = useState(1);
    const variant = product.variants.find((v) => v.id === id);
    const stock = variant?.stock || 0;
    return (
        <div className="space-y-5">
            <label className="block" htmlFor="variant">
                اللون والمقاس
                <select
                    id="variant"
                    className="store-input mt-2"
                    value={id}
                    onChange={(e) => {
                        setId(e.target.value);
                        setQuantity(1);
                    }}
                >
                    <option value="">اختاري النوع</option>
                    {product.variants.map((v) => (
                        <option key={v.id} value={v.id} disabled={!v.stock}>
                            {v.colorNameAr || v.colorNameFr}
                            {v.size ? ` — ${v.size}` : ""}
                            {v.stock ? ` — ${v.stock} متوفر` : " — غير متوفر"}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block">
                الكمية
                <input
                    className="store-input mt-2 max-w-32"
                    type="number"
                    min={1}
                    max={stock || 1}
                    step={1}
                    value={quantity}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        setQuantity(
                            Number.isFinite(n) ? Math.max(1, Math.min(stock, Math.floor(n))) : 1,
                        );
                    }}
                />
            </label>
            <button
                className="btn-primary w-full"
                disabled={!variant || stock < 1}
                onClick={() => {
                    if (variant) useCartStore.getState().addItem(product, variant, quantity);
                }}
            >
                {stock ? "أضف إلى السلة" : "غير متوفر حالياً"}
            </button>
        </div>
    );
}
