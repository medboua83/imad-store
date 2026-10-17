"use client";
import { useEffect, useState } from "react";
import axios from "axios";

const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "").replace(/\/api$/, "") + "/api";

type Config = { enabled: boolean; configured: boolean; updatedAt: string | null };
export default function DeskcommTab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [clearWebhook, setClearWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const headers = () => ({ Authorization: "Bearer " + (localStorage.getItem("adminToken") || "") });
  useEffect(() => {
    axios.get<{data:Config}>(base + "/integrations/deskcomm", { headers: headers() })
      .then(r => { setConfig(r.data.data); setEnabled(r.data.data.enabled); })
      .catch(() => setMessage("Impossible de charger la configuration."));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try {
      const payload: {enabled:boolean; webhookUrl?:string; clearWebhook?:boolean} = { enabled, clearWebhook };
      if (url.trim()) payload.webhookUrl = url.trim();
      const r = await axios.put<{data:Config}>(base + "/integrations/deskcomm", payload, { headers: headers() });
      setConfig(r.data.data); setUrl(""); setClearWebhook(false); setMessage("Configuration enregistrée.");
    } catch (error) {
      setMessage(axios.isAxiosError(error) ? (error.response?.data?.error || "Échec de l’enregistrement") : "Erreur de connexion");
    } finally { setLoading(false); }
  }
  return <section className="max-w-2xl bg-white/5 border border-white/10 rounded-xl p-6">
    <h2 className="text-xl font-semibold text-[#C9A96E] mb-2">Intégration DeskcommCRM</h2>
    <p className="text-white/60 text-sm mb-6">Configure le webhook CRM. L’adresse complète est masquée après enregistrement et n’est jamais renvoyée par l’API.</p>
    <p className="text-sm mb-4">État : {config?.configured ? "Webhook enregistré" : "Aucun webhook configuré"}</p>
    <form onSubmit={save} className="space-y-5">
      <label className="block text-sm">URL du webhook (laisser vide pour conserver l’existante)
        <input type="password" autoComplete="off" value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="https://crm.exemple.com/api/..." className="block mt-2 w-full bg-[#101020] border border-white/20 rounded-lg px-3 py-3 text-white" />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />
        Activer l’intégration DeskcommCRM
      </label>
      <label className="flex items-center gap-3 text-sm text-red-200">
        <input type="checkbox" checked={clearWebhook} onChange={e=>setClearWebhook(e.target.checked)} />
        Supprimer le webhook enregistré
      </label>
      <p className="text-xs text-white/50">Les URL HTTP distantes sont refusées : active HTTPS sur le CRM avant la mise en service. Ce module configure la destination ; il n'active pas à lui seul la synchronisation des commandes.</p>
      <button disabled={loading || (clearWebhook && Boolean(url))} type="submit" className="rounded bg-[#C9A96E] px-5 py-3 font-semibold text-[#101020] disabled:opacity-50">
        {loading ? "Enregistrement..." : "Enregistrer"}
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  </section>;
}
