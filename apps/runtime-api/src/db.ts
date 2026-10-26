import {PrismaClient,Prisma} from '../../../generated/runtime/index.js';
import {ensure} from '@kezek/shared/dist/security.js';
export const db=new PrismaClient();
export type Tx=Prisma.TransactionClient;
export async function transaction<T>(companyId:string,fn:(tx:Tx)=>Promise<T>):Promise<T>{return db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended('kezek-maintenance',0))::text`;ensure(!(await tx.installation.findFirst())?.maintenance,'maintenance',503);await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId},0))::text`;return fn(tx);},{maxWait:15000,timeout:20000});}
export async function changed(tx:Tx,companyId:string,branchId:string,type:string){const b=await tx.branch.update({where:{id:branchId},data:{version:{increment:1}}});await tx.outbox.create({data:{companyId,branchId,type,version:b.version}});}
