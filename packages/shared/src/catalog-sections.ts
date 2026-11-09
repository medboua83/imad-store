export const catalogSectionKeys = ["women", "men"] as const;
export type CatalogSection = (typeof catalogSectionKeys)[number];

export const catalogSections: Record<
    CatalogSection,
    { nameAr: string; nameFr: string; categorySlugs: readonly string[] }
> = {
    women: {
        nameAr: "نساء",
        nameFr: "Femme",
        categorySlugs: ["abayas-d-hiver", "manteau-femme", "echarpe", "cap-fourrier"],
    },
    men: {
        nameAr: "رجال",
        nameFr: "Homme",
        categorySlugs: ["mens-clogs"],
    },
};
