import {randomBytes,createHash,sign,verify} from 'node:crypto';
import fs from 'node:fs';
import argon2 from 'argon2';
export const randomSecret=()=>randomBytes(32).toString('base64url');
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const passwordHash=(s:string)=>argon2.hash(s,{type:argon2.argon2id});
export const passwordVerify=(h:string,s:string)=>argon2.verify(h,s);
export class AppError extends Error {constructor(public status:number,public code:string){super(code);}}
export function ensure(value:unknown,code='conflict',status=409):asserts value {if(!value)throw new AppError(status,code);}
export function signPacket(payload:unknown,keyFile=process.env.CONTROL_PRIVATE_KEY_FILE){ensure(keyFile,'signingNotConfigured',503);const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return {body,signature:sign(null,Buffer.from(body),fs.readFileSync(keyFile)).toString('base64')};}
export function verifyPacket(packet:any,keyFile=process.env.CONTROL_PUBLIC_KEY_FILE):any {ensure(keyFile&&packet&&typeof packet.body==='string'&&typeof packet.signature==='string','invalidSignature',400);ensure(verify(null,Buffer.from(packet.body),fs.readFileSync(keyFile),Buffer.from(packet.signature,'base64')),'invalidSignature',400);return JSON.parse(Buffer.from(packet.body,'base64url').toString('utf8'));}
