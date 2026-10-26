import {useEffect,useState} from 'react';
import {localized,serviceAncestors,servicePath} from '@kezek/shared';
import {api} from '../api';
import {Brand,Button} from '../components';
import {useI18n} from '../i18n';
export function Terminal({state,online,busy,run,lastResult}:{state:any;online:boolean;busy:boolean;run:(a:string,i?:any)=>Promise<any>;lastResult:any}){const {t,locale}=useI18n();const [ticket,setTicket]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem('kezek.lastTicket.'+state.me.id)||'null');}catch{return null;}}),[message,setMessage]=useState(''),[printing,setPrinting]=useState(false),[parentId,setParent]=useState<string|null>(null);const settings={...state.company.settings,...state.branch.settings};const shown=ticket||lastResult?.number&&lastResult;
 function home(){setTicket(null);localStorage.removeItem('kezek.lastTicket.'+state.me.id);location.reload();}
 useEffect(()=>{if(message!=='printSent')return;const timer=setTimeout(home,15000);return()=>clearTimeout(timer);},[message]);
 async function print(value:any){setPrinting(true);setMessage('');try{await api('/print/'+value.id,{});await new Promise(r=>setTimeout(r,80));window.print();await api('/print/'+value.id,{done:true});setMessage('printSent');}catch{setMessage('printFailed');}finally{setPrinting(false);}}
 async function issue(serviceId:string){const value=await run('issue',{serviceId});if(value){setTicket(value);localStorage.setItem('kezek.lastTicket.'+state.me.id,JSON.stringify(value));void print(value);}}
 const path=parentId?serviceAncestors(state.services,parentId):[],visible=state.services.filter((service:any)=>service.active&&(service.parentId||null)===parentId);
 useEffect(()=>{if(parentId&&!state.services.some((s:any)=>s.id===parentId&&s.active))setParent(null);},[state.version,parentId]);
 function selectService(service:any){if(service.hasChildren||state.services.some((child:any)=>child.parentId===service.id))setParent(service.id);else void issue(service.id);}
 return <main className="terminal"><header><Brand name={state.company.name} logo={settings.logo}/><span className="pill">{state.companyBranch.name} / {state.branch.name}</span></header>
 {shown?<section className="ticket-result"><span className="eyebrow">{t('yourNumber')}</span><h1>{shown.number}</h1><p>{servicePath(state.services,shown.serviceId,locale)}</p><p>{t(message)}</p><div className="actions centered"><Button disabled={printing} onClick={()=>void print(shown)}>{t('reprint')}</Button><Button disabled={printing} kind="secondary" onClick={home}>{t('back')}</Button></div></section>:<>
  {parentId&&<nav className="service-breadcrumbs" aria-label={t('services')}><Button kind="secondary" disabled={busy} onClick={()=>setParent(null)}>{t('allServices')}</Button>{path.map((service:any)=><Button key={service.id} kind="secondary" disabled={busy||service.id===parentId} onClick={()=>setParent(service.id)}>{localized(service.name,locale)}</Button>)}</nav>}
  <div className="terminal-heading"><h1>{parentId?localized(path[path.length-1]?.name,locale):t('chooseService')}</h1><p>{t(parentId?'chooseSubservice':'waitCall')}</p></div>
  <div className="service-grid">{visible.map((service:any,i:number)=><button className="service-button" disabled={!online||busy} key={service.id} onClick={()=>selectService(service)}><span>{String(i+1).padStart(2,'0')}</span><strong>{localized(service.name,locale)}</strong><b>→</b></button>)}</div>
  {!visible.length&&<p className="empty">{t('empty')}</p>}{parentId&&<div className="service-back"><Button kind="secondary" disabled={busy} onClick={()=>setParent(path.length>1?path[path.length-2].id:null)}>{t('back')}</Button></div>}
 </>}
 <div className="receipt">{settings.logo&&<img src={settings.logo}/>}<h3>{state.company.name}</h3><p>{state.companyBranch.name} / {state.branch.name}</p><span>{t('ticket')}</span><h1>{shown?.number}</h1><p>{shown&&servicePath(state.services,shown.serviceId,locale)}</p><p>{shown&&new Date(shown.issuedAt).toLocaleString(locale,{timeZone:settings.timezone||'Asia/Qyzylorda'})}</p><p>{localized(settings.footer,locale)}</p></div></main>;
}
