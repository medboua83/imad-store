#!/usr/bin/env node
// Deterministic public dependency metadata, never profiles or installed credentials.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const entries=new Map();
for(const [location,meta] of Object.entries(lock.packages||{})){
    if(!location.includes('node_modules/')||meta.dev===true||meta.link)continue;
    const name=location.slice(location.lastIndexOf('node_modules/')+13);
    const key=name+'@'+meta.version;
    entries.set(key,{name,version:meta.version,license:typeof meta.license==='string'?meta.license:'UNDECLARED',optional:!!meta.optional});
}
const result={source:'package-lock.json; production and optional dependencies; no downloaded source audit',
    dependencies:[...entries.values()].sort((a,b)=>(a.name+'@'+a.version).localeCompare(b.name+'@'+b.version,'en'))};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
