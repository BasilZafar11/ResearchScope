import {useState} from 'react';
import type {Report} from '../types/analysis';

type Notes={notes:string;competitors:string[];evidence:string[]};
const blank=():Notes=>({notes:'',competitors:[],evidence:[]});
function read(key:string):{data:Notes;error:string} {
 try {const raw=window.localStorage.getItem(key);if(!raw)return {data:blank(),error:''};const v=JSON.parse(raw);
  if(typeof v.notes!=='string'||!Array.isArray(v.competitors)||!Array.isArray(v.evidence)||![...v.competitors,...v.evidence].every(x=>typeof x==='string'))throw Error();
  return {data:v,error:''};
 }catch{return {data:blank(),error:'Saved notebook could not be loaded. Changes can be kept in this tab; saving will replace unreadable local data.'}}
}
export function ResearchNotebook({report}:{report:Report}) {
 const key='market-notebook-v1:'+report.id;
 const [loaded]=useState(()=>read(key));
 const [draft,setDraft]=useState(loaded.data);
 const [status,setStatus]=useState(loaded.error);
 const [onlySaved,setOnlySaved]=useState(false);
 function change(next:Notes){setDraft(next);setStatus('Unsaved changes');}
 function toggle(kind:'competitors'|'evidence',id:string){change({...draft,[kind]:draft[kind].includes(id)?draft[kind].filter(v=>v!==id):[...draft[kind],id]});}
 function save(){try{window.localStorage.setItem(key,JSON.stringify(draft));setStatus('Saved in this browser')}catch{setStatus('Storage is unavailable or full. Your unsaved notes remain in this tab.')}}
 return <section className="report-section" id="notebook"><h2>Research notebook and shortlist</h2><p>Notes and bookmarks are saved only in this browser for this report. They are not included in shared report links or sent to the server. Other people using this browser profile can access them.</p>
 <label>Research notes<textarea rows={5} maxLength={10000} value={draft.notes} onChange={e=>change({...draft,notes:e.target.value})}/></label><div className="report-actions"><button className="primary" onClick={save}>Save notebook</button><button className="secondary" onClick={()=>{const value=read(key);setDraft(value.data);setStatus(value.error||'Loaded last saved notebook')}}>Revert unsaved changes</button></div><p role="status">{status}</p>
 <label className="checkbox"><input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/> Show bookmarked items only</label>
 <h3>Competitor shortlist ({draft.competitors.length})</h3><ul className="notebook-list">{report.competitors.map((p,i)=>({p,id:p.data_id||`${p.name}:${i}`})).filter(({id})=>!onlySaved||draft.competitors.includes(id)).map(({p,id})=><li key={id}><label className="checkbox"><input aria-label={`Shortlist ${p.name}`} type="checkbox" checked={draft.competitors.includes(id)} onChange={()=>toggle('competitors',id)}/>{p.name}</label><span className="hint">{p.address}</span></li>)}</ul>
 <details><summary>Evidence bookmarks ({draft.evidence.length})</summary><ul className="notebook-list">{report.evidence.filter(e=>!onlySaved||draft.evidence.includes(e.id)).map(e=><li key={e.id}><label className="checkbox"><input type="checkbox" checked={draft.evidence.includes(e.id)} onChange={()=>toggle('evidence',e.id)}/>{e.title}</label>{e.snippet&&<p>{e.snippet}</p>}{e.source_url&&/^https?:\/\//i.test(e.source_url)&&<a href={e.source_url} target="_blank" rel="noopener noreferrer">Open source</a>}</li>)}</ul></details>
 {onlySaved&&!draft.competitors.length&&!draft.evidence.length&&<p className="empty">No bookmarks yet. Turn off the filter and select items to save.</p>}</section>;
}
