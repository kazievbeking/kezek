import {useState} from 'react';
import {api} from '../api';
import {Brand,Button,Field} from '../components';
import {useI18n,Language} from '../i18n';
export function Password({onDone}:{onDone:()=>void}){const {t}=useI18n();const [old,setOld]=useState(''),[value,setValue]=useState(''),[error,setError]=useState('');return <main className="login-page"><form className="login-card" onSubmit={async e=>{e.preventDefault();try{await api('/password',{oldPassword:old,newPassword:value});onDone();}catch(e:any){setError(e.message);}}}><div className="actions spread"><Brand/><Language/></div><h1>{t('passwordChange')}</h1><Field label={t('oldPassword')}><input required type="password" value={old} onChange={e=>setOld(e.target.value)}/></Field><Field label={t('newPassword')}><input required minLength={12} type="password" value={value} onChange={e=>setValue(e.target.value)}/></Field>{error&&<p className="error">{t(error)}</p>}<Button type="submit">{t('save')}</Button></form></main>;}
