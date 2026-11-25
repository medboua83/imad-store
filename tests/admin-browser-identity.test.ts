import { test } from "node:test";
import assert from "node:assert/strict";
import { presentationAccess, presentationSessionKey } from "../apps/web/app/admin/admin-access";
test("The non-secret browser identity preserves cashier draft scopes and display permissions during migration",()=>{
 const claims={id:"a".repeat(24),role:"STAFF",permissions:["pos.sell","pos.read"],sv:2};
 const legacy="fixture."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".fixture";
 const profile=JSON.stringify(claims);
 assert.deepEqual(presentationAccess(profile),presentationAccess(legacy));
 assert.equal(presentationSessionKey(profile),presentationSessionKey(legacy));
 assert.notEqual(presentationSessionKey(profile),presentationSessionKey(JSON.stringify({...claims,id:"b".repeat(24)})));
 assert.notEqual(presentationSessionKey(profile),presentationSessionKey(JSON.stringify({...claims,sv:3})));
});
