import { notFound } from "next/navigation";
import ShopPage from "../../shop/page";
import { publishedCategories } from "@/lib/catalog-navigation";
import { publicCategories, requestSiteOrigin } from "@/lib/server-api";
import { collectionShareMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function collection(slug: string) {
    const category = publishedCategories(await publicCategories()).find((entry) => entry.slug === slug);
    if (!category) notFound();
    return category;
}

export async function generateMetadata({ params }: Props) {
    const [{ slug }, origin] = await Promise.all([params, requestSiteOrigin()]);
    return collectionShareMetadata(await collection(slug), origin);
}

export default async function CollectionPage({ params, searchParams }: Props) {
    const { slug } = await params;
    const category = await collection(slug);
    const query = await searchParams;
    return <ShopPage searchParams={Promise.resolve({ ...query, category: category.slug })} />;
}
