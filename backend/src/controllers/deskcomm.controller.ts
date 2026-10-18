import { Request, Response } from "express";
import { createCipheriv, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
const schema = z.object({enabled:z.boolean(),webhookUrl:z.string().trim().max(2048).optional(),clearWebhook:z.boolean().optional()}).strict();
function encrypt(value:string): string {
  const raw=process.env.DESKCOMM_ENCRYPTION_KEY;
  if(!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("DESKCOMM_ENCRYPTION_KEY invalid");
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",Buffer.from(raw,"hex"),iv);
  const bytes=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),bytes].map(b=>b.toString("base64url")).join(".");
}
function validateUrl(value:string){
  const url=new URL(value);
  const allowDevHttp = process.env.NODE_ENV !== "production" && process.env.DESKCOMM_ALLOW_HTTP_DEV === "true";
  if(!((url.protocol==="https:") || (url.protocol==="http:" && allowDevHttp)) || url.username || url.password || url.hash) throw new Error("HTTPS obligatoire ; HTTP uniquement pour test local explicitement active");
  if (["localhost","127.0.0.1","0.0.0.0"].includes(url.hostname) && !(url.protocol==="http:" && allowDevHttp)) throw new Error("Adresse locale interdite pour un webhook distant");
}
export async function getDeskcommConfig(_req:Request,res:Response){
  const c=await prisma.deskcommIntegration.findUnique({where:{id:"deskcomm"}});
  res.setHeader("Cache-Control","no-store");
  res.json({success:true,data:{enabled:c?.enabled??false,configured:Boolean(c?.webhookCiphertext),updatedAt:c?.updatedAt??null}});
}
export async function putDeskcommConfig(req:Request,res:Response){
  const b=schema.parse(req.body);
  if(b.clearWebhook && b.webhookUrl){res.status(400).json({success:false,error:"Choisir suppression ou remplacement"});return;}
  const cur=await prisma.deskcommIntegration.findUnique({where:{id:"deskcomm"}});
  let cipher=cur?.webhookCiphertext??null;
  if(b.clearWebhook)cipher=null;
  if(b.webhookUrl){try{validateUrl(b.webhookUrl);cipher=encrypt(b.webhookUrl);}catch(e){res.status(400).json({success:false,error:e instanceof Error?e.message:"Invalid URL"});return;}}
  if(b.enabled && !cipher){res.status(400).json({success:false,error:"Saisir une URL avant activation"});return;}
  const c=await prisma.deskcommIntegration.upsert({where:{id:"deskcomm"},create:{id:"deskcomm",enabled:b.enabled,webhookCiphertext:cipher},update:{enabled:b.enabled,webhookCiphertext:cipher}});
  res.setHeader("Cache-Control","no-store");
  res.json({success:true,data:{enabled:c.enabled,configured:Boolean(c.webhookCiphertext),updatedAt:c.updatedAt}});
}
