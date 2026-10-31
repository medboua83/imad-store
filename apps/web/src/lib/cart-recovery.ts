import { quantityDiscounts } from "@imad-store/shared";
import type { StateStorage } from "zustand/middleware";
import type { CartItem } from "../store/cart.store";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 2000) : "");
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const image = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 2000 &&
  ((/^\/(?:images|uploads)\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes("..")) ||
    /^https:\/\/(?:res\.cloudinary\.com|placeholder\.co)\/[^\s]+$/.test(value));

/** Restore only item data, never persisted methods, open dialogs or arbitrary state. */
export function recoverCart(value: unknown): { items: CartItem[]; recovered: boolean } {
  if (value === undefined) return { items: [], recovered: false };
  if (!record(value) || !Array.isArray(value.items)) return { items: [], recovered: true };
  const items: CartItem[] = [];
  const seen = new Set<string>();
  let recovered = value.items.length > 100;
  for (const row of value.items.slice(0, 100)) {
    if (
      !record(row) ||
      !id(row.productId) ||
      !id(row.variantId) ||
      typeof row.productSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.productSlug) ||
      row.productSlug.length > 160 ||
      typeof row.price !== "number" ||
      !Number.isFinite(row.price) ||
      row.price < 0 ||
      row.price > 1_000_000 ||
      typeof row.quantity !== "number" ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 0 ||
      row.quantity > 10_000 ||
      typeof row.stock !== "number" ||
      !Number.isSafeInteger(row.stock) ||
      row.stock < 0 ||
      row.stock > 1_000_000 ||
      seen.has(row.variantId.toLowerCase())
    ) {
      recovered = true;
      continue;
    }
    seen.add(row.variantId.toLowerCase());
    const images = Array.isArray(row.images) ? row.images.filter(image).slice(0, 12) : [];
    if (!images.length && image(row.image)) images.push(row.image);
    items.push({
      productId: row.productId.toLowerCase(),
      variantId: row.variantId.toLowerCase(),
      productSlug: row.productSlug,
      price: row.price,
      quantity: row.quantity,
      stock: row.stock,
      nameFr: text(row.nameFr),
      nameAr: text(row.nameAr),
      nameEn: text(row.nameEn),
      colorNameFr: text(row.colorNameFr),
      colorNameAr: text(row.colorNameAr),
      colorNameEn: text(row.colorNameEn),
      ...(typeof row.size === "string" ? { size: text(row.size) } : {}),
      image: images[0] ?? "",
      images,
      freeShipping: row.freeShipping === true,
      quantityDiscounts: quantityDiscounts(row.price, row.quantityDiscounts),
    });
  }
  return { items, recovered };
}

/** Storage can be corrupt, disabled or full; keep the in-memory basket usable. */
export const cartStorage: StateStorage = {
  getItem(name) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (
        !record(parsed) ||
        !record(parsed.state) ||
        (parsed.version !== undefined && parsed.version !== 0)
      )
        throw new Error("Invalid cart storage");
      return raw;
    } catch {
      return JSON.stringify({ state: { items: null }, version: 0 });
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* Keep the live basket. */
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* Storage is optional. */
    }
  },
};
