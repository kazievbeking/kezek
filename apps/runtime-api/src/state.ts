import {serviceAvailable,descendantServiceIds,type Principal} from '@kezek/shared';
import {transaction} from './db.js';
export async function snapshot(p:Principal){const {companyId,branchId}=p;return transaction(companyId,async tx=>{
 const company=await tx.company.findUniqueOrThrow({where:{id:companyId}}),branch=await tx.branch.findUniqueOrThrow({where:{id:branchId}});
 const branches=await tx.branch.findMany({where:{companyId,...(p.role==='COMPANY_ADMIN'?{}:{id:{in:p.branchIds}})},orderBy:{code:'asc'}});
 const companyBranch=await tx.companyBranch.findFirstOrThrow({where:{id:branch.companyBranchId,companyId}});const companyBranches=await tx.companyBranch.findMany({where:{companyId,...(p.role==='COMPANY_ADMIN'?{}:{id:{in:branches.map(point=>point.companyBranchId)}})},orderBy:{code:'asc'}});
 const services=await tx.service.findMany({where:{companyId,branchId},orderBy:{prefix:'asc'}}),desks=await tx.desk.findMany({where:{companyId,branchId},orderBy:{number:'asc'}});
 const tickets=await tx.ticket.findMany({where:{companyId,branchId,status:{in:['WAITING','CALLED','SERVING']}},orderBy:{issuedAt:'asc'}});
 const calls=await tx.call.findMany({where:{companyId,branchId},orderBy:{createdAt:'desc'},take:20});
 const activeCalls=await tx.$queryRaw<any[]>`SELECT DISTINCT ON (c."ticketId") c.* FROM "Call" c JOIN "Ticket" t ON t.id=c."ticketId" WHERE c."companyId"=${companyId} AND c."branchId"=${branchId} AND t.status IN ('CALLED','SERVING') ORDER BY c."ticketId", c."createdAt" DESC`;activeCalls.sort((a,b)=>+b.createdAt-+a.createdAt);
 const people=await tx.person.findMany({where:{companyId,id:{in:tickets.filter(t=>t.userId).map(t=>t.userId!)}},select:{id:true,firstName:true,lastName:true}});for(const call of activeCalls)if(!call.destination){const person=people.find(u=>u.id===tickets.find(t=>t.id===call.ticketId)?.userId);call.destination=person?[person.firstName,person.lastName].filter(Boolean).join(' '):'';}
 if(p.device){const publicCall=({userId,...value}:any)=>value;const display=p.role==='DISPLAY'?{displayTickets:tickets.map(({id,number,status})=>({id,number,status}))}:{};return {company,companyBranch,companyBranches:[companyBranch],branch,branches:[branch],services:services.filter(s=>serviceAvailable(services,s.id)).map(s=>({...s,hasChildren:services.some(child=>child.parentId===s.id)})),desks:[],calls:p.role==='DISPLAY'?calls.map(publicCall):[],activeCalls:p.role==='DISPLAY'?activeCalls.map(publicCall):[],...display,version:branch.version,me:p};}
 const users=await tx.person.findMany({where:{companyId,OR:[{branchIds:{has:branchId}},{role:'COMPANY_ADMIN'}]},select:{id:true,firstName:true,lastName:true,login:true,email:true,active:true,role:true,branchIds:true,deskIds:true,serviceIds:true,mustChange:true,locale:true}});
 const shifts=await tx.shift.findMany({where:{companyId,branchId,endedAt:null}});
 const mine=tickets.find(t=>t.userId===p.id&&['CALLED','SERVING'].includes(t.status));
 const me=p.delegated?{...p,firstName:p.ownerName,lastName:'',active:true}:users.find(u=>u.id===p.id);
 const transfers=await tx.transfer.findMany({where:{companyId,branchId,status:'PENDING',...(p.role==='STAFF'?{OR:[{fromId:p.id},{toId:p.id}]}:{})},orderBy:{createdAt:'desc'}});
 return {company,companyBranch,companyBranches,branch,branches,services,desks,calls,activeCalls,version:branch.version,tickets,transfers,shifts:shifts.map(s=>({...s,canReceive:!!mine&&descendantServiceIds(services,users.find(u=>u.id===s.userId)?.serviceIds||[]).includes(mine.serviceId),busy:tickets.some(t=>t.userId===s.userId&&['CALLED','SERVING'].includes(t.status))})),users:p.role==='STAFF'?users.map(u=>({id:u.id,firstName:u.firstName,lastName:u.lastName,active:u.active})):users,me};
});}
