"use client";
import { BrandName } from "@/components/BrandingProvider";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { productVariantImages, shippingCityLabel } from "@imad-store/shared";
import type { AdminOrder } from "@/lib/api";
import { ProductPhoto } from "./ProductPhoto";
import { sizeLabel } from "@/lib/product-presentation";

/** A receipt of the saved order, independent of the basket which has been cleared. */
export function OrderReceipt({ order }: { order: AdminOrder }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  const fee =
    typeof order.shippingCost === "number" && Number.isFinite(order.shippingCost)
      ? order.shippingCost
      : null;
  const lines = order.items ?? [];
  const subtotal = lines.length
    ? lines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    : fee !== null
      ? order.totalAmount - fee
      : null;
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  function closed() {
    setOpen(false);
    document.getElementById("checkout-show-receipt")?.focus();
  }
  return (
    <section className="page-shell checkout-success" role="status">
      <p className="eyebrow"><BrandName original="IMAD MODE" /></p>
      <h1>تم تسجيل طلبكم.</h1>
      <button id="checkout-show-receipt" className="btn-primary" onClick={() => setOpen(true)}>
        عرض تفاصيل الطلب
      </button>
      <Link href="/shop" className="text-link">
        العودة إلى المتجر
      </Link>
      <dialog
        ref={dialog}
        className="order-receipt-dialog"
        aria-labelledby="order-receipt-title"
        onClose={closed}
      >
        <header className="order-receipt-header">
          <CheckCircle2 size={30} aria-hidden="true" />
          <div>
            <h2 id="order-receipt-title">وصلنا طلبكم، شكراً لكم.</h2>
            <p>
              رقم الطلب <strong dir="ltr">{order.id.slice(-8).toUpperCase()}</strong>
            </p>
          </div>
          <button
            type="button"
            className="order-receipt-close"
            aria-label="إغلاق تفاصيل الطلب"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </header>
        <div className="order-receipt-body">
          <p>
            {order.confirmationMethod === "SITE"
              ? "تم تأكيد طلبكم مباشرة على الموقع. لا يلزم تأكيد إضافي عبر واتساب."
              : "سيتواصل معكم فريقنا لتأكيد التفاصيل."}
          </p>
          <h3>المنتجات المطلوبة</h3>
          {lines.length ? (
            <ul className="order-receipt-items">
              {lines.map((item) => (
                <li key={item.id}>
                  <div className="order-receipt-photo">
                    <ProductPhoto
                      images={productVariantImages(
                        {
                          images: item.product?.images ?? [],
                          colorPhotos: item.product?.colorPhotos,
                        },
                        item.variant
                          ? {
                              color: item.variant.color ?? "",
                              colorNameFr: item.variant.colorNameFr ?? "",
                              colorNameAr: item.variant.colorNameAr ?? "",
                              colorNameEn: item.variant.colorNameEn ?? "",
                            }
                          : undefined,
                      )}
                      name={item.product?.nameAr || item.product?.nameFr || "المنتج المطلوب"}
                      sizes="64px"
                      className="object-contain"
                      thumbnail
                    />
                  </div>
                  <div>
                    <strong>
                      {item.product?.nameAr ||
                        item.product?.nameFr ||
                        item.product?.nameEn ||
                        "المنتج المطلوب"}
                    </strong>
                    <p>
                      {[
                        item.variant?.colorNameAr ||
                          item.variant?.colorNameFr ||
                          item.variant?.colorNameEn,
                        item.variant?.size ? sizeLabel(item.variant.size) : undefined,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p>
                      {item.quantity} قطعة × <bdi>{item.unitPrice.toFixed(2)} MAD</bdi>
                    </p>
                    {item.variant?.sku && (
                      <small>
                        مرجع المنتج: <bdi>{item.variant.sku}</bdi>
                      </small>
                    )}
                  </div>
                  <strong dir="ltr">{(item.quantity * item.unitPrice).toFixed(2)} MAD</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>تفاصيل المنتجات غير متاحة في إيصال الطلب.</p>
          )}
          {(order.street || order.city) && (
            <address>
              {order.street}
              {order.street && order.city ? "، " : ""}
              {order.city ? shippingCityLabel(order.city) : ""}
            </address>
          )}
          <dl className="order-receipt-totals" aria-label="المبالغ المسجلة للطلب">
            <div>
              <dt>قيمة المنتجات</dt>
              <dd dir="ltr">
                {subtotal !== null && Number.isFinite(subtotal)
                  ? `${subtotal.toFixed(2)} MAD`
                  : "—"}
              </dd>
            </div>
            <div className="order-receipt-shipping">
              <dt>رسوم التوصيل</dt>
              <dd>
                {fee === null ? (
                  "غير متاحة في الإيصال"
                ) : fee === 0 ? (
                  <span>
                    مجاني <bdi>(0.00 MAD)</bdi>
                  </span>
                ) : (
                  <bdi>{fee.toFixed(2)} MAD</bdi>
                )}
              </dd>
            </div>
            <div className="order-receipt-total">
              <dt>الإجمالي شامل التوصيل</dt>
              <dd dir="ltr">{order.totalAmount.toFixed(2)} MAD</dd>
            </div>
          </dl>
          <p>الدفع عند الاستلام. المبلغ الإجمالي أعلاه يشمل رسوم التوصيل.</p>
          <Link href="/shop" className="btn-primary">
            العودة إلى المتجر
          </Link>
        </div>
      </dialog>
    </section>
  );
}
