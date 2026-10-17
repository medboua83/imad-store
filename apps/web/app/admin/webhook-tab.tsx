"use client";
import { useEffect,useState } from "react";
import { getOrderWebhookSettings,saveOrderWebhookSettings,testOrderWebhook } from "@/lib/api";
export function WebhookTab(){
  const [url,setUrl]=useState(""),[enabled,setEnabled]=useState(false);
  const [ready,setReady]=useState(false),[loading,setLoading]=useState(false),[status,setStatus]=useState("");
  useEffect(()=>{getOrderWebhookSettings().then(v=>{setUrl(v.url);setEnabled(v.enabled);setReady(v.secretConfigured);}).catch(()=>setStatus("Impossible de charger les paramètres."));},[]);
  const perform=async(test:boolean)=>{
    setLoading(true);setStatus("");
    try{
      if(test){await testOrderWebhook();setStatus("Test transmis avec succès.");}
      else {await saveOrderWebhookSettings({url,enabled});setStatus("Configuration enregistrée.");}
    }catch(e:any){setStatus(e?.response?.data?.error||e?.message||"Échec de la requête");}
    finally{setLoading(false);}
  };
  return <section className="max-w-2xl rounded-xl border border-white/10 p-6 space-y-5">
    <h2 className="text-xl text-[#C9A96E]">Webhook — commande confirmée</h2>
    <p className="text-sm text-white/60">Envoie les données au format JSON quand une commande devient CONFIRMED. Pas à la création. HTTPS obligatoire.</p>
    <label className="block text-sm">URL de destination
      <input className="mt-2 block w-full rounded bg-white/10 border border-white/20 p-3" type="url"
        placeholder="https://hooks.example.com/orders" value={url} onChange={e=>setUrl(e.target.value)}/>
    </label>
    <label className="flex items-center gap-3"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Activer les envois</label>
    <p className="text-xs text-white/60">Clé de signature côté serveur : {ready?"configurée":"absente — ajouter ORDER_WEBHOOK_SECRET (32 caractères minimum) dans les variables du backend"}</p>
    <div className="flex gap-3">
      <button disabled={loading} className="bg-[#C9A96E] text-[#1A1A2E] px-5 py-3 rounded" onClick={()=>perform(false)}>Enregistrer</button>
      <button disabled={loading} className="border border-[#C9A96E] px-5 py-3 rounded" onClick={()=>perform(true)}>Tester</button>
    </div>
    <p role="status" className="text-sm text-white/80">{status}</p>
  </section>;
}
