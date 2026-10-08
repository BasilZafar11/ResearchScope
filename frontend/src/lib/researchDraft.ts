import {useState,type Dispatch,type SetStateAction} from 'react';

const prefix='researchscope-draft-v1:';
function sameShape(value:unknown,example:unknown):boolean{
  if(example===null)return value===null;
  if(Array.isArray(example))return Array.isArray(value)&&value.length<=1000;
  if(typeof example==='object')return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(example).every(([key,item])=>sameShape((value as Record<string,unknown>)[key],item));
  return typeof value===typeof example&&(typeof value!=='number'||Number.isFinite(value));
}
export function useResearchDraft<T>(scope:string,field:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
  const key=prefix+scope+':'+field;
  const [value,setValue]=useState<T>(()=>{const fallback=typeof initial==='function'?(initial as ()=>T)():initial;try{const raw=localStorage.getItem(key);if(!raw||raw.length>150000)return fallback;const saved:unknown=JSON.parse(raw);return sameShape(saved,fallback)?saved as T:fallback;}catch{return fallback;}});
  const update:Dispatch<SetStateAction<T>>=next=>setValue(previous=>{
    const result=typeof next==='function'?(next as (v:T)=>T)(previous):next;
    try{localStorage.setItem(key,JSON.stringify(result));window.dispatchEvent(new CustomEvent('research-draft-status',{detail:'Draft saved in this browser.'}));}
    catch{window.dispatchEvent(new CustomEvent('research-draft-status',{detail:'Draft is in memory only. Browser storage is unavailable; copy your work before closing this page.'}));}
    return result;
  });
  return [value,update];
}
export function deleteResearchDrafts(scope:string){const keys=Object.keys(localStorage).filter(key=>key.startsWith(prefix+scope+':'));keys.forEach(key=>localStorage.removeItem(key));}
