import {descendantServiceIds} from '@kezek/shared';
import type {Tx} from './db.js';

export async function assignedServiceIds(tx:Tx,companyId:string,branchId:string,roots:string[]){const services=await tx.service.findMany({where:{companyId,branchId},select:{id:true,parentId:true}});const allowed=new Set(descendantServiceIds(services,roots));return services.filter(service=>allowed.has(service.id)).map(service=>service.id);}
