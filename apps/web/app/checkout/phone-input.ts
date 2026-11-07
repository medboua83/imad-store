import { normalizeShippingPhone } from "@imad-store/shared";

export function checkoutPhoneDigits(value: string): string {
    return value.replace(/[٠-٩۰-۹]/g, (digit) =>
        String(digit.charCodeAt(0) - (digit <= "٩" ? 0x660 : 0x6f0)),
    );
}
/** Format only complete, valid numbers on blur; never truncate or move a typing cursor. */
export function formatCheckoutPhone(value: string): string {
    const digits = checkoutPhoneDigits(value);
    const compact = digits.replace(/[\s().-]/g, "").replace(/^00212/, "+212");
    if (!normalizeShippingPhone(compact)) return digits;
    return compact.startsWith("+")
        ? compact.replace(/^(\+212)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5 $6")
        : compact.replace(/(\d{2})(?=\d)/g, "$1 ");
}
