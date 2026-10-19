const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const {startHostedCrmWorker}=require('../scripts/hosted-crm-worker.cjs');
const runtimeKey=Symbol.for('imad.hostedCrmWorker');
const configured={DESKCOMM_HOSTED_DELIVERY_ENABLED:'true',DESKCOMM_OUTBOX_WORKER_ENABLED:'true',DESKCOMM_OUTBOX_MIN_CREATED_AT:'2026-10-19T00:00:00.000Z'};
test('hosted CRM stays inert without every explicit gate and a real ISO cutoff',async()=>{
 let calls=0;
 for(const env of [{},{...configured,DESKCOMM_HOSTED_DELIVERY_ENABLED:'false'},{...configured,DESKCOMM_OUTBOX_WORKER_ENABLED:'false'},{...configured,DESKCOMM_OUTBOX_MIN_CREATED_AT:'2026-02-30T00:00:00.000Z'},{...configured,DESKCOMM_OUTBOX_MIN_CREATED_AT:''}]) {
  const stop=startHostedCrmWorker({env,tick:()=>{calls++},intervalMs:2});
  await delay(5);await stop();assert.equal(globalThis[runtimeKey],undefined);
 }
 assert.equal(calls,0);
});
test('hosted CRM serializes cycles and drains its current job on shutdown',async()=>{
 let calls=0,release; const blocked=new Promise(resolve=>{release=resolve});
 const stop=startHostedCrmWorker({env:configured,tick:async()=>{calls++;await blocked},intervalMs:2});
 try {
  assert.equal(globalThis[runtimeKey].scheduled,true);
  assert.throws(()=>startHostedCrmWorker({env:configured,tick:()=>{},intervalMs:2}),/already registered/);
  await delay(20);assert.equal(calls,1);
  let drained=false;const stopping=stop().then(()=>{drained=true});await delay(5);assert.equal(drained,false);
  release();await stopping;await delay(5);assert.equal(calls,1);assert.equal(globalThis[runtimeKey],undefined);
 }finally {release();await stop();}
});
