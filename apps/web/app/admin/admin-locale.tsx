"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adminArabic } from "./admin-translations";

type AdminLocale = "fr" | "ar";
type TextValues = Readonly<Record<string, unknown>>;
const messageTemplates = Object.entries(adminArabic)
    .filter(([key]) => /\{\w+\}/.test(key))
    .map(([key, translation]) => {
        const names: string[] = [];
        const pattern = key
            .split(/(\{\w+\})/)
            .map((part) => {
                if (/^\{\w+\}$/.test(part)) {
                    names.push(part.slice(1, -1));
                    return "(.+?)";
                }
                return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            })
            .join("");
        return { pattern: new RegExp(`^${pattern}$`, "u"), names, translation };
    });
const preferenceKey = "imad-admin-language";
const AdminLocaleContext = createContext<{
    locale: AdminLocale;
    setLocale: (locale: AdminLocale) => void;
    t: (text: string, values?: TextValues) => string;
}>({ locale: "fr", setLocale: () => {}, t: (text) => text });

export function translateAdminText(text: string, locale: AdminLocale, values?: TextValues): string {
    if (!text) return text;
    const key = text.replace(/\s+/g, " ").trim();
    let translated = locale === "ar" ? adminArabic[key] : undefined;
    let replacements = values;
    if (locale === "ar" && translated === undefined) {
        for (const template of messageTemplates) {
            const match = template.pattern.exec(text.trim());
            if (!match) continue;
            translated = template.translation;
            replacements = Object.fromEntries(
                template.names.map((name, index) => [
                    name,
                    name === "status"
                        ? (adminArabic[match[index + 1]] ?? match[index + 1])
                        : match[index + 1],
                ]),
            );
            break;
        }
    }
    const result =
        translated !== undefined
            ? `${/^\s/.test(text) ? " " : ""}${translated}${/\s$/.test(text) ? " " : ""}`
            : text;
    return result.replace(/\{(\w+)\}/g, (token, name: string) =>
        replacements && Object.hasOwn(replacements, name) ? String(replacements[name]) : token,
    );
}

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
    const [locale, changeLocale] = useState<AdminLocale>("fr");
    useEffect(() => {
        const restore = () => {
            try {
                changeLocale(localStorage.getItem(preferenceKey) === "ar" ? "ar" : "fr");
            } catch {
                /* Keep the current language when browser storage is unavailable. */
            }
        };
        const timer = setTimeout(restore, 0);
        const sync = (event: StorageEvent) => {
            if (event.key === preferenceKey) restore();
        };
        window.addEventListener("storage", sync);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("storage", sync);
        };
    }, []);
    const setLocale = useCallback((value: AdminLocale) => {
        changeLocale(value);
        try {
            localStorage.setItem(preferenceKey, value);
        } catch {
            /* Language still changes in this tab. */
        }
    }, []);
    const t = useCallback(
        (text: string, values?: TextValues) => translateAdminText(text, locale, values),
        [locale],
    );
    return (
        <AdminLocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </AdminLocaleContext.Provider>
    );
}

export const useAdminLocale = () => useContext(AdminLocaleContext);

export function AdminLanguageSelect() {
    const { locale, setLocale } = useAdminLocale();
    return (
        <div className="admin-language-select">
            <label htmlFor="admin-language">Français / العربية</label>
            <select
                id="admin-language"
                aria-label="Langue de l’administration / لغة لوحة الإدارة"
                value={locale}
                onChange={(event) => setLocale(event.target.value === "ar" ? "ar" : "fr")}
            >
                <option value="fr" lang="fr">
                    Français
                </option>
                <option value="ar" lang="ar">
                    العربية
                </option>
            </select>
        </div>
    );
}
