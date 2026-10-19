"use client";
import { useState } from "react";
import axios from "axios";
import { getBaseUrl } from "@/lib/api";
export type CompanyConnection = {
    storeId: string;
    companyId: string;
    enabled: boolean;
    configured: boolean;
    pipeline: string;
    stage: string;
    field: string;
};
export default function CrmConnectionForm({
    connection,
    onSaved,
}: {
    connection: CompanyConnection;
    onSaved: () => void;
}) {
    const [pipeline, setPipeline] = useState(connection.pipeline);
    const [stage, setStage] = useState(connection.stage);
    const [field, setField] = useState(connection.field);
    const [enabled, setEnabled] = useState(connection.enabled);
    const [secret, setSecret] = useState("");
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState("");
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            await axios.put(
                getBaseUrl() + "/integrations/deskcomm/connection",
                { enabled, pipeline, stage, field, ...(secret ? { secret } : {}) },
                {
                    headers: {
                        Authorization: "Bearer " + (localStorage.getItem("adminToken") || ""),
                    },
                },
            );
            setSecret("");
            setMessage("Connexion enregistrée. Aucun événement historique n’a été envoyé.");
            onSaved();
        } catch (error) {
            setMessage(
                axios.isAxiosError(error)
                    ? error.response?.data?.error || "Enregistrement impossible"
                    : "Erreur réseau",
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <form onSubmit={save} className="space-y-4 border-b pb-6">
            <h3 className="font-semibold">Connexion de cette entreprise</h3>
            <p className="text-sm admin-muted">
                Une boutique indépendante, une entreprise CRM. Les commandes et les accès
                appartiennent uniquement à cette installation.
            </p>
            <dl className="text-xs space-y-2 break-all">
                <div>
                    <dt>Entreprise CRM</dt>
                    <dd>{connection.companyId}</dd>
                </div>
                <div>
                    <dt>Identifiant de la boutique</dt>
                    <dd>{connection.storeId}</dd>
                </div>
            </dl>
            <label className="block text-sm">
                Pipeline de commandes (identifiant)
                <input
                    className="admin-field mt-2"
                    value={pipeline}
                    onChange={(e) => setPipeline(e.target.value)}
                    required
                    readOnly={connection.configured}
                />
            </label>
            <label className="block text-sm">
                Étape « Commande confirmée » (identifiant)
                <input
                    className="admin-field mt-2"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    required
                />
            </label>
            <label className="block text-sm">
                Champ de référence commande
                <input
                    className="admin-field mt-2"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    required
                    readOnly={connection.configured}
                    pattern="[a-zA-Z0-9_-]{1,128}"
                />
            </label>
            <label className="block text-sm">
                Clé de signature dédiée
                <input
                    className="admin-field mt-2"
                    type="password"
                    autoComplete="new-password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required={!connection.configured}
                    pattern="[a-fA-F0-9]{64}"
                    placeholder={
                        connection.configured
                            ? "Vide = conserver la clé existante"
                            : "64 caractères hexadécimaux"
                    }
                />
            </label>
            <p className="text-xs admin-muted">
                Utilisez la même clé dans la règle webhook de cette entreprise CRM. Elle reste
                chiffrée et ne sera pas réaffichée. Le pipeline et le champ de référence sont fixes
                après le premier enregistrement.
            </p>
            <p className="text-xs admin-muted break-all">
                Adresse de retour : {typeof window !== "undefined" ? window.location.origin : ""}
                /api/integrations/deskcomm/status-callback
            </p>
            <label className="flex gap-3 text-sm">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                />
                Synchroniser les nouvelles confirmations de cette entreprise
            </label>
            <button className="admin-button primary" disabled={busy} type="submit">
                {busy ? "Enregistrement…" : "Enregistrer la connexion"}
            </button>
            {message && (
                <p role="status" className="text-sm">
                    {message}
                </p>
            )}
        </form>
    );
}
