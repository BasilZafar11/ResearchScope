import {useState} from 'react';
import {z} from 'zod';
import {parseStoredRecord,writeStoredRecord} from './projectRecords';

export function useLocalRecords<T>(key:string,schema:z.ZodType<T>){
 const [loaded]=useState(()=>{
  try{const raw=localStorage.getItem(key);return {items:raw?z.array(schema).max(100).parse(parseStoredRecord(key)):[] as T[],message:''}}
  catch{return {items:[] as T[],message:'Saved records could not be loaded. Export or recover browser data before saving replacements.'}}
 });
 const [items,setItems]=useState<T[]>(loaded.items),[message,setMessage]=useState(loaded.message);
 function save(next:T[]){
  try{const valid=z.array(schema).max(100).parse(next);writeStoredRecord(key,JSON.stringify(valid));setItems(valid);setMessage('Saved in this browser');return true}
  catch{setMessage('Could not save. Check values and browser storage; your current form remains available.');return false}
 }
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=key.replace(/:/g,'-')+'.json';a.click();URL.revokeObjectURL(url)}
 return {items,save,message,download};
}
