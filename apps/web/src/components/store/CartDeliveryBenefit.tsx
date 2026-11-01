"use client";
import { Truck } from "lucide-react";
import type { useShipping } from "@/hooks/useShipping";

export function CartDeliveryBenefit({
  subtotal,
  shipping,
  needsReview = false,
}: {
  subtotal: number;
  shipping: ReturnType<typeof useShipping>;
  needsReview?: boolean;
}) {
  const settings = shipping.settings;
  if (
    needsReview ||
    !settings ||
    settings.codEnabled === false ||
    shipping.loading ||
    shipping.error ||
    shipping.fee === null ||
    !Number.isFinite(subtotal) ||
    subtotal < 0
  )
    return null;

  const free = shipping.fee === 0;
  const threshold = settings.freeShippingMin;
  const remaining = (Math.round(threshold * 100) - Math.round(subtotal * 100)) / 100;
  if (!free && (!Number.isFinite(threshold) || threshold <= 0 || remaining <= 0)) return null;

  return (
    <div
      className={`store-delivery-benefit${free ? " is-free" : ""}`}
      role="status"
      aria-label="حالة التوصيل"
    >
      <Truck size={21} aria-hidden="true" />
      <div>
        {free ? (
          <>
            <p>
              <strong>التوصيل مجاني لطلبكم</strong>
            </p>
            <small>راجعوا الإجمالي أدناه قبل تأكيد الطلب.</small>
          </>
        ) : (
          <>
            <p>
              باقي{" "}
              <strong>
                <bdi>{remaining.toFixed(2)} MAD</bdi>
              </strong>{" "}
              للتوصيل المجاني
            </p>
            <small>يُحتسب المبلغ بعد العروض.</small>
            <progress
              max={threshold}
              value={Math.min(subtotal, threshold)}
              aria-label="التقدم نحو التوصيل المجاني"
              aria-valuetext={`${subtotal.toFixed(2)} MAD من ${threshold.toFixed(2)} MAD`}
            />
          </>
        )}
      </div>
    </div>
  );
}
