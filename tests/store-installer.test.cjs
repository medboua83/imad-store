const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createProfile } = require('../scripts/create-company-store.cjs');
const { loadProfile } = require('../scripts/run-company-store.cjs');
const root = path.resolve(__dirname, '..');
function fixture(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-kit-'));
    try {
        const output = path.join(dir, 'private');
        const identity = createProfile({ companyId:randomUUID(),name:'Boutique "Été" $TEST `literal`',origin:'https://boutique.example',output });
        const file = path.join(output, 'store.env');
        fn({dir,output,file,identity});
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
test('Two installations use independent identities, database names and private keys; CRM stays paused', () => fixture(({dir,output,file,identity}) => {
    const a = loadProfile(file), crm = JSON.parse(fs.readFileSync(path.join(output,'crm-registration.json')));
    const b = createProfile({companyId:randomUUID(),name:'B',origin:'https://b.example',output:path.join(dir,'b')});
    const second = loadProfile(path.join(dir,'b/store.env'));
    assert.equal(a.vars.STORE_INSTANCE_ID,identity.storeId);
    assert.equal(crm.company_id,identity.companyId); assert.equal(crm.store_id,identity.storeId);
    assert.equal(crm.version,1); assert.match(crm.secret,/^[a-f0-9]{64}$/);
    assert.notEqual(crm.secret,a.vars.DESKCOMM_ENCRYPTION_KEY);
    assert.notEqual(a.vars.DATABASE_URL,second.vars.DATABASE_URL);
    assert.notEqual(a.vars.JWT_SECRET,second.vars.JWT_SECRET);
    assert.notEqual(identity.storeId,b.storeId);
    assert.equal(a.vars.DESKCOMM_HOSTED_DELIVERY_ENABLED,'false');
    assert.equal(a.vars.DESKCOMM_OUTBOX_WORKER_ENABLED,'false');
    assert.equal(a.vars.STORE_DISPLAY_NAME,'Boutique "Été" $TEST `literal`');
    for (const name of ['store.env','crm-registration.json','INSTALLATION.txt']) assert.equal(fs.statSync(path.join(output,name)).mode & 0o777,0o600);
    const cli = spawnSync(process.execPath,['scripts/run-company-store.cjs',file,'check'],{cwd:root,encoding:'utf8'});
    assert.equal(cli.status,0); assert.doesNotMatch(cli.stdout,new RegExp(crm.secret));
    assert.throws(() => createProfile({companyId:identity.companyId,name:'A',origin:'https://a.example',output}));
}));
test('Inherited app credentials and bootstrap password never contaminate the profile', () => fixture(({file}) => {
    const before = process.env.DATABASE_URL;
    process.env.DATABASE_URL='mongodb://production.invalid/real'; process.env.BOOTSTRAP_ADMIN_PASSWORD='private';
    try { const p=loadProfile(file); assert.notEqual(p.env.DATABASE_URL,process.env.DATABASE_URL); assert.equal(p.env.BOOTSTRAP_ADMIN_PASSWORD,undefined); assert.equal(p.env.DOTENV_CONFIG_PATH,file); }
    finally { if(before===undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=before; delete process.env.BOOTSTRAP_ADMIN_PASSWORD; }
}));
test('Rejects invalid identities, keys, ports, dates, image exposure and unsafe file permissions', () => fixture(({file,dir}) => {
    const original=fs.readFileSync(file,'utf8');
    for (const [key,value] of [['STORE_INSTANCE_ID','wrong'],['CRM_COMPANY_ID',''],['JWT_SECRET','short'],['PORT','65536'],['CORS_ORIGIN','https://a.example/path'],['DESKCOMM_OUTBOX_MIN_CREATED_AT','invalid'],['UPLOAD_DIR',path.dirname(file)],['DESKCOMM_HOSTED_DELIVERY_ENABLED','yes'],['DATABASE_URL','mongodb://localhost/']]) {
        fs.writeFileSync(file,original.replace(new RegExp(`^${key}=.*$`,'m'),`${key}=${JSON.stringify(value)}`));
        assert.throws(()=>loadProfile(file),key);
    }
    fs.writeFileSync(file,original); fs.chmodSync(file,0o644); assert.throws(()=>loadProfile(file)); fs.chmodSync(file,0o600);
    fs.symlinkSync(file,path.join(dir,'alias.env')); assert.throws(()=>loadProfile(path.join(dir,'alias.env')));
}));
test('Refuses inherited dotenv files before any startup or network access', () => fixture(({dir,file}) => {
    const code = path.join(dir,'code'); fs.mkdirSync(path.join(code,'backend'),{recursive:true}); fs.mkdirSync(path.join(code,'apps/web'),{recursive:true});
    fs.writeFileSync(path.join(code,'.env.example'),'SAFE=example'); assert.ok(loadProfile(file,code));
    fs.writeFileSync(path.join(code,'apps/web/.env.production.local'),'DATABASE_URL=wrong'); assert.throws(()=>loadProfile(file,code));
}));
test('CLI errors never disclose malformed credentials or create an administrator', () => fixture(({file}) => {
    fs.appendFileSync(file,'\nDATABASE_URL="sensitive-invalid-url"\n');
    const cli=spawnSync(process.execPath,['scripts/run-company-store.cjs',file,'admin'],{cwd:root,encoding:'utf8'});
    assert.equal(cli.status,1); assert.doesNotMatch(cli.stderr,/sensitive-invalid-url/);
}));
test('Distribution contains committed source only, never private profiles, dependencies or Git history', () => fixture(({dir}) => {
    const { execFileSync }=require('node:child_process'), {bundle}=require('../scripts/bundle-company-store.cjs');
    const code=path.join(dir,'distribution'); fs.mkdirSync(code);
    const git=args=>execFileSync('git',args,{cwd:code,stdio:'pipe'});
    git(['init']); git(['config','user.email','test@example.invalid']); git(['config','user.name','Test']);
    fs.writeFileSync(path.join(code,'package.json'),'{}');
    fs.mkdirSync(path.join(code,'backend')); fs.writeFileSync(path.join(code,'backend/app.js'),'// source');
    fs.writeFileSync(path.join(code,'.gitignore'),'*.env\nnode_modules/\n');
    git(['add','.']); git(['commit','-m','fixture']);
    fs.writeFileSync(path.join(code,'private.env'),'SECRET=never-export');
    fs.mkdirSync(path.join(code,'node_modules')); fs.writeFileSync(path.join(code,'node_modules/private.js'),'never-export');
    const output=path.join(dir,'shop.tar.gz'); const result=bundle(output,code);
    assert.match(result.revision,/^[a-f0-9]{40}$/);
    const listing=execFileSync('tar',['-tzf',output],{encoding:'utf8'});
    assert.match(listing,/boutique\/backend\/app.js/); assert.doesNotMatch(listing,/private|node_modules|\.git\//);
    assert.throws(()=>bundle(output,code));
    fs.appendFileSync(path.join(code,'package.json'),'\n'); assert.throws(()=>bundle(path.join(dir,'dirty.tar.gz'),code));
}));
