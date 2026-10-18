import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/api";
export function ProductCard({ product: p }: { product: Product }) {
    const name = p.nameAr || p.nameFr;
    return (
        <article className="bg-white rounded-xl overflow-hidden border border-[#ded6cc]">
            <Link prefetch={false} href={`/products/${p.slug}`} className="relative aspect-[4/5] block bg-[#F5EDE0]">
                {p.images[0] && (
                    <Image
                        src={p.images[0]}
                        alt={name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                    />
                )}
            </Link>
            <div className="p-4 space-y-3">
                <h2 className="text-xl">
                    <Link prefetch={false} href={`/products/${p.slug}`} className="hover:underline">
                        {name}
                    </Link>
                </h2>
                <p>{p.price.toFixed(2)} MAD</p>
                <p className="text-sm">
                    {p.variants.some((v) => v.stock > 0) ? "متوفر" : "نفدت الكمية"}
                </p>
                <Link prefetch={false} href={`/products/${p.slug}`} className="action underline">
                    اختيار اللون والمقاس
                </Link>
            </div>
        </article>
    );
}
