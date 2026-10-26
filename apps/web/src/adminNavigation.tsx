import {useEffect,useState} from 'react';
import {useI18n} from './i18n';

export type AdminSection='overview'|'companyBranches'|'branches'|'services'|'devices'|'users'|'import'|'reports'|'audit'|'settings'|'updates';
const groups:{id:string;icon:string;sections:AdminSection[]}[]=[
 {id:'organisation',icon:'▦',sections:['companyBranches','branches','services','devices']},
 {id:'personnel',icon:'♙',sections:['users','import']},
 {id:'analytics',icon:'▤',sections:['reports','audit']},
 {id:'systemMenu',icon:'⚙',sections:['settings','updates']},
];
function allowed(section:string,role?:string):section is AdminSection {return (section==='overview'||groups.some(group=>group.sections.includes(section as AdminSection)))&&(!['updates','companyBranches'].includes(section)||role==='COMPANY_ADMIN');}
export function useAdminSection(role?:string){const [hash,setHash]=useState(()=>location.hash.slice(1));useEffect(()=>{const change=()=>setHash(location.hash.slice(1));window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);return allowed(hash,role)?hash:'overview';}

export function RuntimeNavigation({role,delegated,route,section}:{role:string;delegated?:boolean;route:string;section:AdminSection}){
 const {t}=useI18n();const canAdmin=['COMPANY_ADMIN','BRANCH_ADMIN'].includes(role);
 const activeGroup=route==='/admin'?groups.find(group=>group.sections.includes(section))?.id:undefined;
 const [expanded,setExpanded]=useState<string|undefined>(activeGroup);
 useEffect(()=>setExpanded(activeGroup),[activeGroup,section,route]);
 const link=(path:string,label:string,icon?:string,selected=false)=><a key={path} href={path} className={selected?'selected':''} aria-current={selected?'page':undefined}>{icon&&<span>{icon}</span>}{t(label)}</a>;
 return <>
  {!canAdmin&&!delegated&&link('/staff','staff','▦',route==='/staff')}
  {canAdmin&&<div className="admin-navigation">
   <div className="admin-nav-heading">{t('admin')}</div>
   {link('/admin#overview','overview','◫',route==='/admin'&&section==='overview')}
   {groups.map(group=>{const sections=group.sections.filter(item=>allowed(item,role)),open=expanded===group.id;return <div className="nav-group" key={group.id}>
    <button type="button" className={'nav-group-toggle '+(activeGroup===group.id?'group-active':'')} aria-expanded={open} aria-controls={'admin-nav-'+group.id} onClick={()=>setExpanded(open?undefined:group.id)}><span>{group.icon}</span><b>{t(group.id)}</b><i className={open?'expanded':''}>›</i></button>
    <div className="nav-submenu" id={'admin-nav-'+group.id} hidden={!open}>{sections.map(item=>link('/admin#'+item,item,undefined,route==='/admin'&&section===item))}</div>
   </div>;})}
  </div>}
 </>;
}
