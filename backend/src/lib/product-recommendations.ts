import { z } from "zod";
import { isAmbiguousSize } from "@imad-store/shared";
import { objectIdSchema, isPublishableImage } from "./validation";
import { AppError } from "../middleware/error.middleware";

const ids = z
    .array(objectIdSchema.transform(value => value.toLowerCase()))
    .max(4)
    .refine((v) => new Set(v).size === v.length, "Produit sélectionné plusieurs fois");
export const recommendationSettingsSchema = z
    .object({
        enabled: z.boolean(),
        upsellProductIds: ids,
        crossSellProductIds: ids,
    })
    .strict();
export function recommendationSettings(value: unknown) {
    const parsed = recommendationSettingsSchema.safeParse(value);
    return parsed.success
        ? parsed.data
        : { enabled: false, upsellProductIds: [], crossSellProductIds: [] };
}
export async function validateRecommendationTargets(
    db: any,
    value: z.infer<typeof recommendationSettingsSchema> | undefined,
    self?: string,
) {
    if (!value) return;
    const selected = [...new Set([...value.upsellProductIds, ...value.crossSellProductIds])];
    if (self && selected.includes(self))
        throw new AppError("Un produit ne peut pas se recommander lui-même", 400);
    if (
        selected.length &&
        (await db.product.count({ where: { id: { in: selected } } })) !== selected.length
    )
        throw new AppError(
            "Une recommandation ne figure pas dans le catalogue de cette boutique",
            400,
        );
}
export function recommendable(product: any) {
    return (
        product.status === "ACTIVE" &&
        !product.slug.startsWith("test-19a-") &&
        product.slug !== "demo-bag-sample" &&
        product.images.some(
            (image: string) => isPublishableImage(image) && !image.includes("cloudinary.com/demo/"),
        ) &&
        product.variants.some((v: any) => v.stock > 0 && !isAmbiguousSize(v.size))
    );
}
