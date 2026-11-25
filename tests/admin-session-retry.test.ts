import {test} from "node:test";
import assert from "node:assert/strict";
import axios, {AxiosError} from "axios";
import api from "../apps/web/src/lib/api";

test("An in-flight action from an older account is neither refreshed nor retried as the newly connected account",async()=>{
 const keys=["window","localStorage","navigator"],previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const values=new Map<string,string>();
 const profile=(id:string)=>JSON.stringify({id,role:"ADMIN",permissions:[],sv:0});
 values.set("imad:admin:profile",profile("a".repeat(24)));
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
 Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{pathname:"/admin"},dispatchEvent:()=>true}});
 Object.defineProperty(globalThis,"localStorage",{configurable:true,value:storage});
 Object.defineProperty(globalThis,"navigator",{configurable:true,value:{}});
 const before=api.defaults.adapter,globalBefore=axios.defaults.adapter,paths:string[]=[];
 let rejectFirst:(()=>void)|undefined;
 const adapter:any=async(config:any)=>{
  paths.push(config.url);
  if(paths.length===1)return new Promise((_resolve,reject)=>{rejectFirst=()=>reject(new AxiosError("Expired","ERR_BAD_REQUEST",config,undefined,{status:401,statusText:"Unauthorized",headers:{},config,data:{success:false}}));});
  return {status:200,statusText:"OK",headers:{},config,data:{success:true,data:{mode:"cookie",identity:{id:"b".repeat(24),role:"ADMIN",permissions:[],authVersion:0}}}};
 };
 api.defaults.adapter=adapter;axios.defaults.adapter=adapter;
 try{
  const pending=api.patch("/orders/fictitious/status",{status:"CONFIRMED"});
  for(let i=0;i<20&&!rejectFirst;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(rejectFirst);values.set("imad:admin:profile",profile("b".repeat(24)));rejectFirst!();
  await assert.rejects(pending,(error:any)=>axios.isCancel(error));
  assert.deepEqual(paths,["/orders/fictitious/status"]);
  assert.equal(values.get("imad:admin:profile"),profile("b".repeat(24)));
 }finally{
  api.defaults.adapter=before;axios.defaults.adapter=globalBefore;
  keys.forEach((key,i)=>{if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else delete (globalThis as any)[key];});
 }
});
