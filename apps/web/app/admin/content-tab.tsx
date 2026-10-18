"use client";
import { useEffect, useState } from "react";
import { defaultSiteContent, type SiteContent } from "@imad-store/shared";
import { getContentAdmin, saveContent, uploadProductImage } from "@/lib/api";
import { HomeView } from "@/components/store/HomeView";
export default function ContentTab() {
    const [content, setContent] = useState<SiteContent>(defaultSiteContent);
    const [revision, setRevision] = useState(0);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [rollback, setRollback] = useState(false);
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState(false);
    const [dirty, setDirty] = useState(false);
    async function load() {
        try {
            const result = await getContentAdmin();
            setContent(result.draft);
            setRevision(result.revision);
            setRollback(result.canRollback);
            setReady(true);
            setDirty(false);
        } catch {
            setMessage("Impossible de charger la configuration. Réessayez.");
        }
    }
    useEffect(() => {
        void getContentAdmin()
            .then((result) => {
                setContent(result.draft);
                setRevision(result.revision);
                setRollback(result.canRollback);
                setReady(true);
            })
            .catch(() => setMessage("Impossible de charger la configuration."));
    }, []);
    const change = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
        setContent((old) => ({ ...old, [key]: value }));
        setDirty(true);
    };
    async function perform(action: "draft" | "publish" | "rollback") {
        setBusy(true);
        setMessage("");
        try {
            await saveContent(action, revision, action === "draft" ? content : undefined);
            await load();
            setMessage(
                action === "draft"
                    ? "Brouillon enregistré. Les visiteurs ne le voient pas."
                    : action === "publish"
                      ? "Version publiée pour tous les visiteurs."
                      : "Version publique précédente restaurée.",
            );
        } catch (error) {
            setMessage(
                (error as { response?: { data?: { error: string } } }).response?.data?.error ||
                    "Échec de la connexion. Vos modifications restent affichées.",
            );
        } finally {
            setBusy(false);
        }
    }
    const input = "admin-field mt-2";
    return (
        <div className="admin-panel admin-content-panel space-y-5" dir="ltr">
            <h2 className="text-2xl">Accueil et informations du magasin</h2>
            <p>
                Révision {revision}. Enregistrez le brouillon, vérifiez l’aperçu, puis publiez
                volontairement.
            </p>
            <p role="status">{message}</p>
            <button
                className="action underline"
                disabled={busy}
                onClick={() => {
                    if (
                        !dirty ||
                        confirm("Recharger et abandonner les modifications non enregistrées ?")
                    )
                        void load();
                }}
            >
                Recharger la configuration
            </button>
            {!ready ? (
                <button className="action underline" onClick={load}>
                    Réessayer le chargement
                </button>
            ) : (
                <>
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
                                {label}
                                <input
                                    className={input}
                                    value={content[key]}
                                    maxLength={key === "heroTitle" ? 160 : 5000}
                                    onChange={(e) => change(key, e.target.value)}
                                />
                            </label>
                        ))}
                        <label>
                            Photo d’accueil
                            <input
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
                    <fieldset className="border border-white/20 p-4 space-y-4">
                        <legend>Bannières (3 maximum)</legend>
                        {content.banners.map((banner, index) => (
                            <div key={index} className="grid md:grid-cols-3 gap-3">
                                <label>
                                    Titre
                                    <input
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
                                    Lien interne
                                    <input
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
                                    Photo
                                    <input
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
                                    Retirer la bannière {index + 1}
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
                            Ajouter une bannière
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
                            {label}
                            <textarea
                                rows={4}
                                className={input}
                                value={content[key]}
                                placeholder="À renseigner avec les informations exactes du magasin"
                                onChange={(e) => {
                                    change(key, e.target.value);
                                    change("policiesVerified", false);
                                }}
                            />
                        </label>
                    ))}
                    <label className="flex gap-3">
                        <input
                            type="checkbox"
                            checked={content.policiesVerified}
                            onChange={(e) => change("policiesVerified", e.target.checked)}
                        />
                        Je confirme avoir vérifié l’exactitude des informations commerciales à
                        publier.
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <button
                            className="admin-button primary"
                            disabled={busy}
                            onClick={() => perform("draft")}
                        >
                            Enregistrer le brouillon
                        </button>
                        <button className="admin-button" onClick={() => setPreview(!preview)}>
                            Aperçu du brouillon
                        </button>
                        <button
                            className="admin-button"
                            disabled={busy || dirty}
                            onClick={() => perform("publish")}
                        >
                            Publier
                        </button>
                        <button
                            className="admin-button"
                            disabled={busy || !rollback || dirty}
                            onClick={() => perform("rollback")}
                        >
                            Restaurer la version publique précédente
                        </button>
                    </div>
                    {dirty && <p>Modifications non enregistrées : enregistrez avant de publier.</p>}
                    {preview && (
                        <section
                            className="rounded bg-[#FDFAF6] text-[#1A1A2E] overflow-hidden"
                            dir="rtl"
                        >
                            <p className="p-4 bg-[#F5EDE0]" role="status">
                                معاينة خاصة — هذا المحتوى غير منشور
                            </p>
                            <HomeView content={content} products={[]} categories={[]} />
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
