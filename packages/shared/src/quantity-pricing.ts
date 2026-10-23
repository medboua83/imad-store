export interface QuantityDiscount {
    /** Historical field name: number of pieces in one repeatable pack. */
    minQuantity: number;
    unitPrice: number;
    totalPrice?: number;
}
const cents = (value: number) => Math.round(value * 100);

/** Validate manually entered pack totals; loose pieces keep the normal price. */
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
    return quantity > 0
        ? quantityTotalPrice(price, value, quantity) / quantity
        : cents(price) / 100;
}

export function quantityTotalPrice(price: number, value: unknown, quantity: number): number {
    return quantityPriceBreakdown(price, value, quantity).total;
}

export type QuantityAllocation = { quantity: number; unitPrice: number };

/** Exact merchant prices win; otherwise repeat the smallest pack and price loose units normally. */
export function quantityPriceBreakdown(price: number, value: unknown, quantity: number) {
    const offers = quantityDiscounts(price, value);
    const choices = [
        { quantity: 1, amount: cents(price) },
        ...offers.map((tier) => ({
            quantity: tier.minQuantity,
            amount:
                tier.totalPrice != null
                    ? cents(tier.totalPrice)
                    : cents(tier.unitPrice) * tier.minQuantity,
        })),
    ];
    const counts = choices.map(() => 0);
    if (Number.isSafeInteger(quantity) && quantity > 0) {
        const exact = offers.findIndex((offer) => offer.minQuantity === quantity);
        if (exact >= 0) counts[exact + 1] = 1;
        else if (offers.length) {
            const size = offers[0].minQuantity;
            counts[1] = Math.floor(quantity / size);
            counts[0] = quantity % size;
        } else counts[0] = quantity;
    }
    const packs = offers.flatMap((tier, i) =>
        counts[i + 1]
            ? [
                  {
                      quantity: tier.minQuantity,
                      totalPrice: choices[i + 1].amount / 100,
                      count: counts[i + 1],
                  },
              ]
            : [],
    );
    const allocations: QuantityAllocation[] = [];
    for (let i = 1; i < choices.length; i++) {
        if (!counts[i]) continue;
        const { quantity: size, amount } = choices[i];
        const high = amount % size,
            low = size - high;
        if (high)
            allocations.push({
                quantity: high * counts[i],
                unitPrice: Math.ceil(amount / size) / 100,
            });
        if (low)
            allocations.push({
                quantity: low * counts[i],
                unitPrice: Math.floor(amount / size) / 100,
            });
    }
    if (counts[0]) allocations.push({ quantity: counts[0], unitPrice: cents(price) / 100 });
    return {
        total: choices.reduce((sum, choice, i) => sum + choice.amount * counts[i], 0) / 100,
        packs,
        looseQuantity: counts[0],
        allocations,
    };
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
    const allocations = new Map<string, { parts: QuantityAllocation[]; index: number }>();
    const lines = items.map((item) => {
        const quantity = quantities.get(item.productId) ?? 0;
        if (!allocations.has(item.productId)) {
            allocations.set(item.productId, {
                parts: quantityPriceBreakdown(item.price, item.quantityDiscounts, quantity)
                    .allocations,
                index: 0,
            });
        }
        const allocation = allocations.get(item.productId)!;
        const parts: QuantityAllocation[] = [];
        let remaining = item.quantity;
        while (remaining > 0) {
            const part = allocation.parts[allocation.index];
            const count = Math.min(remaining, part.quantity);
            parts.push({ quantity: count, unitPrice: part.unitPrice });
            remaining -= count;
            part.quantity -= count;
            if (!part.quantity) allocation.index++;
        }
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
