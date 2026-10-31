"use client";
import { useCartStore } from "@/store/cart.store";
export function CartRecoveryNotice() {
  const recovered = useCartStore((s) => s.cartRecovered);
  const dismiss = useCartStore((s) => s.dismissRecovery);
  if (!recovered) return null;
  return (
    <div className="cart-recovery-notice" role="status">
      <p>تعذر استعادة بعض عناصر الحقيبة. راجعوا اختياراتكم قبل المتابعة.</p>
      <button type="button" onClick={dismiss}>
        حسناً، فهمت
      </button>
    </div>
  );
}
