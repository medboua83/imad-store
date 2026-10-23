export interface QuantityDiscount {
    minQuantity: number;
    unitPrice: number;
}
const cents = (value: number) => Math.round(value * 100);

/** Validate the whole schedule: a larger quantity must always have a lower unit price. */
export function quantityDiscountError(price: number, value: unknown): string | null {
    if (value == null) return null;
    if (!Array.isArray(value) || value.length > 5) return "Ajoutez au maximum cinq paliers.";
    let quantity = 1,
        previous = cents(price);
    for (const tier of [...value].sort((a, b) => a?.minQuantity - b?.minQuantity)) {
        if (
            !tier ||
            !Number.isInteger(tier.minQuantity) ||
            tier.minQuantity < 2 ||
            tier.minQuantity > 100
        )
            return "Chaque quantité minimum doit être un entier entre 2 et 100.";
        if (tier.minQuantity <= quantity) return "Chaque quantité minimum doit être différente.";
        if (
            typeof tier.unitPrice !== "number" ||
            !Number.isFinite(tier.unitPrice) ||
            cents(tier.unitPrice) < 1 ||
            Math.abs(tier.unitPrice * 100 - cents(tier.unitPrice)) > 0.000001
        )
            return "Chaque prix doit être positif, avec deux décimales au maximum.";
        if (cents(tier.unitPrice) >= previous)
            return "Le prix par article doit diminuer à chaque palier et rester inférieur au prix actuel.";
        quantity = tier.minQuantity;
        previous = cents(tier.unitPrice);
    }
    return null;
}

/** Missing legacy fields or invalid imported schedules never change the normal price. */
export function quantityDiscounts(price: number, value: unknown): QuantityDiscount[] {
    if (!Array.isArray(value) || quantityDiscountError(price, value)) return [];
    return value
        .map(({ minQuantity, unitPrice }) => ({ minQuantity, unitPrice }))
        .sort((a, b) => a.minQuantity - b.minQuantity);
}
export function quantityUnitPrice(price: number, value: unknown, quantity: number): number {
    const tier = quantityDiscounts(price, value)
        .filter((t) => quantity >= t.minQuantity)
        .at(-1);
    return cents(tier?.unitPrice ?? price) / 100;
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
    const lines = items.map((item) => {
        const unitPrice = quantityUnitPrice(
            item.price,
            item.quantityDiscounts,
            quantities.get(item.productId) ?? 0,
        );
        return { item, unitPrice, total: (cents(unitPrice) * item.quantity) / 100 };
    });
    const subtotal = lines.reduce((sum, line) => sum + cents(line.total), 0) / 100;
    const original = items.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0) / 100;
    return { lines, subtotal, savings: cents(original - subtotal) / 100 };
}
