"use client";
import { ArrowUpLeft, MessageCircle } from "lucide-react";
import { useStoreContacts } from "@/lib/use-store-contacts";

export function ContactWhatsAppButton({ initialHref = "" }: { initialHref?: string }) {
    const contacts = useStoreContacts();
    const href = contacts ? contacts.whatsappUrl : initialHref;
    if (!href) return null;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary contact-whatsapp"
            aria-label="تواصلوا عبر واتساب — نافذة جديدة"
        >
            <MessageCircle size={20} aria-hidden="true" />
            تواصلوا عبر واتساب
            <ArrowUpLeft size={18} aria-hidden="true" />
        </a>
    );
}
