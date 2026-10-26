import {spawnSync} from 'node:child_process';
for(const schema of ['runtime','control']){const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema',`db/${schema}/schema.prisma`],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status||1);}
