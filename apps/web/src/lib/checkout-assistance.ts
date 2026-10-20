import { ORDER_WHATSAPP_NOTICE_VERSION } from "@imad-store/shared";

/** Snapshot the checked control at submission, before asynchronous cart/shipping refreshes. */
export function checkoutAssistance(data: Pick<FormData, "get">) {
    const accepted = data.get("aiServiceConsent") === "true";
    return {
        aiServiceConsent: accepted,
        ...(accepted ? { aiServiceConsentVersion: ORDER_WHATSAPP_NOTICE_VERSION } : {}),
    };
}

export function assertAssistanceReceipt(
    requested: { aiServiceConsent?: boolean; aiServiceConsentVersion?: string },
    recorded: { aiServiceConsent?: boolean; aiServiceConsentVersion?: string },
) {
    if (requested.aiServiceConsent === true &&
        (recorded.aiServiceConsent !== true || recorded.aiServiceConsentVersion !== requested.aiServiceConsentVersion)) {
        const message = "تم تسجيل الطلب، لكن لم نتأكد من حفظ موافقتكم على المساعدة عبر واتساب. تواصلوا مع المتجر برقم الطلب ولا تعيدوا إنشاءه.";
        throw Object.assign(new Error(message), { response: { data: { error: message } } });
    }
}
