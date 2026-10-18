import test from "node:test";
import assert from "node:assert/strict";
import { variantPayload, sizeVariants, validatePhoto, stockMatches, stockSummary, productSlug, type DraftVariant } from "../apps/web/app/admin/product-utils";
import type { Product } from "../apps/web/src/lib/api";
const variant:DraftVariant={key:"draft-only",id:"123456789012345678901234",expectedStock:5,color:"#000000",colorNameFr:"Noir",colorNameAr:"أسود",colorNameEn:"Black",size:"M",stock:"4",sku:" SAC-M "};
test("Stock payload retains the loaded reservation guard, rejects empty/fractional stock and duplicate SKU",()=>{
    const payload=variantPayload([variant]);
    assert.equal(payload[0].stock,4);assert.equal(payload[0].expectedStock,5);assert.equal(payload[0].sku,"SAC-M");assert.equal("key" in payload[0],false);
    for(const stock of ["","-1","1.5","1000001"]) assert.throws(()=>variantPayload([{...variant,stock}]),/stock entier/);
    assert.throws(()=>variantPayload([variant,{...variant,key:"other",sku:"sac-m"}]),/plusieurs fois/);
});
test("Size generation skips existing combinations, deduplicates sizes and never clones existing stock or identity",()=>{
    const rows=sizeVariants(variant,"M, L, l; XL", "sac",[variant,{...variant,size:"XXL",sku:"SAC-NOIR-L"}]);
    assert.deepEqual(rows.map(v=>v.size),["L","XL"]);assert.equal(rows[0].sku,"SAC-NOIR-L-2");assert.equal(new Set(rows.map(v=>v.sku)).size,2);
    for(const row of rows){assert.equal(row.stock,"0");assert.equal("id" in row,false);assert.equal("expectedStock" in row,false);}
    assert.equal(sizeVariants(variant,"M", "sac",Array.from({length:100},()=>variant)).length,0);
    assert.throws(()=>sizeVariants(variant,"L", "sac",Array.from({length:100},()=>variant)),/100 variantes/);
    assert.equal(productSlug("Sac Élégant & Beige"),"sac-elegant-beige");
});
test("Photo validation enforces format, nonempty files, 5 MiB and remaining capacity before sending",()=>{
    assert.equal(validatePhoto({type:"image/webp",size:5*1024*1024},1),null);
    assert.match(validatePhoto({type:"image/svg+xml",size:20},1)!,/Format/);
    assert.match(validatePhoto({type:"image/jpeg",size:0},1)!,/vide/);
    assert.match(validatePhoto({type:"image/jpeg",size:5*1024*1024+1},1)!,/5 Mo/);
    assert.match(validatePhoto({type:"image/png",size:20},0)!,/12 photos/);
});
test("Stock indicators count active products only and distinguish missing variants from complete stockouts",()=>{
    const product=(status:string,stocks:number[])=>({status,variants:stocks.map(stock=>({stock}))}) as Product;
    const active=product("ACTIVE",[0,8]),out=product("ACTIVE",[0]),missing=product("DRAFT",[]),draft=product("DRAFT",[99]);
    assert.deepEqual(stockSummary([active,out,missing,draft]),{active:2,units:8,low:2});
    assert.equal(stockMatches(active,"LOW"),true);assert.equal(stockMatches(active,"OUT"),false);assert.equal(stockMatches(out,"OUT"),true);assert.equal(stockMatches(missing,"OUT"),false);assert.equal(stockMatches(missing,"NONE"),true);
});
