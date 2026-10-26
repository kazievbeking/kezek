import {RUNTIME_VERSION} from '@kezek/shared';
import {db} from './db.js';
import {applyRemote} from './provision.js';
let running=false;
export async function synchronize(){if(running||!process.env.BRIDGE_URL||!process.env.BRIDGE_TOKEN)return;running=true;try{
 const installation=await db.installation.findFirst();if(!installation)return;
 const telemetry:any={installationId:installation.id,version:RUNTIME_VERSION,mode:installation.mode};
 telemetry.updates=await db.updateJob.findMany({orderBy:{updatedAt:'desc'},take:10,select:{version:true,status:true,updatedAt:true}});
 // Explicit allowlist: tickets, statistics, passwords, hashes and sessions never leave Runtime.
 if(installation.mode==='managed'){
  telemetry.devices=await db.device.findMany({select:{id:true,companyId:true,branchId:true,name:true,role:true,active:true,lastSeen:true,version:true}});
 }
 const response=await fetch(process.env.BRIDGE_URL+'/api/bridge/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.BRIDGE_TOKEN},body:JSON.stringify(telemetry),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('unavailable');const data=await response.json();
 for(const command of data.commands){const result=await applyRemote(command);await fetch(process.env.BRIDGE_URL+'/api/bridge/ack',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.BRIDGE_TOKEN},body:JSON.stringify({id:JSON.parse(Buffer.from(command.body,'base64url').toString()).id,result}),signal:AbortSignal.timeout(8000)});}
 await db.installation.update({where:{id:installation.id},data:{lastSync:new Date(),syncError:null}});
 }catch{await db.installation.updateMany({data:{syncError:'controlUnavailable'}}).catch(()=>{});}finally{running=false;}}
export function startBridge(){void synchronize();const timer=setInterval(()=>void synchronize(),30000);return()=>clearInterval(timer);}
