import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validateUrl, testWebhook } from "../lib/order-webhook";
import { AppError } from "../middleware/error.middleware";
const publicFields={id:true,whatsappPhone:true,shippingCost:true,freeShippingMin:true,codEnabled:true} as const;
const ensure=()=>prisma.storeSettings.upsert({where:{id:"settings"},update:{},create:{id:"settings"}});
export async function getSettings(_req:Request,res:Response){
  await ensure();res.json({success:true,data:await prisma.storeSettings.findUnique({where:{id:"settings"},select:publicFields})});
}
export async function updateSettings(req:Request,res:Response){
  const body=z.object({whatsappPhone:z.string().optional(),shippingCost:z.number().nonnegative().optional(),
    freeShippingMin:z.number().nonnegative().optional(),codEnabled:z.boolean().optional()}).strict().parse(req.body);
  await ensure();res.json({success:true,data:await prisma.storeSettings.update({where:{id:"settings"},data:body,select:publicFields})});
}
export async function getWebhook(_req:Request,res:Response){
  const s=await ensure();res.json({success:true,data:{enabled:s.webhookEnabled,url:s.webhookUrl||"",
    secretConfigured:!!process.env.ORDER_WEBHOOK_SECRET&&process.env.ORDER_WEBHOOK_SECRET.length>=32}});
}
export async function putWebhook(req:Request,res:Response){
  const body=z.object({enabled:z.boolean(),url:z.string().max(2000)}).strict().parse(req.body);
  const url=body.url.trim();
  if(url){try{validateUrl(url);}catch(e){throw new AppError(String(e),400);}}
  if(body.enabled&&(!url||!process.env.ORDER_WEBHOOK_SECRET||process.env.ORDER_WEBHOOK_SECRET.length<32))
    throw new AppError("Webhook URL and ORDER_WEBHOOK_SECRET (32+ chars) required",400);
  await ensure();const s=await prisma.storeSettings.update({where:{id:"settings"},
    data:{webhookEnabled:body.enabled,webhookUrl:url||null}});
  res.json({success:true,data:{enabled:s.webhookEnabled,url:s.webhookUrl||""}});
}
export async function postWebhookTest(_req:Request,res:Response){
  const s=await ensure();if(!s.webhookUrl)throw new AppError("Save a webhook URL first",400);
  try{await testWebhook(s.webhookUrl);}catch(e){throw new AppError(String(e),502);}
  res.json({success:true,message:"Test delivered"});
}
