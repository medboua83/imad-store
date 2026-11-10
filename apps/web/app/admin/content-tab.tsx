"use client";
import { useAdminLocale } from "./admin-locale";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { defaultSiteContent, homeSectionKeys, type HomeSection, type SiteContent } from "@imad-store/shared";
import {
    getContentAdmin,
    getProducts,
    getCategories,
    saveContent,
    uploadProductImage,
} from "@/lib/api";
import { HomeView } from "@/components/store/HomeView";
import { homeCatalogueQuery } from "@/lib/home-catalogue";
const homeSectionLabels: Record<HomeSection, string> = {
    collections: "Catégories de l’accueil",
    featured: "Produits mis en avant",
    banners: "Bannières de l’accueil",
    guide: "Guide de commande",
};

export default function ContentTab() {
    const { t, locale } = useAdminLocale();
    const [content, setContent] = useState<SiteContent>(defaultSiteContent);
    const [revision, setRevision] = useState(0);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [rollback, setRollback] = useState(false);
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [readbackPending, setReadbackPending] = useState(false);
    const lock = useRef(false);
    const catalogue = useQuery({
        queryKey: ["content-preview-catalogue"],
        queryFn: async () => {
            const [products, categories] = await Promise.all([
                getProducts(homeCatalogueQuery),
                getCategories(),
            ]);
            return { products: products.data, categories };
        },
        enabled: preview,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: false,
    });
    const readContent = useCallback(async () => {
        const result = await getContentAdmin();
        setContent(result.draft);
        setRevision(result.revision);
        setRollback(result.canRollback);
        setReady(true);
        setDirty(false);
        setReadbackPending(false);
    }, []);
    const load = useCallback(async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        try {
            await readContent();
        } catch {
            setMessage("Impossible de charger la configuration. Réessayez.");
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }, [readContent]);
    useEffect(() => {
        const task = setTimeout(() => {
            void load();
        }, 0);
        return () => clearTimeout(task);
    }, [load]);
    useEffect(() => {
        if (!dirty) return;
        const protect = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty]);
    const change = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
        setContent((old) => ({ ...old, [key]: value }));
        setDirty(true);
    };
    async function perform(action: "draft" | "publish" | "rollback") {
        if (lock.current || busy || readbackPending) return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        let written = false;
        try {
            await saveContent(action, revision, action === "draft" ? content : undefined);
            written = true;
            await readContent();
            setMessage(
                action === "draft"
                    ? "Brouillon enregistré. Les visiteurs ne le voient pas."
                    : action === "publish"
                      ? "Version publiée pour tous les visiteurs."
                      : "Version publique précédente restaurée.",
            );
        } catch (error) {
            if (written) setReadbackPending(true);
            setMessage(
                written
                    ? "Enregistrement effectué, mais relecture impossible. Rechargez la configuration avant de continuer. Vos valeurs restent affichées."
                    : (error as { response?: { data?: { error: string } } }).response?.data
                          ?.error || "Échec de la connexion. Vos modifications restent affichées.",
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }
    const homeSections = content.homeSections ?? homeSectionKeys;
    const hiddenSections = homeSectionKeys.filter((section) => !homeSections.includes(section));
    function moveHomeSection(index: number, direction: -1 | 1) {
        const next = index + direction;
        if (next < 0 || next >= homeSections.length) return;
        const sections = [...homeSections];
        [sections[index], sections[next]] = [sections[next], sections[index]];
        change("homeSections", sections);
    }
    const input = "admin-field mt-2";
    return (
        <div
            className="admin-panel admin-content-panel space-y-5"
            dir={locale === "ar" ? "rtl" : "ltr"}
        >
            <h2 className="text-2xl">{t("Accueil et informations du magasin")}</h2>
            <p>
                {t("Révision ")}
                {revision}
                {t(". Enregistrez le brouillon, vérifiez l’aperçu, puis publiez volontairement.")}
            </p>
            <p role="status">{t(message)}</p>
            <button
                className="action underline"
                disabled={busy}
                onClick={() => {
                    if (
                        !dirty ||
                        confirm(t("Recharger et abandonner les modifications non enregistrées ?"))
                    )
                        void load();
                }}
            >
                {t("Recharger la configuration")}
            </button>
            {!ready ? (
                <button className="action underline" disabled={busy} onClick={load}>
                    {t("Réessayer le chargement")}
                </button>
            ) : (
                <>
                    <fieldset className="content-edit-fields" disabled={busy}>
                        <legend className="sr-only">{t("Contenu du site")}</legend>
                        <div className="grid md:grid-cols-2 gap-4">
                            {(
                                [
                                    ["heroTitle", "Titre d’accueil"],
                                    ["heroSubtitle", "Texte d’introduction"],
                                    ["featuredTitle", "Titre de la sélection"],
                                    ["businessName", "Nom commercial"],
                                    ["businessAddress", "Adresse commerciale"],
                                ] as const
                            ).map(([key, label]) => (
                                <label key={key}>
                                    {t(label)}
                                    <input
                                        dir="auto"
                                        className={input}
                                        value={content[key]}
                                        maxLength={key === "heroTitle" ? 160 : 5000}
                                        onChange={(e) => change(key, e.target.value)}
                                    />
                                </label>
                            ))}
                            <label>
                                {t("Photo d’accueil")}
                                <input
                                    dir="auto"
                                    className="block mt-2"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    disabled={busy}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setBusy(true);
                                        try {
                                            change("heroImage", await uploadProductImage(file));
                                        } catch {
                                            setMessage(
                                                "Image invalide : PNG, JPEG ou WebP, 5 Mo maximum.",
                                            );
                                        } finally {
                                            setBusy(false);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <fieldset className="border border-white/20 p-4 space-y-3">
                            <legend>{t("Sections de l’accueil")}</legend>
                            <p className="admin-muted">{t("Les sections s’affichent dans cet ordre, sous le bandeau.")}</p>
                            <ol className="space-y-2">
                                {[...homeSections, ...hiddenSections].map((section, index) => {
                                    const visible = index < homeSections.length;
                                    const label = t(homeSectionLabels[section]);
                                    return (
                                        <li key={section} className="flex flex-wrap items-center gap-2">
                                            <label className="flex items-center gap-2 grow">
                                                <input
                                                    type="checkbox"
                                                    checked={visible}
                                                    onChange={(event) => change("homeSections", event.target.checked
                                                        ? [...homeSections, section]
                                                        : homeSections.filter((key) => key !== section))}
                                                />
                                                {label}
                                            </label>
                                            {visible && (
                                                <>
                                                    <button type="button" className="action" disabled={index === 0}
                                                        aria-label={`${t("Monter")} · ${label}`}
                                                        onClick={() => moveHomeSection(index, -1)}>↑</button>
                                                    <button type="button" className="action" disabled={index === homeSections.length - 1}
                                                        aria-label={`${t("Descendre")} · ${label}`}
                                                        onClick={() => moveHomeSection(index, 1)}>↓</button>
                                                </>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </fieldset>
                        <fieldset className="border border-white/20 p-4 space-y-4">
                            <legend>{t("Bannières (3 maximum)")}</legend>
                            {content.banners.map((banner, index) => (
                                <div key={index} className="grid md:grid-cols-3 gap-3">
                                    <label>
                                        {t("Titre")}
                                        <input
                                            dir="auto"
                                            className={input}
                                            value={banner.title}
                                            onChange={(e) =>
                                                change(
                                                    "banners",
                                                    content.banners.map((b, i) =>
                                                        i === index
                                                            ? { ...b, title: e.target.value }
                                                            : b,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        {t("Lien interne")}
                                        <input
                                            dir="auto"
                                            className={input}
                                            value={banner.href}
                                            onChange={(e) =>
                                                change(
                                                    "banners",
                                                    content.banners.map((b, i) =>
                                                        i === index
                                                            ? { ...b, href: e.target.value }
                                                            : b,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        {t("Photo")}
                                        <input
                                            dir="auto"
                                            className="block mt-3"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            disabled={busy}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setBusy(true);
                                                try {
                                                    const image = await uploadProductImage(file);
                                                    change(
                                                        "banners",
                                                        content.banners.map((b, i) =>
                                                            i === index ? { ...b, image } : b,
                                                        ),
                                                    );
                                                } catch {
                                                    setMessage("Téléversement impossible.");
                                                } finally {
                                                    setBusy(false);
                                                }
                                            }}
                                        />
                                    </label>
                                    <button
                                        className="underline action"
                                        onClick={() =>
                                            change(
                                                "banners",
                                                content.banners.filter((_, i) => i !== index),
                                            )
                                        }
                                    >
                                        {t("Retirer la bannière ")}
                                        {index + 1}
                                    </button>
                                </div>
                            ))}
                            <button
                                className="action underline"
                                disabled={content.banners.length >= 3}
                                onClick={() =>
                                    change("banners", [
                                        ...content.banners,
                                        {
                                            title: "Nouvelle bannière",
                                            image: content.heroImage,
                                            href: "/shop",
                                        },
                                    ])
                                }
                            >
                                {t("Ajouter une bannière")}
                            </button>
                        </fieldset>
                        {(
                            [
                                ["deliveryText", "Délais et modalités de livraison"],
                                ["returnsText", "Conditions d’échange et de retour"],
                                ["privacyText", "Informations complémentaires sur les données"],
                            ] as const
                        ).map(([key, label]) => (
                            <label className="block" key={key}>
                                {t(label)}
                                <textarea
                                    dir="auto"
                                    rows={4}
                                    className={input}
                                    value={content[key]}
                                    placeholder={
                                        key === "deliveryText"
                                            ? t(
                                                  "Villes desservies, délai de préparation et délai de transport, jours ouvrés, exceptions. Les frais affichés sont calculés depuis les réglages Commerce.",
                                              )
                                            : key === "returnsText"
                                              ? t(
                                                    "Délai pour demander un retour, état du produit, exclusions, frais et responsabilité du retour, procédure et traitement du remboursement.",
                                                )
                                              : t(
                                                    "À renseigner avec les informations exactes du magasin",
                                                )
                                    }
                                    onChange={(e) => {
                                        change(key, e.target.value);
                                        change("policiesVerified", false);
                                    }}
                                />
                            </label>
                        ))}
                        <p className="admin-muted">
                            {t(
                                "Complétez les délais et les conditions réelles avant de les publier. Sans texte validé, le site indique les informations manquantes et propose de contacter le magasin. Les frais de livraison restent reliés aux réglages Commerce.",
                            )}
                        </p>
                        <label className="flex gap-3">
                            <input
                                dir="auto"
                                type="checkbox"
                                checked={content.policiesVerified}
                                onChange={(e) => change("policiesVerified", e.target.checked)}
                            />
                            {t(
                                "Je confirme avoir vérifié l’exactitude des informations commerciales à publier.",
                            )}
                        </label>
                    </fieldset>
                    <div className="flex flex-wrap gap-3">
                        <button
                            className="admin-button primary"
                            disabled={busy || readbackPending}
                            onClick={() => perform("draft")}
                        >
                            {t("Enregistrer le brouillon")}
                        </button>
                        <button className="admin-button" onClick={() => setPreview(!preview)}>
                            {t("Aperçu du brouillon")}
                        </button>
                        <button
                            className="admin-button"
                            disabled={busy || dirty || readbackPending}
                            onClick={() => perform("publish")}
                        >
                            {t("Publier")}
                        </button>
                        <button
                            className="admin-button"
                            disabled={busy || !rollback || dirty || readbackPending}
                            onClick={() => perform("rollback")}
                        >
                            {t("Restaurer la version publique précédente")}
                        </button>
                    </div>
                    {dirty && (
                        <p>{t("Modifications non enregistrées : enregistrez avant de publier.")}</p>
                    )}
                    {preview && (
                        <section
                            className="store-shell admin-draft-preview"
                            aria-label={t("Aperçu privé du brouillon")}
                            dir="rtl"
                        >
                            <p
                                className="draft-preview-notice"
                                role="status"
                                dir={locale === "ar" ? "rtl" : "ltr"}
                            >
                                {t(
                                    "Aperçu privé : vos textes ne sont pas publiés. Les liens vers la boutique s’ouvrent dans un nouvel onglet pour conserver votre saisie.",
                                )}
                            </p>
                            {catalogue.isPending ? (
                                <p role="status">{t("Chargement du catalogue de l’aperçu…")}</p>
                            ) : catalogue.isError ? (
                                <div className="admin-alert" role="alert">
                                    <p>
                                        {t(
                                            "Le catalogue de l’aperçu est indisponible. Vos textes restent conservés.",
                                        )}
                                    </p>
                                    <button
                                        className="admin-button"
                                        onClick={() => void catalogue.refetch()}
                                    >
                                        {t("Réessayer")}
                                    </button>
                                </div>
                            ) : (
                                <HomeView
                                    content={content}
                                    products={catalogue.data.products}
                                    categories={catalogue.data.categories}
                                    preview
                                />
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
