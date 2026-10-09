import {z} from 'zod';
import recordSchema from './researchRecordSchema.json';
export type ProjectRecords=Record<string,unknown>;
const projectSchema=z.fromJSONSchema(recordSchema as Parameters<typeof z.fromJSONSchema>[0]);
const groups=['defense','integrity','tools'] as const;
const recoveryPrefix='researchscope-record-recovery:';
function isAbsoluteHttpUrl(value:string){
  if(value!==value.trim()||/[\u0000-\u001f\u007f-\u009f\\]/.test(value)||!/^https?:\/\//i.test(value))return false;
  const authority=value.slice(value.indexOf('//')+2).split(/[/?#]/,1)[0];
  if(!authority||authority.includes('@'))return false;
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}
  catch{return false;}
}
function storedNamespace(key:string){
  if(key==='novelty-shared-failures')return 'tools:failure-notebook';
  for(const group of groups){
    const start=group==='integrity'?'research-integrity-':`novelty-${group}-`;
    if(!key.startsWith(start))continue;
    const names=Object.keys(recordSchema.properties).filter(name=>name.startsWith(group+':')).sort((a,b)=>b.length-a.length);
    const match=names.find(name=>key.endsWith('-'+name.split(':')[1]));
    if(match)return match;
    if(group==='integrity'){const access=key.match(/-access-([a-z0-9-]{1,40})$/);if(access)return 'integrity:access-'+access[1];}
  }
}
export function parseStoredRecord(key:string,fallback='null'):any {
  const raw=localStorage.getItem(key);if(raw===null)return JSON.parse(fallback);
  try{const value=JSON.parse(raw);const namespace=storedNamespace(key);if(namespace)validateProjectRecords({[namespace]:value});return value;}
  catch(error){
    // Keep the original bytes before a reader uses defaults or a later edit replaces them.
    try{if(localStorage.getItem(recoveryPrefix+key)===null)localStorage.setItem(recoveryPrefix+key,raw);}catch{/* The original remains in its existing key if storage is full. */}
    throw error;
  }
}
export function writeStoredRecord(key:string,raw:string){
  if(storedNamespace(key)&&localStorage.getItem(key)!==null){
    try{parseStoredRecord(key);}catch{
      if(localStorage.getItem(recoveryPrefix+key)===null)throw new Error('Export the original records and free browser storage before saving replacements.');
    }
  }
  localStorage.setItem(key,raw);
}
export function recoverableRecords(id:string):Record<string,string>{
  const result:Record<string,string>={};
  try{
  const keys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter((key):key is string=>key!==null);
  for(const key of keys){
    const original=key.startsWith(recoveryPrefix)?key.slice(recoveryPrefix.length):key;
    if(!groups.some(group=>original.startsWith(prefix(id,group)))&&original!=='novelty-shared-failures')continue;
    if(key.startsWith(recoveryPrefix)){result[original]=localStorage.getItem(key)!;continue;}
    try{parseStoredRecord(key);}catch{result[key]=localStorage.getItem(key)!;}
  }
  }catch{/* A browser that blocks storage should still be able to open the report. */}
  return result;
}
function prefix(id:string,group:string){return group==='defense'?`novelty-defense-${id}-`:group==='integrity'?`research-integrity-${id}-`:`novelty-tools-${id}-`;}
export function collectProjectRecords(id:string,includeNotebook=false):ProjectRecords {
  const records:ProjectRecords={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key)continue;
    for(const group of groups){const start=prefix(id,group);if(key.startsWith(start)){
      const suffix=key.slice(start.length);if(!/^[a-z0-9-]{1,80}$/.test(suffix))continue;
      const raw=localStorage.getItem(key);if(raw!==null)records[group+':'+suffix]=JSON.parse(raw);
    }}
  }
  if(includeNotebook){const raw=localStorage.getItem('novelty-shared-failures');if(raw)records['tools:failure-notebook']=JSON.parse(raw);}
  return records;
}
export function validateProjectRecords(value:unknown):ProjectRecords {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Project records must be an object.');
  const entries=Object.entries(value);if(entries.length>100)throw new Error('Project has more than 100 record groups.');
  for(const [key] of entries)if(!/^(defense|integrity|tools):[a-z0-9-]{1,80}$/.test(key))throw new Error('Project contains an unsupported record key. Tokens and account details cannot be imported.');
  function inspect(item:unknown,depth=0){
    if(depth>32)throw new Error('Project records are nested too deeply.');
    if(typeof item==='number'&&!Number.isFinite(item))throw new Error('Project contains an invalid numeric value.');
    if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){
      if(['__proto__','prototype','constructor'].includes(key))throw new Error('Project contains unsafe object keys.');
      if(/url$/i.test(key)&&typeof child==='string'&&child&&!isAbsoluteHttpUrl(child))throw new Error('Source URLs must be absolute HTTP or HTTPS links without credentials or control characters.');
      inspect(child,depth+1);
    }
  }
  inspect(value);
  const checked=projectSchema.safeParse(value);
  if(!checked.success){const issue=checked.error.issues[0];throw new Error(`Invalid research records at ${issue.path.join('.')||'records'}: ${issue.message}`);}
  if(JSON.stringify(value).length>1_500_000)throw new Error('Project data exceeds 1.5 MB.');
  return value as ProjectRecords;
}
export function applyProjectRecords(id:string,value:unknown,includeNotebook=false) {
  const records=validateProjectRecords(value);
  const changes=Object.entries(records).filter(([key])=>includeNotebook||key!=='tools:failure-notebook').map(([namespace,data])=>{
    const [group,suffix]=namespace.split(':');return [namespace==='tools:failure-notebook'?'novelty-shared-failures':prefix(id,group)+suffix,JSON.stringify(data)] as const;
  });
  const original=changes.map(([key])=>[key,localStorage.getItem(key)] as const);
  try{for(const [key,raw] of changes)writeStoredRecord(key,raw);}
  catch(e){for(const [key,raw] of original){try{if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);}catch{/* Preserve whatever remains if the browser has disabled storage. */}}throw e;}
  window.dispatchEvent(new Event('research-workspace-applied'));
  window.dispatchEvent(new Event('research-integrity-evidence-update'));
}
export function recordDifferences(local:ProjectRecords,remote:ProjectRecords){return [...new Set([...Object.keys(local),...Object.keys(remote)])].filter(key=>JSON.stringify(local[key])!==JSON.stringify(remote[key]));}
