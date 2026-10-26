import {createHash} from 'node:crypto';
import {descendantServiceIds,serviceAvailable,type Principal} from '@kezek/shared';
import {ensure} from '@kezek/shared/dist/security.js';
import {transaction,changed,type Tx} from './db.js';
import {guard} from './auth.js';
import {assignedServiceIds} from './assignments.js';
const ACTIVE=['CALLED','SERVING'];
export function dateAt(timezone:string,now=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(t=>p.find(x=>x.type===t)!.value).join('-');}
export async function expire(tx:Tx,companyId:string){const due=await tx.transfer.findMany({where:{companyId,status:'PENDING',expiresAt:{lte:new Date()}},select:{id:true,branchId:true}});if(!due.length)return;await tx.transfer.updateMany({where:{id:{in:due.map(d=>d.id)},status:'PENDING'},data:{status:'EXPIRED',resolvedAt:new Date()}});for(const branchId of new Set(due.map(d=>d.branchId)))await changed(tx,companyId,branchId,'transfer.expired');}
async function eligible(tx:Tx,companyId:string,branchId:string,userId:string,serviceId:string){const user=await tx.person.findFirst({where:{companyId,id:userId,active:true}});ensure(user&&(user.role==='COMPANY_ADMIN'||user.branchIds.includes(branchId)),'forbidden',403);const shift=await tx.shift.findFirst({where:{companyId,branchId,userId,endedAt:null}});ensure(shift&&!shift.paused,'recipientUnavailable');ensure(!await tx.ticket.findFirst({where:{companyId,userId,status:{in:ACTIVE}}}),'recipientUnavailable');ensure((await assignedServiceIds(tx,companyId,branchId,user.serviceIds)).includes(serviceId),'serviceUnavailable');return shift;}
async function call(tx:Tx,ticket:any,userId:string){const person=await tx.person.findFirstOrThrow({where:{id:userId,companyId:ticket.companyId}});await tx.call.create({data:{companyId:ticket.companyId,branchId:ticket.branchId,ticketId:ticket.id,number:ticket.number,userId:person.id,destination:[person.firstName,person.lastName].filter(Boolean).join(' ')}});}
export async function execute(p:Principal,key:string,action:string,input:any={}){
 ensure(key.length>=16&&key.length<=100,'invalidInput',400);ensure(!p.mustChange,'passwordChangeRequired',403);ensure(!p.delegated,'forbidden',403);
 const {companyId,branchId}=p;const fingerprint=createHash('sha256').update(JSON.stringify({branchId,action,input})).digest('hex');
 return transaction(companyId,async tx=>{
  const point=await tx.branch.findFirst({where:{companyId,id:branchId,active:true}});ensure(point&&(await tx.companyBranch.findFirst({where:{id:point.companyBranchId,companyId,active:true}})),'branchDisabled',403);
  if(p.device)ensure(await tx.device.findFirst({where:{id:p.id,companyId,branchId,active:true}}),'deviceRevoked',401);
  else {const user=await tx.person.findUnique({where:{id:p.id}});ensure(user?.active&&user.role===p.role&&(user.role==='COMPANY_ADMIN'||user.branchIds.includes(branchId)),'forbidden',403);p={...p,deskIds:user.deskIds,serviceIds:user.serviceIds};}
  const old=await tx.command.findUnique({where:{actorId_key:{actorId:p.id,key}}});if(old){ensure(old.fingerprint===fingerprint,'keyConflict');return old.result;}
  await expire(tx,companyId);const scope={companyId,branchId};let result:any;
  if(action==='issue'){
   guard(p,['TERMINAL','COMPANY_ADMIN','BRANCH_ADMIN']);ensure(typeof input.serviceId==='string','invalidInput',400);
   const service=await tx.service.findFirst({where:{...scope,id:input.serviceId,active:true}});ensure(service,'serviceUnavailable',404);const serviceTree=await tx.service.findMany({where:scope});ensure(serviceAvailable(serviceTree,service.id),'serviceUnavailable',404);ensure(!serviceTree.some(s=>s.parentId===service.id),'chooseSubservice',400);
   const company=await tx.company.findUniqueOrThrow({where:{id:companyId}});const branch=await tx.branch.findUniqueOrThrow({where:{id:branchId}});const settings={...(company.settings as any),...(branch.settings as any)};const date=dateAt(settings.timezone||'Asia/Qyzylorda');
   const counter=await tx.counter.upsert({where:{companyId_branchId_date_prefix:{...scope,date,prefix:service.prefix}},create:{...scope,date,prefix:service.prefix,value:1},update:{value:{increment:1}}});
   result=await tx.ticket.create({data:{...scope,serviceId:service.id,date,number:service.prefix+String(counter.value).padStart(settings.digits||3,'0')}});
   const lease=await tx.printLease.create({data:{...scope,deviceId:p.id,ticketId:result.id}});result={...result,printLeaseId:lease.id};
  }else{
   guard(p,['STAFF','COMPANY_ADMIN','BRANCH_ADMIN']);const current=await tx.ticket.findFirst({where:{companyId,userId:p.id,status:{in:ACTIVE}}});const shift=await tx.shift.findFirst({where:{companyId,userId:p.id,endedAt:null}});
   if(action==='shift.start'){
    ensure(!shift,'shiftOpen');ensure((await assignedServiceIds(tx,companyId,branchId,p.serviceIds)).length,'noServicesAssigned',403);result=await tx.shift.create({data:{...scope,userId:p.id}});
   }else{
    ensure(shift&&shift.branchId===branchId,'shiftRequired');
    if(action==='shift.end'||action==='pause'){
     ensure(!current,'clientActive');await tx.pause.updateMany({where:{shiftId:shift.id,endedAt:null},data:{endedAt:new Date()}});
     if(action==='pause'&&!shift.paused)await tx.pause.create({data:{...scope,shiftId:shift.id}});
     result=await tx.shift.update({where:{id:shift.id},data:action==='shift.end'?{endedAt:new Date(),paused:false}:{paused:!shift.paused}});
    }else if(action==='next'){
     ensure(!current&&!shift.paused,'clientActive');const ids=await assignedServiceIds(tx,companyId,branchId,p.serviceIds);const ticket=await tx.ticket.findFirst({where:{...scope,status:'WAITING',serviceId:{in:ids}},orderBy:[{issuedAt:'asc'},{id:'asc'}]});ensure(ticket,'queueEmpty');result=await tx.ticket.update({where:{id:ticket.id},data:{status:'CALLED',userId:p.id,deskId:null,calledAt:ticket.calledAt||new Date()}});await call(tx,result,p.id);
    }else if(action==='transfer.request'){
     ensure(current&&current.branchId===branchId,'noClient');ensure(input.toId&&input.toId!==p.id,'invalidInput',400);ensure(!await tx.transfer.findFirst({where:{ticketId:current.id,status:'PENDING'}}),'transferPending');await eligible(tx,companyId,branchId,input.toId,current.serviceId);
     const settings=(await tx.company.findUniqueOrThrow({where:{id:companyId}})).settings as any;result=await tx.transfer.create({data:{...scope,ticketId:current.id,fromId:p.id,toId:input.toId,comment:input.comment||'',expiresAt:new Date(Date.now()+(settings.transferSeconds||60)*1000)}});
    }else if(['transfer.accept','transfer.reject','transfer.cancel'].includes(action)){
     const transfer=await tx.transfer.findFirst({where:{...scope,id:input.transferId||'',status:'PENDING'}});ensure(transfer,'transferClosed');ensure((action==='transfer.cancel'?transfer.fromId:transfer.toId)===p.id,'forbidden',403);const ticket=await tx.ticket.findUniqueOrThrow({where:{id:transfer.ticketId}});ensure(ticket.userId===transfer.fromId&&ACTIVE.includes(ticket.status),'noClient');
     if(action==='transfer.accept'){await eligible(tx,companyId,branchId,p.id,ticket.serviceId);await tx.interval.updateMany({where:{ticketId:ticket.id,endedAt:null},data:{endedAt:new Date()}});await tx.ticket.update({where:{id:ticket.id},data:{userId:p.id,deskId:null,status:'CALLED'}});await call(tx,ticket,p.id);}
     result=await tx.transfer.update({where:{id:transfer.id},data:{status:action==='transfer.accept'?'ACCEPTED':action==='transfer.reject'?'REJECTED':'CANCELLED',resolvedAt:new Date()}});
    }else{
     ensure(current&&current.branchId===branchId,'noClient');
     if(action==='recall'){await call(tx,current,p.id);result=current;}
     else if(action==='serve'){ensure(current.status==='CALLED','conflict');result=await tx.ticket.update({where:{id:current.id},data:{status:'SERVING',startedAt:current.startedAt||new Date()}});await tx.interval.create({data:{...scope,ticketId:current.id,userId:p.id}});}
     else {ensure(['complete','no-show','cancel'].includes(action),'invalidInput',400);ensure(action!=='complete'||current.status==='SERVING','startService');ensure(action!=='no-show'||current.status==='CALLED','conflict');result=await tx.ticket.update({where:{id:current.id},data:{status:action==='complete'?'COMPLETED':action==='no-show'?'NO_SHOW':'CANCELLED',endedAt:new Date()}});await tx.interval.updateMany({where:{ticketId:current.id,endedAt:null},data:{endedAt:new Date()}});await tx.transfer.updateMany({where:{ticketId:current.id,status:'PENDING'},data:{status:'CANCELLED',resolvedAt:new Date()}});}
    }
   }
  }
  const json=JSON.parse(JSON.stringify(result));await tx.command.create({data:{...scope,actorId:p.id,key,fingerprint,result:json}});await tx.audit.create({data:{...scope,actorId:p.id,action,details:{id:result.id}}});await changed(tx,companyId,branchId,action);return json;
 });
}
