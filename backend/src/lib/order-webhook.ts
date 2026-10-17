import { createHmac, randomUUID } from "crypto";
import { lookup } from "dns/promises";
import https from "https";
import { isIP } from "net";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export function validateUrl(text: string): URL {
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("URL webhook invalide"); }
  const allow = (process.env.ORDER_WEBHOOK_ALLOWED_HOSTS || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname) || url.port ||
    !url.hostname.includes(".") || /\.(local|localhost|internal|test|example)$/.test(url.hostname) ||
    (allow.length > 0 && !allow.includes(url.hostname.toLowerCase()))) {
    throw new Error("Utilisez un domaine HTTPS public autorisé sur le port 443");
  }
  return url;
}
function publicIp(ip: string): boolean {
  const a=ip.split(".").map(Number);if(a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [x,y,z]=a;
  return !(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||
    x===192&&(y===168||y===0||y===88&&z===99)||x===100&&y>=64&&y<=127||
    x===198&&(y===18||y===19||y===51&&z===100)||x===203&&y===0&&z===113);
}
async function send(urlText:string,eventId:string,payload:unknown) {
  const secret=process.env.ORDER_WEBHOOK_SECRET;
  if(!secret||secret.length<32)throw new Error("ORDER_WEBHOOK_SECRET missing (32+ characters)");
  const url=validateUrl(urlText), addresses=await lookup(url.hostname,{all:true});
  const ip=addresses.find(a=>a.family===4&&publicIp(a.address))?.address;
  if(!ip)throw new Error("No public IPv4 address for webhook destination");
  const body=JSON.stringify(payload);
  await new Promise<void>((resolve,reject)=>{
    const request=https.request(url,{method:"POST",timeout:8000,
      lookup:(_hostname,_options,cb)=>cb(null,ip,4),
      headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),
        "X-Imad-Event-Id":eventId,"X-Imad-Event":"order.confirmed",
        "X-Imad-Signature":"sha256="+createHmac("sha256",secret).update(body).digest("hex")}},
      response=>{response.resume();response.on("error",reject);response.on("end",()=>{
        const code=response.statusCode||0;code>=200&&code<300?resolve():reject(new Error("HTTP "+code));
      });});
    request.on("timeout",()=>request.destroy(new Error("Webhook timeout")));
    request.on("error",reject);request.end(body);
  });
}
export async function queueConfirmed(tx:Prisma.TransactionClient,order:any,url:string) {
  const eventId="order.confirmed:"+order.id;
  const payload={event:"order.confirmed",eventId,occurredAt:new Date().toISOString(),order:{
    id:order.id,status:order.status,createdAt:order.createdAt,currency:"MAD",
    totalAmount:order.totalAmount,shippingCost:order.shippingCost,
    paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus,
    customer:{name:order.customerName,phone:order.customerPhone,email:order.customerEmail,
      address:{street:order.street,city:order.city,region:order.region,postalCode:order.postalCode}},
    items:order.items.map((item:any)=>({productId:item.productId,variantId:item.variantId,
      name:item.product.nameFr,nameAr:item.product.nameAr,quantity:item.quantity,
      unitPrice:item.unitPrice,total:item.unitPrice*item.quantity})),notes:order.notes}};
  await tx.webhookDelivery.upsert({where:{eventKey:eventId},update:{},
    create:{eventKey:eventId,orderId:order.id,payload,targetUrl:url}});
}
export async function testWebhook(url:string) {
  const eventId="webhook.test:"+randomUUID();
  await send(url,eventId,{event:"webhook.test",eventId,message:"Imad Store webhook test - no personal data"});
}
let active=false;
export async function processOrderWebhooks() {
  if(active)return;active=true;
  try{
    const jobs=await prisma.webhookDelivery.findMany({where:{
      status:{in:["PENDING","RETRY","SENDING"]},nextAttemptAt:{lte:new Date()}},
      orderBy:{nextAttemptAt:"asc"},take:10});
    for(const job of jobs){
      const lock=await prisma.webhookDelivery.updateMany({where:{
        id:job.id,status:job.status,nextAttemptAt:job.nextAttemptAt},
        data:{status:"SENDING",attempts:{increment:1},nextAttemptAt:new Date(Date.now()+60000)}});
      if(!lock.count)continue;
      try {
        await send(job.targetUrl,job.eventKey,job.payload);
        await prisma.webhookDelivery.update({where:{id:job.id},data:{status:"DELIVERED",deliveredAt:new Date(),lastError:null}});
      }catch(error){
        const attempt=job.attempts+1;
        await prisma.webhookDelivery.update({where:{id:job.id},data:{
          status:attempt>=5?"FAILED":"RETRY",
          lastError:String(error).slice(0,250),
          nextAttemptAt:new Date(Date.now()+Math.min(3600000,60000*2**attempt))}});
      }
    }
  }finally{active=false;}
}
