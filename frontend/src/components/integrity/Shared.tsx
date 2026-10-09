import {useState} from 'react';
import type {ReactNode} from 'react';
import {z} from 'zod';
import type {Evidence} from '../../types/novelty';
import {downloadFile, safeHttp} from '../../lib/researchIntegrity';
import {parseStoredRecord,writeStoredRecord} from '../../lib/projectRecords';

export const text=z.string().max(12000);
export const recordBase={id:z.string(),createdAt:z.string()};
export function stamp(){return {id:crypto.randomUUID(),createdAt:new Date().toISOString()};}
export function useDraft<T>(key:string, schema:z.ZodType<T>, fallback:T) {
  const [loaded]=useState(()=>{try {const raw=localStorage.getItem(key);return {value:raw?schema.parse(parseStoredRecord(key)):fallback,error:''};} catch{return {value:fallback,error:'Saved data could not be loaded. Export the original browser data before replacing it.'};}});
  const [value,setValue]=useState(loaded.value),[error,setError]=useState(loaded.error);
  function save(next:T){try {schema.parse(next);writeStoredRecord(key,JSON.stringify(next));setValue(next);setError('');return true;} catch {setError('Could not save changes. Check the input and available browser storage.');return false;}}
  return {value,save,error,export:()=>downloadFile(key+'.json',JSON.stringify(value,null,2))};
}
export function Field({label,value,onChange,area=false,type='text',hint}:{label:string;value:string;onChange:(value:string)=>void;area?:boolean;type?:string;hint?:string}) {
  return <label>{label}{area?<textarea rows={3} maxLength={12000} value={value} onChange={e=>onChange(e.target.value)}/>:<input type={type} maxLength={2000} value={value} onChange={e=>onChange(e.target.value)}/>} {hint&&<small>{hint}</small>}</label>;
}
export function Select({label,value,options,onChange}:{label:string;value:string;options:readonly string[];onChange:(v:string)=>void}) {return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>;}
export function EvidenceSelect({evidence,value,onChange,label='Source'}:{evidence:Evidence[];value:string;onChange:(v:string)=>void;label?:string}) {return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">Select a report source</option>{evidence.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>;}
export function SourceLink({url,children}:{url?:string;children:ReactNode}){const valid=safeHttp(url||'');return valid?<a href={valid} target="_blank" rel="noreferrer">{children} ↗</a>:<span>{children} · link unavailable</span>;}
export function Notice({message}:{message:string}) {return message?<p role="alert" className="warning-line">{message}</p>:null;}
export function SaveBar({error,onExport}:{error:string;onExport:()=>void}) {return <div className="integrity-save"><small>Saved in this browser for this report.</small><button className="quiet-button" onClick={onExport}>Export records</button><Notice message={error}/></div>;}
