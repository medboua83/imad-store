import type { Metadata } from "next";

/** Use the installation URL, or the public request host when hosting omits SITE_URL. */
export function resolvePublicOrigin(configured: string | undefined, host: string | null): URL {
  const value = configured?.trim();
  if (value) {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Invalid SITE_URL");
    return new URL(url.origin);
  }
  if (!host || !/^[a-z0-9.[\]:-]+$/i.test(host)) throw new Error("Public host unavailable");
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return new URL(`${local ? "http" : "https"}://${host}`);
}
const text = (...values: (string | undefined)[]) =>
  (values.find((v) => v?.trim()) || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function productShareMetadata(
  product: {
    slug: string;
    nameAr?: string;
    nameFr?: string;
    nameEn?: string;
    descriptionAr?: string;
    descriptionFr?: string;
    descriptionEn?: string;
    images: string[];
  },
  origin: URL,
): Metadata {
  const title = text(product.nameAr, product.nameFr, product.nameEn);
  const description = text(
    product.descriptionAr,
    product.descriptionFr,
    product.descriptionEn,
    title,
  ).slice(0, 200);
  const url = new URL(`/products/${encodeURIComponent(product.slug)}`, origin).href;
  const images = product.images
    .flatMap((value) => {
      try {
        if (!value.trim()) return [];
        const image = new URL(value, origin);
        return ["https:", "http:"].includes(image.protocol) && !image.username && !image.password
          ? [{ url: image.href, alt: title }]
          : [];
      } catch {
        return [];
      }
    })
    .slice(0, 1);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "IMAD Mode",
      locale: "ar_MA",
      url,
      title,
      description,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
