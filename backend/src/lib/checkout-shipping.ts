import { canonicalShippingCity, normalizeShippingPhone } from "@imad-store/shared";
import { z } from "zod";

/** New orders only: leave historical idempotency fingerprints and replays unchanged. */
export const checkoutDeliverySchema = z.object({
  customer: z.object({
    fullName: z.string().trim().min(3, "الاسم الكامل: 3 أحرف على الأقل").max(120),
    street: z
      .string()
      .trim()
      .min(5, "أدخلوا العنوان الكامل")
      .max(124, "العنوان: 124 حرفاً كحد أقصى"),
    phone: z.string().transform((value, ctx) => {
      const phone = normalizeShippingPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "رقم الهاتف المغربي غير صالح" });
        return z.NEVER;
      }
      return phone;
    }),
    city: z.string().transform((value, ctx) => {
      const city = canonicalShippingCity(value);
      if (!city) {
        ctx.addIssue({ code: "custom", message: "اختاروا مدينة التوصيل من القائمة" });
        return z.NEVER;
      }
      return city;
    }),
  }),
});
