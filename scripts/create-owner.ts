import {PrismaClient} from '../generated/control/index.js';
import {passwordHash} from '../packages/shared/src/security.js';
const db=new PrismaClient();
try{if(await db.owner.count())throw Error('Owner already initialized. Use the authenticated owner console to add another owner.');const password=process.env.OWNER_PASSWORD;if(!password||password.length<12)throw Error('Set OWNER_PASSWORD with at least 12 characters');await db.owner.create({data:{login:(process.env.OWNER_LOGIN||'owner').toLowerCase(),name:'Platform owner',passwordHash:await passwordHash(password)}});console.log('Owner created. No public owner registration is available.');}finally{await db.$disconnect();}
