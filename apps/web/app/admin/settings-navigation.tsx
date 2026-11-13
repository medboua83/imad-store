"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, CreditCard, PackageCheck, RotateCcw, Share2, Truck } from "lucide-react";
import { useAdminLocale } from "./admin-locale";

const destinations = [
    { id: "social-settings", label: "Réseaux sociaux et WhatsApp", icon: Share2 },
    { id: "order-settings", label: "Gestion des commandes", icon: PackageCheck },
    { id: "carrier-settings", label: "Société de livraison", icon: Truck },
    { id: "shipping-settings", label: "Règles de livraison", icon: Truck, needsRules: true },
    { id: "return-settings", label: "Délais et retours", icon: RotateCcw, needsRules: true },
    { id: "meta-domain-settings", label: "Vérification du domaine Meta", icon: Share2 },
    { id: "pixel-settings", label: "Meta Pixel", icon: CreditCard, needsRules: true },
];

function focusDestination(id: string) {
    document.getElementById(id)?.focus();
}

export function SettingsNavigation({ rulesReady }: { rulesReady: boolean }) {
    const { t } = useAdminLocale();
    const restored = useRef(false);
    useEffect(() => {
        if (restored.current) return;
        const id = window.location.hash.slice(1);
        if (destinations.some((destination) => destination.id === id) && document.getElementById(id)) {
            restored.current = true;
            focusDestination(id);
        }
    }, [rulesReady]);
    return (
        <nav className="admin-settings-navigation" aria-label={t("Accès rapide aux réglages")}>
            <label htmlFor="admin-setting-destination">{t("Aller à un réglage")}</label>
            <select id="admin-setting-destination" value="" onChange={(event) => {
                const id = event.target.value;
                if (!id) return;
                window.location.hash = id;
                focusDestination(id);
            }}>
                <option value="">{t("Choisir un réglage…")}</option>
                {destinations.map(({ id, label, needsRules }) => (
                    <option key={id} value={id} disabled={needsRules && !rulesReady}>{t(label)}</option>
                ))}
            </select>
            <div className="admin-settings-shortcuts">
                {destinations.map(({ id, label, icon: Icon, needsRules }) => (
                    <a key={id} href={`#${id}`} aria-disabled={needsRules && !rulesReady ? true : undefined}
                        onClick={(event) => {
                            if (needsRules && !rulesReady) { event.preventDefault(); return; }
                            requestAnimationFrame(() => focusDestination(id));
                        }}>
                        <Icon size={18} aria-hidden="true" />
                        <span>{t(label)}</span>
                        <ArrowDown size={14} aria-hidden="true" />
                    </a>
                ))}
            </div>
        </nav>
    );
}
