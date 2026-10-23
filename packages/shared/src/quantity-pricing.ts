export interface QuantityDiscount {
    /** Historical field name: this is the exact eligible quantity, never a threshold. */
    minQuantity: number;
    unitPrice: number;
    totalPrice?: number;
}
const cents = (value: number) => Math.round(value * 100);

/** Validate independently entered totals. Never derive an offer for another quantity. */
export function quantityDiscountError(price: number, value: unknown): string | null {
    if (value == null) return null;
    if (!Array.isArray(value) || value.length > 5) return "Ajoutez au maximum cinq paliers.";
    let quantity = 1;
    for (const tier of [...value].sort((a, b) => a?.minQuantity - b?.minQuantity)) {
        if (
            !tier ||
            !Number.isInteger(tier.minQuantity) ||
            tier.minQuantity < 2 ||
            tier.minQuantity > 100
        )
            return "Chaque quantité doit être un entier entre 2 et 100.";
        if (tier.minQuantity <= quantity) return "Chaque quantité doit être différente.";
        if (
            typeof tier.unitPrice !== "number" ||
            !Number.isFinite(tier.unitPrice) ||
            cents(tier.unitPrice) < 1 ||
            (tier.totalPrice == null &&
                Math.abs(tier.unitPrice * 100 - cents(tier.unitPrice)) > 0.000001)
        )
            return "Chaque prix doit être positif, avec deux décimales au maximum.";
        if (
            tier.totalPrice != null &&
            (typeof tier.totalPrice !== "number" ||
                !Number.isFinite(tier.totalPrice) ||
                cents(tier.totalPrice) < tier.minQuantity ||
                tier.totalPrice > 100000000 ||
                Math.abs(tier.totalPrice * 100 - cents(tier.totalPrice)) > 0.000001 ||
                Math.abs(tier.unitPrice * tier.minQuantity - tier.totalPrice) > 0.000001)
        )
            return "Le total du lot doit être positif, à deux décimales, et correspondre à la quantité.";
        const rate =
            tier.totalPrice != null
                ? cents(tier.totalPrice) / tier.minQuantity
                : cents(tier.unitPrice);
        if (rate > cents(price) + 0.000001 || (tier.totalPrice == null && rate >= cents(price)))
            return "Le prix d’une offre ne doit pas dépasser le prix normal de cette quantité.";
        quantity = tier.minQuantity;
    }
    return null;
}

/** Missing legacy fields or invalid imported schedules never change the normal price. */
export function quantityDiscounts(price: number, value: unknown): QuantityDiscount[] {
    if (!Array.isArray(value) || quantityDiscountError(price, value)) return [];
    return value
        .map(({ minQuantity, unitPrice, totalPrice }) => ({
            minQuantity,
            unitPrice,
            ...(totalPrice != null ? { totalPrice } : {}),
        }))
        .sort((a, b) => a.minQuantity - b.minQuantity);
}
export function quantityUnitPrice(price: number, value: unknown, quantity: number): number {
    const tier = quantityDiscounts(price, value).find((t) => quantity === t.minQuantity);
    return tier?.unitPrice ?? cents(price) / 100;
}

export function quantityTotalPrice(price: number, value: unknown, quantity: number): number {
    const tier = quantityDiscounts(price, value).find((t) => quantity === t.minQuantity);
    const amount =
        tier?.totalPrice != null
            ? cents(tier.totalPrice)
            : cents(tier?.unitPrice ?? price) * quantity;
    return Math.round(amount) / 100;
}

export interface QuantityPricedItem {
    productId: string;
    price: number;
    quantity: number;
    quantityDiscounts?: unknown;
}
/** Aggregate variants by product, never by SKU, colour, cart row or unrelated products. */
export function priceCart<T extends QuantityPricedItem>(items: T[]) {
    const quantities = new Map<string, number>();
    for (const item of items)
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const allocations = new Map<string, { low: number; high: number; remainingHigh: number }>();
    const lines = items.map((item) => {
        const quantity = quantities.get(item.productId) ?? 0;
        if (!allocations.has(item.productId)) {
            const total = cents(quantityTotalPrice(item.price, item.quantityDiscounts, quantity));
            allocations.set(item.productId, {
                low: quantity ? Math.floor(total / quantity) : cents(item.price),
                high: quantity ? Math.ceil(total / quantity) : cents(item.price),
                remainingHigh: quantity ? total % quantity : 0,
            });
        }
        const allocation = allocations.get(item.productId)!;
        const highQuantity = Math.min(item.quantity, allocation.remainingHigh);
        allocation.remainingHigh -= highQuantity;
        const lowQuantity = item.quantity - highQuantity;
        const parts = [
            ...(highQuantity ? [{ quantity: highQuantity, unitPrice: allocation.high / 100 }] : []),
            ...(lowQuantity ? [{ quantity: lowQuantity, unitPrice: allocation.low / 100 }] : []),
        ];
        const total =
            parts.reduce((sum, part) => sum + cents(part.unitPrice) * part.quantity, 0) / 100;
        return {
            item,
            unitPrice: item.quantity ? total / item.quantity : item.price,
            total,
            allocations: parts,
        };
    });
    const subtotal = lines.reduce((sum, line) => sum + cents(line.total), 0) / 100;
    const original = items.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0) / 100;
    return { lines, subtotal, savings: cents(original - subtotal) / 100 };
}
