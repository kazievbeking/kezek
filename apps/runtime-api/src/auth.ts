import {parse,serialize} from 'cookie';
import type {Request,Response} from 'express';
import type {Principal} from '@kezek/shared';
import {ensure,hash,randomSecret,passwordVerify,passwordHash} from '@kezek/shared/dist/security.js';
import {db} from './db.js';
import {z} from 'zod';
import {verifyPacket} from '@kezek/shared/dist/security.js';

const cookieOptions={httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'strict' as const,path:'/'};
export async function createSession(res:Response,userId:string|null,deviceId:string|null,cookieName='kezek_runtime'){const token=randomSecret(),csrf=randomSecret();await db.session.create({data:{id:hash(token),userId,deviceId,csrf,expiresAt:new Date(Date.now()+(deviceId?3650:0.5)*86400_000)}});res.setHeader('Set-Cookie',serialize(cookieName,token,{...cookieOptions,maxAge:deviceId?315360000:43200}));return {csrf};}
export async function authenticate(headers:{cookie?:string},branchId?:string):Promise<{p:Principal;csrf:string;sessionId:string}> {
 const raw=parse(headers.cookie||'').kezek_runtime;ensure(raw,'loginRequired',401);
 const session=await db.session.findUnique({where:{id:hash(raw)}});ensure(session&&session.expiresAt>new Date(),'loginRequired',401);
 let p:Principal;
 if(session.delegationId){ensure(process.env.ALLOW_OWNER_ACCESS==='true','ownerAccessDisabled',403);const grant=await db.delegation.findUnique({where:{id:session.delegationId}});ensure(grant&&grant.expiresAt>new Date(),'loginRequired',401);const ids=(await db.branch.findMany({where:{companyId:grant.companyId},orderBy:{code:'asc'},select:{id:true}})).map(b=>b.id);ensure(ids.length,'noBranch',403);p={id:'owner:'+grant.ownerId,companyId:grant.companyId,role:'COMPANY_ADMIN',branchIds:ids,branchId:branchId||ids[0],deskIds:[],serviceIds:[],device:false,mustChange:false,delegated:true,ownerName:grant.ownerName};}
 else if(session.deviceId){const d=await db.device.findUnique({where:{id:session.deviceId}});ensure(d?.active,'deviceRevoked',401);p={id:d.id,companyId:d.companyId,branchIds:[d.branchId],branchId:d.branchId,role:d.role as any,deskIds:d.deskId?[d.deskId]:[],serviceIds:[],device:true,mustChange:false,locale:d.locale as any};}
 else {const u=await db.person.findUnique({where:{id:session.userId!}});ensure(u?.active,'loginRequired',401);const activeParents=(await db.companyBranch.findMany({where:{companyId:u.companyId,active:true},select:{id:true}})).map(parent=>parent.id);const ids=(await db.branch.findMany({where:{companyId:u.companyId,...(u.role==='COMPANY_ADMIN'?{}:{id:{in:u.branchIds},companyBranchId:{in:activeParents},active:true})},orderBy:{code:'asc'},select:{id:true}})).map(b=>b.id);ensure(ids.length,'noBranch',403);p={id:u.id,companyId:u.companyId,role:u.role as any,branchIds:ids,branchId:branchId||ids[0],deskIds:u.deskIds,serviceIds:u.serviceIds,device:false,mustChange:u.mustChange,locale:u.locale as any};}
 ensure(!branchId||p.branchIds.includes(branchId),'forbidden',403);p.branchId=branchId||p.branchId;
 ensure((await db.company.findUnique({where:{id:p.companyId}}))?.active,'companyDisabled',403);
 const branch=await db.branch.findFirst({where:{id:p.branchId,companyId:p.companyId}});ensure(branch&&(branch.active||p.role==='COMPANY_ADMIN'),'branchDisabled',403);const parent=await db.companyBranch.findFirst({where:{id:branch.companyBranchId,companyId:p.companyId}});ensure(parent&&(parent.active||p.role==='COMPANY_ADMIN'),'branchDisabled',403);p.companyBranchId=parent.id;
 return {p,csrf:session.csrf,sessionId:session.id};
}
export function guard(p:Principal,roles:string[]){ensure(roles.includes(p.role),'forbidden',403);}
export async function ownerAccess(res:Response,packet:unknown){
 ensure(process.env.ALLOW_OWNER_ACCESS==='true','ownerAccessDisabled',403);
 const d=z.object({kind:z.literal('owner-access'),id:z.string().uuid(),installationId:z.string().uuid(),companyId:z.string().uuid(),ownerId:z.string().uuid(),ownerName:z.string().max(120),issuedAt:z.coerce.date(),expiresAt:z.coerce.date()}).parse(verifyPacket(packet));
 const now=Date.now();ensure(d.expiresAt.getTime()>now&&d.issuedAt.getTime()<=now+30000&&d.expiresAt.getTime()-d.issuedAt.getTime()<=300000,'activationExpired',403);
 ensure((await db.installation.findFirst())?.id===d.installationId,'wrongInstallation',403);
 const token=randomSecret(),csrf=randomSecret(),expiresAt=new Date(now+30*60000);
 await db.$transaction(async tx=>{ensure((await tx.company.findUnique({where:{id:d.companyId}}))?.active,'companyDisabled',403);ensure(!await tx.delegation.findUnique({where:{id:d.id}}),'accessUsed',409);await tx.delegation.create({data:{id:d.id,companyId:d.companyId,ownerId:d.ownerId,ownerName:d.ownerName,expiresAt}});await tx.session.create({data:{id:hash(token),delegationId:d.id,csrf,expiresAt}});await tx.audit.create({data:{companyId:d.companyId,actorId:'owner:'+d.ownerId,action:'owner.access',details:{grantId:d.id,expiresAt:expiresAt.toISOString()}}});});
 res.setHeader('Set-Cookie',serialize('kezek_runtime',token,{...cookieOptions,maxAge:1800}));return {csrf};
}
export function csrf(req:Request,res:Response){ensure(req.get('X-CSRF-Token')===res.locals.auth.csrf,'csrf',403);}
export async function login(res:Response,login:string,password:string){const user=await db.person.findUnique({where:{login:login.toLowerCase()}});ensure(user?.active&&await passwordVerify(user.passwordHash,password),'invalidCredentials',401);ensure((await db.company.findUnique({where:{id:user.companyId}}))?.active,'companyDisabled',403);return createSession(res,user.id,null);}
export async function changePassword(p:Principal,oldPassword:string,newPassword:string){ensure(!p.device&&!p.delegated,'forbidden',403);const user=await db.person.findUniqueOrThrow({where:{id:p.id}});ensure(await passwordVerify(user.passwordHash,oldPassword),'invalidCredentials',403);await db.person.update({where:{id:p.id},data:{passwordHash:await passwordHash(newPassword),mustChange:false}});await db.session.deleteMany({where:{userId:p.id}});}
export async function logout(req:Request,res:Response){await db.session.deleteMany({where:{id:res.locals.auth.sessionId}});res.setHeader('Set-Cookie',serialize('kezek_runtime','',{...cookieOptions,maxAge:0}));}

export async function touchWorkstation(cookie:string|undefined,p:Principal){const token=parse(cookie||'').kezek_workstation;if(!token)return;const session=await db.session.findUnique({where:{id:hash(token)}});if(!session?.deviceId||session.expiresAt<new Date())return;await db.device.updateMany({where:{id:session.deviceId,role:'WORKSTATION',active:true,companyId:p.companyId,branchId:p.branchId},data:{lastSeen:new Date()}});}
