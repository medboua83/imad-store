import { isAmbiguousSize } from "@imad-store/shared";
type ProductCopy = {
  nameAr?: string;
  nameFr?: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEn?: string;
};
/** Display-only WhatsApp/Markdown cleanup; never render merchant copy as HTML. */
export function cleanProductText(text: string): string {
  return text
    .replace(/^\s{0,3}(?:>\s*)+/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(^|[\s(])(\*{1,2}|_{1,2})(\S(?:.*?\S)?)\2(?=$|[\s).,!،؛؟:])/gm, "$1$3")
    // Drop recognisable editorial prefaces, not product facts or arbitrary lines.
    .replace(/^\s*(?:هاهي|ها\s+هي)\s+(?:ال\u0640*\s*)?ad\s*copy\b[^\n]*(?:\n|$)/gim, "")
    .replace(/^\s*(?:ad\s*copy|النص\s+للموقع)\s*[:：]\s*/gim, "")
    .replace(/^\s*الموديل\s+(?:الأول|الثاني|الثالث)\s*[-–—:]\s*/gm, "")
    .trim();
}
export function productDescription(product: ProductCopy): string {
  const description = cleanProductText(
    [product.descriptionAr, product.descriptionFr, product.descriptionEn]
      .find((text) => text?.trim())
      ?.trim() || ""
  );
  return description || `${[product.nameAr, product.nameFr, product.nameEn].find((name) => name?.trim())?.trim() || "المنتج"}. اختاروا اللون والمقاس من الخيارات المتاحة، وراجعوا السعر والتوصيل قبل تأكيد الطلب.`;
}
/** Keep the merchant's wording; only introduce readable paragraph boundaries. */
export function descriptionParagraphs(text: string): string[] {
  return cleanProductText(text)
    .split(/\n+/)
    .filter((part) => part.trim())
    .flatMap((part) => {
      const sentences = part.split(/(?<=[.!؟])\s+/);
      const paragraphs: string[] = [];
      for (const sentence of sentences) {
        const previous = paragraphs[paragraphs.length - 1];
        if (previous && previous.length + sentence.length < 350)
          paragraphs[paragraphs.length - 1] += ` ${sentence}`;
        else paragraphs.push(sentence.trim());
      }
      return paragraphs;
    });
}
export function descriptionBlocks(text: string): { type: "paragraph" | "list"; lines: string[] }[] {
  const blocks: { type: "paragraph" | "list"; lines: string[] }[] = [];
  for (const line of descriptionParagraphs(text)) {
    const item = line.match(/^\s*[-•*]\s+(.+)$/);
    if (item) {
      const last = blocks.at(-1);
      if (last?.type === "list") last.lines.push(item[1]);
      else blocks.push({ type: "list", lines: [item[1]] });
    } else blocks.push({ type: "paragraph", lines: [line] });
  }
  return blocks;
}
export const sellableVariants = <T extends { size?: string | null }>(variants: T[]) =>
  variants.filter((variant) => !isAmbiguousSize(variant.size));

/** Display normalization only: SKU, raw size and stock remain unchanged. */
export const sizeKey = (size?: string | null) => (size || "").trim().toLowerCase();
export function sizeLabel(size?: string | null): string {
  const key = sizeKey(size);
  if (!key || ["unique", "one size", "taille unique"].includes(key)) return "مقاس موحد";
  if (key === "standard") return "قياسي";
  return /^(?:x{0,3}[sl]|m|[2-4]xl)$/i.test(key) ? key.toUpperCase() : (size || "").trim();
}
/** Group display labels only; each underlying colour/SKU remains unchanged. */
export function distinctColorLabels(options: { value: string; label: string }[]) {
  const groups = new Map<string, { label: string; values: Set<string> }>();
  for (const option of options) {
    const label = option.label.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/باج/g, "بيج");
    const key = label.toLocaleLowerCase();
    const group = groups.get(key) ?? { label, values: new Set<string>() };
    group.values.add(option.value);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap(({ label, values }) => {
    const entries = [...values].sort();
    if (entries.length > 1 && entries.length <= 100 && entries.every(value => /^#[0-9a-f]{6}$/i.test(value)))
      return [{ label, value: `group:${entries.join(",")}` }];
    return entries.map(value => ({ value, label: entries.length > 1 ? `${label} (${value})` : label }));
  });
}
export function orderedSizes(variants: { size?: string | null }[]): string[] {
  const clothing = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL"];
  return [...new Map(variants.map((v) => [sizeKey(v.size), v.size || ""])).values()].sort((a, b) => {
    const first = clothing.indexOf(a.toUpperCase()),
      second = clothing.indexOf(b.toUpperCase());
    if (first >= 0 && second >= 0) return first - second;
    return a.localeCompare(b, "en", { numeric: true });
  });
}
