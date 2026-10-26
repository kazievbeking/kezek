import ExcelJS from 'exceljs';
import {parse} from 'csv-parse/sync';
import {z} from 'zod';
import {inflateRawSync} from 'node:zlib';
import type {Principal} from '@kezek/shared';
import {ensure,passwordHash,randomSecret} from '@kezek/shared/dist/security.js';
import {personSchema,validatePerson} from './admin.js';
import {guard} from './auth.js';
import {db,transaction,changed} from './db.js';
export const importColumns=['firstName','lastName','login','email','role','companyBranchCode','branchCode','services'];
function checkZip(buffer:Buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){end=i;break;}
 ensure(end>=0,'invalidFile',400);const count=buffer.readUInt16LE(end+10),centralSize=buffer.readUInt32LE(end+12);let pos=buffer.readUInt32LE(end+16),total=0;
 ensure(count>0&&count<=5000&&buffer.readUInt16LE(end+4)===0&&buffer.readUInt16LE(end+6)===0&&pos+centralSize<=end,'invalidFile',400);
 for(let n=0;n<count;n++){
  ensure(pos+46<=end&&buffer.readUInt32LE(pos)===0x02014b50,'invalidFile',400);
  const size=buffer.readUInt32LE(pos+24),compressed=buffer.readUInt32LE(pos+20),method=buffer.readUInt16LE(pos+10),offset=buffer.readUInt32LE(pos+42);
  total+=size;ensure(total<=30*1024*1024&&size!==0xffffffff&&!(buffer.readUInt16LE(pos+8)&1)&&[0,8].includes(method),'fileTooLarge',400);
  ensure(offset+30<=buffer.length&&buffer.readUInt32LE(offset)===0x04034b50,'invalidFile',400);
  const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);ensure(start+compressed<=buffer.length,'invalidFile',400);
  try{const data=method===0?buffer.subarray(start,start+compressed):inflateRawSync(buffer.subarray(start,start+compressed),{maxOutputLength:Math.max(1,Math.min(size+1,30*1024*1024))});ensure(data.length===size,'invalidFile',400);}catch{ensure(false,'invalidFile',400);}
  pos+=46+buffer.readUInt16LE(pos+28)+buffer.readUInt16LE(pos+30)+buffer.readUInt16LE(pos+32);
 }
}
export async function readImport(file:{originalname:string;buffer:Buffer}){ensure(file.buffer.length<=5*1024*1024,'fileTooLarge',400);let rows:any[][];
 if(file.originalname.toLowerCase().endsWith('.csv')){const text=file.buffer.toString('utf8').replace(/^\uFEFF/,'');const header=text.split(/\r?\n/)[0];rows=parse(text,{delimiter:header.includes(';')?';':',',relax_column_count:true,skip_empty_lines:true,max_record_size:100000});}
 else {ensure(file.originalname.toLowerCase().endsWith('.xlsx'),'invalidFile',400);checkZip(file.buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(file.buffer as any);const sheet=workbook.worksheets[0];ensure(sheet,'invalidFile',400);rows=[];sheet.eachRow(row=>rows.push((row.values as any[]).slice(1).map(v=>typeof v==='object'&&v!==null?String(v.text||v.result||''):String(v??''))));}
 ensure(rows.length>1&&rows.length<=201&&rows[0].length<=30,'importLimit',400);return {headers:rows[0].map(String),rows:rows.slice(1).map(r=>r.map(v=>String(v??'').trim()))};
}
const request=z.object({headers:z.array(z.string()).max(30),rows:z.array(z.array(z.string().max(500))).max(200),mapping:z.record(z.string(),z.number().int().min(0).max(29)),duplicates:z.enum(['error','skip','update']).default('error')});
export async function previewImport(p:Principal,raw:unknown){guard(p,['COMPANY_ADMIN','BRANCH_ADMIN']);const d=request.parse(raw);const seen=new Set<string>();const rows:any[]=[];
 for(let index=0;index<d.rows.length;index++){const row=d.rows[index];const get=(key:string)=>d.mapping[key]===undefined?'':row[d.mapping[key]]||'';const errors:string[]=[];let data:any;
  try{const parentCode=get('companyBranchCode');const parent=parentCode?await db.companyBranch.findFirst({where:{companyId:p.companyId,code:parentCode}}):null;ensure(!parentCode||parent,'invalidBranch',400);const codes=get('branchCode').split(/[|,;]/).map(s=>s.trim()).filter(Boolean);const branches=await db.branch.findMany({where:{companyId:p.companyId,...(parent?{companyBranchId:parent.id}:{}),code:{in:codes}}});ensure(branches.length===new Set(codes).size&&branches.length,'invalidBranch',400);const branchIds=branches.map(b=>b.id);const prefixes=get('services').split(/[|,;]/).filter(Boolean);const services=await db.service.findMany({where:{companyId:p.companyId,branchId:{in:branchIds},prefix:{in:prefixes}}});ensure(new Set(services.map(s=>s.prefix)).size===new Set(prefixes).size,'invalidAssignment',400);
   data=personSchema.parse({firstName:get('firstName'),lastName:get('lastName'),login:get('login'),email:get('email'),role:get('role')||'STAFF',branchIds,deskIds:[],serviceIds:services.map(s=>s.id),active:true});ensure(!seen.has(data.login),'duplicate',409);seen.add(data.login);const old=await db.person.findUnique({where:{login:data.login}});if(old){ensure(old.companyId===p.companyId,'duplicate',409);if(d.duplicates==='skip'){rows.push({row:index+2,data,status:'SKIP',errors:[]});continue;}ensure(d.duplicates==='update','duplicate');data.id=old.id;}
   await validatePerson(db,p,data);
  }catch(e:any){errors.push(e.code&&typeof e.code==='string'?e.code:e.name==='ZodError'?'invalidInput':e.message||'invalidInput');}
  rows.push({row:index+2,data:data||{firstName:get('firstName'),login:get('login')},status:errors.length?'ERROR':'VALID',errors});
 }
 return db.importJob.create({data:{companyId:p.companyId,branchId:p.branchId,actorId:p.id,rows:JSON.parse(JSON.stringify(rows)),result:{duplicates:d.duplicates}}});
}
export async function commitImport(p:Principal,id:string){guard(p,['COMPANY_ADMIN','BRANCH_ADMIN']);const job=await db.importJob.findFirst({where:{id,companyId:p.companyId,actorId:p.id}});ensure(job&&job.status==='PREVIEW','importClosed');const rows=(job.rows as any[]).filter(r=>r.status==='VALID');const prepared:any[]=[];for(const row of rows){const temporaryPassword=randomSecret().slice(0,16);prepared.push({...row,temporaryPassword,passwordHash:await passwordHash(temporaryPassword)});}
 return transaction(p.companyId,async tx=>{ensure((await tx.importJob.findUniqueOrThrow({where:{id}})).status==='PREVIEW','importClosed');const credentials:any[]=[];for(const row of prepared){const data=personSchema.parse(row.data);await validatePerson(tx,p,data);if(data.id){ensure(!await tx.shift.findFirst({where:{userId:data.id,endedAt:null}}),'shiftOpen');await tx.person.update({where:{id:data.id},data});await tx.session.deleteMany({where:{userId:data.id}});}else {await tx.person.create({data:{...data,companyId:p.companyId,passwordHash:row.passwordHash,mustChange:true}});credentials.push({login:data.login,temporaryPassword:row.temporaryPassword});}}const result={imported:prepared.length,skipped:(job.rows as any[]).filter(r=>r.status==='SKIP').length,errors:(job.rows as any[]).filter(r=>r.status==='ERROR').length};await tx.importJob.update({where:{id},data:{status:'COMPLETED',result}});await tx.audit.create({data:{companyId:p.companyId,branchId:p.branchId,actorId:p.id,action:'staff.import',details:{jobId:id,...result}}});for(const branchId of p.branchIds)await changed(tx,p.companyId,branchId,'staff.imported');return {...result,credentials};});
}
