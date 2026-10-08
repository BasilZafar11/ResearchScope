import {useState} from 'react';

export function publicReportUrl(href:string){const url=new URL(href);url.hash='';url.search='';return url.href;}

export function CopyLink({value,label='Copy report link'}:{value:string;label?:string}){
  const [message,setMessage]=useState('');
  const [fallback,setFallback]=useState(false);
  async function copy(){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(value);setMessage('Link copied.');setFallback(false);}catch{setFallback(true);setMessage('Copy the link below. Clipboard access is unavailable.');}}
  return <div className="copy-action"><button type="button" className="quiet-button" onClick={copy}>{label}</button><span role="status">{message}</span>{fallback&&<label>Link to copy<input readOnly value={value} onFocus={e=>e.target.select()}/></label>}</div>;
}
