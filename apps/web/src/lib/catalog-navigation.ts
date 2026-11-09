import type { Category } from "./api";
import { catalogSectionKeys, catalogSections } from "@imad-store/shared";
export const publishedCategories = (categories: Category[]) =>
    categories.filter((c) => (c.publishedCount ?? 0) > 0);

export function availableCatalogSections(categories: Category[]) {
    const published = publishedCategories(categories);
    return catalogSectionKeys.filter((key) =>
        published.some((category) => catalogSections[key].categorySlugs.includes(category.slug)),
    );
}
