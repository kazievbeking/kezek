import {RUNTIME_VERSION} from '../packages/shared/src/index.js';
import fs from 'node:fs';
import path from 'node:path';
import {generateKeyPairSync,randomUUID,randomInt} from 'node:crypto';
import {PrismaClient as Runtime} from '../generated/runtime/index.js';
import {PrismaClient as Control} from '../generated/control/index.js';
import {passwordHash,randomSecret,hash} from '../packages/shared/src/security.js';
const runtime=new Runtime(),control=new Control();fs.mkdirSync('.local',{recursive:true});
const credentialsFile='.local/demo-credentials.json';const credentials:any=fs.existsSync(credentialsFile)?JSON.parse(fs.readFileSync(credentialsFile,'utf8')):{accounts:[],tokens:[]};
async function account(client:any,data:any,owner=false){if(await client.findUnique({where:{login:data.login}}))return;const password=owner?(process.env.OWNER_PASSWORD||randomSecret().slice(0,18)):randomSecret().slice(0,16);if(password.length<12)throw Error('OWNER_PASSWORD must contain 12+ characters');await client.create({data:{...data,passwordHash:await passwordHash(password)}});credentials.accounts.push({plane:owner?'control':'runtime',login:data.login,password,...(!owner?{mustChange:true}:{})});}
try{
 await account(control.owner,{login:(process.env.OWNER_LOGIN||'owner').toLowerCase(),name:'Platform owner'},true);
 const installationId=process.env.INSTALLATION_ID||'30000000-0000-4000-8000-000000000001';
 const bridgeToken=process.env.BRIDGE_TOKEN||randomSecret();
 const companyIds=[],branchIds=[];
 for(let c=1;c<=2;c++){
  const companyId=`10000000-0000-4000-8000-00000000000${c}`;companyIds.push(companyId);const name=c===1?'Центр обслуживания «Кезек»':'Городская поликлиника';
  await control.company.upsert({where:{id:companyId},update:{},create:{id:companyId,name,adminLogin:'admin'+c}});
  await runtime.company.upsert({where:{id:companyId},update:{},create:{id:companyId,name,settings:{timezone:'Asia/Qyzylorda',color:'#17579b',footer:{ru:'Спасибо за ожидание',kk:'Күткеніңізге рақмет',en:'Thank you for waiting'},transferSeconds:60,digits:3,displayRows:4,sound:true}}});
  const companyBranches=[];
  for(let b=1;b<=(c===1?2:1);b++){
   const id=`20000000-0000-4000-8000-0000000000${c}${b}`;branchIds.push(id);companyBranches.push(id);const branch={id,companyId,code:b===1?'MAIN':'SOUTH',name:b===1?'Главный филиал':'Южный филиал',address:b===1?'Центральный проспект, 10':'Южная улица, 5'};
   await control.companyBranch.upsert({where:{id},update:{},create:branch});await runtime.companyBranch.upsert({where:{id},update:{},create:branch});await control.branch.upsert({where:{id},update:{},create:{...branch,companyBranchId:id}});await runtime.branch.upsert({where:{id},update:{},create:{...branch,companyBranchId:id}});
   const serviceIds=[];
   for(const [prefix,names] of [['A',{ru:'Консультация',kk:'Кеңес беру',en:'Consultation'}],['B',{ru:'Оформление документов',kk:'Құжаттарды рәсімдеу',en:'Document processing'}]] as const){const old=await runtime.service.findFirst({where:{companyId,branchId:id,prefix}});const service=old||await runtime.service.create({data:{companyId,branchId:id,prefix,name:names}});serviceIds.push(service.id);}
   for(let n=1;n<=2;n++)await account(runtime.person,{companyId,login:`staff${c}${b}${n}`,firstName:n===1?'Айдана':'Алексей',lastName:'',role:'STAFF',branchIds:[id],deskIds:[],serviceIds,mustChange:true});
   await account(runtime.person,{companyId,login:`manager${c}${b}`,firstName:'Manager',lastName:'',role:'BRANCH_ADMIN',branchIds:[id],deskIds:[],serviceIds,mustChange:true});
  }
  await account(runtime.person,{companyId,login:'admin'+c,firstName:'Administrator',lastName:'',role:'COMPANY_ADMIN',branchIds:companyBranches,deskIds:[],serviceIds:(await runtime.service.findMany({where:{companyId},select:{id:true}})).map(s=>s.id),mustChange:true});
  const rId=`40000000-0000-4000-8000-00000000000${c}`;
  const existingRegistration=await runtime.registration.findUnique({where:{id:rId}});
  if(!existingRegistration){
   const token=String(randomInt(10000000,100000000));
   await runtime.registration.create({data:{id:rId,companyId,hash:hash(token),name:'Demo devices',branchIds:companyBranches,roles:['TERMINAL','DISPLAY','WORKSTATION'],maxUses:100}});
   credentials.tokens=credentials.tokens.filter((v:any)=>v.companyId!==companyId);
   credentials.tokens.push({companyId,token});
  }
 }
 await runtime.installation.upsert({where:{id:installationId},update:{},create:{id:installationId,version:RUNTIME_VERSION,mode:process.env.PRIVACY_MODE||'isolated'}});
 await control.installation.upsert({where:{id:installationId},update:{},create:{id:installationId,name:'Демонстрационный Runtime',type:'local',mode:process.env.PRIVACY_MODE||'isolated',companyIds,branchIds,url:'http://localhost:'+String(process.env.RUNTIME_PORT||3001),bridgeHash:hash(bridgeToken)}});
 for(let c=1;c<=2;c++){const r=await runtime.registration.findUniqueOrThrow({where:{id:`40000000-0000-4000-8000-00000000000${c}`}});await control.registration.upsert({where:{id:r.id},update:{},create:{id:r.id,companyId:r.companyId,installationId,hash:r.hash,name:r.name,branchIds:r.branchIds,roles:r.roles,maxUses:r.maxUses}});}
 fs.writeFileSync(credentialsFile,JSON.stringify(credentials,null,2),{mode:0o600});console.log('Bootstrap complete. Existing accounts preserved. Credentials: .local/demo-credentials.json');
}finally{await Promise.all([runtime.$disconnect(),control.$disconnect()]);}
