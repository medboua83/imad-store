/** Search labels only; never change saved names, references or variant identities. */
function searchable(value: string) {
    return value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\u0640/g, "")
        .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x6f0 : 0x660)))
        .toLocaleLowerCase();
}

export function matchesCatalogueSearch(fields: (string | null | undefined)[], query: string) {
    const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const labels = fields.filter((field): field is string => typeof field === "string").map(searchable);
    return terms.every(term => labels.some(label => label.includes(term)));
}
