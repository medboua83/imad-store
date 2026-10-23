import { isAmbiguousSize } from "@imad-store/shared";
type ProductCopy = {
  nameAr?: string;
  nameFr?: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEn?: string;
};
export function productDescription(product: ProductCopy): string {
  return (
    [product.descriptionAr, product.descriptionFr, product.descriptionEn]
      .find((text) => text?.trim())
      ?.trim() ||
    `${[product.nameAr, product.nameFr, product.nameEn].find((name) => name?.trim())?.trim() || "المنتج"}. اختاروا اللون والمقاس من الخيارات المتاحة، وراجعوا السعر والتوصيل قبل تأكيد الطلب.`
  );
}
/** Keep the merchant's wording; only introduce readable paragraph boundaries. */
export function descriptionParagraphs(text: string): string[] {
  return text
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
export const sellableVariants = <T extends { size?: string | null }>(variants: T[]) =>
  variants.filter((variant) => !isAmbiguousSize(variant.size));
