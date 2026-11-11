"use client";
import { ArrowUpLeft, MessageCircle } from "lucide-react";
import { useStoreContacts } from "@/lib/use-store-contacts";

export function ContactWhatsAppButton() {
    const contacts = useStoreContacts();
    if (!contacts?.whatsappUrl) return null;
    return (
        <a
            href={contacts.whatsappUrl}
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
