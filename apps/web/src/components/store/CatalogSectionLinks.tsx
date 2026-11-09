import Link from "next/link";
import { catalogSections, type CatalogSection } from "@imad-store/shared";

export function CatalogSectionLinks({
    sections,
    active,
    allHref,
    hrefFor = (section) => `/shop?section=${section}`,
    onClick,
    newTab = false,
}: {
    sections: readonly CatalogSection[];
    active?: CatalogSection;
    allHref?: string;
    hrefFor?: (section: CatalogSection) => string;
    onClick?: () => void;
    newTab?: boolean;
}) {
    if (!sections.length && !active) return null;
    return (
        <nav className="catalog-sections" aria-label="أقسام المتجر">
            {allHref && (
                <Link prefetch={false} href={allHref} aria-current={!active ? "page" : undefined}>
                    كل الأقسام
                </Link>
            )}
            {sections.map((section) => (
                <Link
                    key={section}
                    prefetch={false}
                    href={hrefFor(section)}
                    aria-current={active === section ? "page" : undefined}
                    target={newTab ? "_blank" : undefined}
                    rel={newTab ? "noopener noreferrer" : undefined}
                    onClick={onClick}
                >
                    <span>{catalogSections[section].nameAr}</span>
                    <small lang="fr">{catalogSections[section].nameFr}</small>
                </Link>
            ))}
        </nav>
    );
}
