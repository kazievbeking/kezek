import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const env={...process.env,NODE_ENV:'test',INSTALLATION_ID:''};
const schema='test_'+randomUUID().replaceAll('-','');
for(const [key,testKey] of [['RUNTIME_DATABASE_URL','TEST_RUNTIME_DATABASE_URL'],['CONTROL_DATABASE_URL','TEST_CONTROL_DATABASE_URL']]){const url=new URL(process.env[testKey]||process.env[key]);if(!process.env[testKey])url.pathname=url.pathname+'_test';if(!url.pathname.endsWith('_test'))throw Error('Tests require a database ending in _test');url.searchParams.set('schema',schema);env[key]=url.toString();}
for(const schema of ['runtime','control']){const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema',`db/${schema}/schema.prisma`],{stdio:'inherit',env});if(r.status)process.exit(r.status);}
const r=spawnSync(process.execPath,['--import','tsx','--test','--test-concurrency=1','tests/system.test.ts'],{stdio:'inherit',env});process.exit(r.status||0);
