import {useState} from 'react';

export function publicReportUrl(href:string){const url=new URL(href);url.hash='';url.search='';return url.href;}

export function CopyLink({value,label='Copy report link',copiedMessage='Link copied.',fallbackLabel='Link to copy'}:{value:string;label?:string;copiedMessage?:string;fallbackLabel?:string}){
  const [message,setMessage]=useState('');
  const [fallback,setFallback]=useState(false);
  async function copy(){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(value);setMessage(copiedMessage);setFallback(false);}catch{setFallback(true);setMessage('Clipboard access is unavailable. Select and copy the text below.');}}
  return <div className="copy-action"><button type="button" className="quiet-button" onClick={copy}>{label}</button><span role="status">{message}</span>{fallback&&<label>{fallbackLabel}<input readOnly value={value} onFocus={e=>e.target.select()}/></label>}</div>;
}
