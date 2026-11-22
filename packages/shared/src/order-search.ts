/** Shared interpretation of a visible order reference and a formatted phone query. */
export function orderSearchReference(search: string): string {
    const value = search.trim();
    return /^#?[a-f0-9]+$/i.test(value) ? value.replace(/^#/, "") : value;
}
export function orderSearchPhone(search: string): string {
    if (!/^[+\d\s().-]+$/.test(search.trim())) return "";
    const digits = search.replace(/\D/g, "").replace(/^(?:00212|212|0)(?=[5-7]\d{8}$)/, "");
    return digits.length >= 3 ? digits : "";
}
