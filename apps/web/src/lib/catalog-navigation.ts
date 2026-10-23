import type { Category } from "./api";
export const publishedCategories = (categories: Category[]) =>
    categories.filter((c) => (c.publishedCount ?? 0) > 0);
