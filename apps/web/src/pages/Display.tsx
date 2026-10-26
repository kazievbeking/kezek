import {useEffect,useRef,useState} from 'react';
import {Brand} from '../components';
import {useI18n} from '../i18n';
export function Display({state}:{state:any}){const {t,locale}=useI18n();const [now,setNow]=useState(new Date()),[sound,setSound]=useState(false),[highlight,setHighlight]=useState('');const audio=useRef<AudioContext|null>(null),last=useRef('');const settings={...state.company.settings,...state.branch.settings};
 useEffect(()=>{const unlock=()=>{if(!audio.current)audio.current=new AudioContext();void audio.current.resume().then(()=>setSound(true)).catch(()=>{});};window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);void audio.current?.close();};},[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const call=state.calls[0];if(call&&last.current&&call.id!==last.current){setHighlight(call.id);if(sound&&audio.current&&settings.sound!==false){const a=audio.current,o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.setValueAtTime(.12,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.5);o.start();o.stop(a.currentTime+.5);}}last.current=call?.id||'';},[state.calls,sound]);
 const tickets=state.displayTickets||state.tickets||[],waiting=tickets.filter((v:any)=>v.status==='WAITING');
 return <main className="display display-queue">
  <header><Brand name={state.company.name} logo={settings.logo}/><div className="clock">{now.toLocaleTimeString(locale,{timeZone:settings.timezone||'Asia/Qyzylorda'})}<small>{state.companyBranch.name} / {state.branch.name} · {now.toLocaleDateString(locale,{timeZone:settings.timezone||'Asia/Qyzylorda',dateStyle:'long'})}</small></div></header>
  <div className="queue-board">
   <section className="queue-calling"><h2>{t('currentCalls')}</h2><div className="call-grid">{state.activeCalls.length?state.activeCalls.map((call:any)=><article className={'queue-call '+(highlight===call.id?'highlight':'')} key={call.id}><strong>{call.number}</strong><span className="queue-arrow">→</span><div><small>{t('STAFF')}</small><b className="call-employee">{call.destination||'—'}</b></div></article>):<p className="queue-empty">{t('empty')}</p>}</div></section>
   <section className="queue-waiting"><div className="queue-heading"><h2>{t('waiting')}</h2><span>{waiting.length}</span></div><div className="queue-numbers">{waiting.length?waiting.map((ticket:any)=><div key={ticket.id}>{ticket.number}</div>):<p className="queue-empty">{t('empty')}</p>}</div></section>
  </div>
 </main>;
}
