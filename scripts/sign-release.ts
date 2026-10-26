import {RUNTIME_PROTOCOL,RUNTIME_VERSION} from '../packages/shared/src/index.js';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {signPacket} from '../packages/shared/src/security.js';
const [version,file,assetId]=process.argv.slice(2);
if(!/^\d+\.\d+\.\d+$/.test(version)||!file||!assetId)throw Error('Usage: tsx scripts/sign-release.ts 1.1.0 package.tar.gz GITHUB_ASSET_ID');
if(!process.env.RELEASE_PRIVATE_KEY_FILE)throw Error('Configure RELEASE_PRIVATE_KEY_FILE');
const payload={kind:'release',version,protocol:RUNTIME_PROTOCOL,fromVersions:'^1.0.0',sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),assetId:Number(assetId),fileName:'kezek-runtime-'+version+'.tar.gz'};
process.stdout.write(JSON.stringify(signPacket(payload,process.env.RELEASE_PRIVATE_KEY_FILE),null,2)+'\n');
