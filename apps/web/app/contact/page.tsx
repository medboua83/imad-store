import Link from "next/link";
import { ShoppingQuestions } from "@/components/store/ShoppingQuestions";
import { storeWhatsAppUrl } from "@/lib/store-contact";
import { ArrowUpLeft, MessageCircle, PackageCheck, RotateCcw, CircleHelp } from "lucide-react";

export const metadata = { title: "تواصلوا معنا", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <section className="page-shell contact-page" dir="rtl">
      <div className="contact-intro">
        <p className="contact-eyebrow">IMAD Mode · نحن هنا للمساعدة</p>
        <h1>تواصلوا معنا</h1>
        <p>للاستفسار عن المنتجات أو متابعة طلبكم، تواصلوا مع فريق IMAD Mode عبر واتساب.</p>
        <a
          href={storeWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary contact-whatsapp"
          aria-label="تواصلوا عبر واتساب — نافذة جديدة"
        >
          <MessageCircle size={20} aria-hidden="true" />
          تواصلوا عبر واتساب
          <ArrowUpLeft size={18} aria-hidden="true" />
        </a>
        <p className="contact-service-note">لتسهيل المساعدة، أرسلوا اسم المنتج أو مرجع الطلب مع رسالتكم.</p>
      </div>
      <nav className="contact-shortcuts" aria-label="مساعدة سريعة">
        <Link href="/delivery">
          <PackageCheck size={24} aria-hidden="true" />
          <span>
            <strong>التوصيل والدفع</strong>
            <small>الرسوم والمدة قبل تأكيد الطلب</small>
          </span>
        </Link>
        <Link href="/returns">
          <RotateCcw size={24} aria-hidden="true" />
          <span>
            <strong>الاستبدال والإرجاع</strong>
            <small>المدة والخطوات ورسوم الإرجاع</small>
          </span>
        </Link>
        <Link href="#questions">
          <CircleHelp size={24} aria-hidden="true" />
          <span>
            <strong>أسئلة قبل الطلب</strong>
            <small>المقاس واللون وطريقة الطلب</small>
          </span>
        </Link>
      </nav>
      <ShoppingQuestions />
      <Link href="/shop" className="contact-back">
        العودة إلى المتجر
      </Link>
    </section>
  );
}
