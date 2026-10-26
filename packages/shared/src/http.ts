import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import {ZodError} from 'zod';
import {AppError} from './security.js';
import {PROTOCOL} from './index.js';
export function baseApp(origins:string[],protocol:number=PROTOCOL) {
 const app=express();app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{upgradeInsecureRequests:process.env.COOKIE_SECURE==='true'?[]:null,defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],connectSrc:["'self'",...origins,...origins.map(o=>o.replace(/^http/,'ws'))]}}}));
 app.use(cors({origin:(origin,cb)=>cb(null,!origin||origins.includes(origin)),credentials:true}));
 app.use(express.json({limit:'2mb'}));
 app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Kezek-Protocol',String(protocol));if(req.path!=='/health'&&Number(req.get('X-Kezek-Protocol')||protocol)!==protocol)return next(new AppError(426,'invalidProtocol'));if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&!origins.includes(req.headers.origin))return next(new AppError(403,'forbidden'));next();});
 return app;
}
export function errors(error:any,_req:express.Request,res:express.Response,_next:express.NextFunction) {const status=error instanceof AppError?error.status:error instanceof ZodError?400:error.code==='P2002'?409:error.code==='NOT_FOUND'?404:error.code==='LIMIT_FILE_SIZE'?413:500;res.status(status).json({error:error instanceof AppError?error.code:error instanceof ZodError?'invalidInput':status===409?'duplicate':status===404?'notFound':status===413?'fileTooLarge':'serverError',...(error instanceof ZodError?{fields:error.issues.map(i=>({path:i.path.join('.'),code:i.code}))}:{})});}
