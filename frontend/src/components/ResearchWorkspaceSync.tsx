import {useEffect,useState} from 'react';
import {noveltyApi,workspaceCapabilities} from '../api/novelty';
import {researchStateApi} from '../api/researchState';
import type {SharedResearchState} from '../api/researchState';
import type {NoveltyReport} from '../types/novelty';
import {applyProjectRecords,collectProjectRecords,recordDifferences} from '../lib/projectRecords';
import {downloadFile} from '../lib/researchIntegrity';

export function ResearchWorkspaceSync({id,report}:{id:string;report:NoveltyReport}) {
  const [token,setToken]=useState(()=>workspaceCapabilities(id).token);
  const [shared,setShared]=useState<SharedResearchState|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notebook,setNotebook]=useState(false),[monitor,setMonitor]=useState(false);
  const [differences,setDifferences]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]);
  const available=report.saved&&!report.sample_mode&&!report.is_public;
  useEffect(()=>{const changed=(event:Event)=>{if((event as CustomEvent<string>).detail!==id)return;setToken(workspaceCapabilities(id).token);setShared(null);setDifferences([]);setSelected([]);setError('');};window.addEventListener('workspace-capabilities-changed',changed);return()=>window.removeEventListener('workspace-capabilities-changed',changed);},[id]);
  function compare(next:SharedResearchState){const keys=recordDifferences(collectProjectRecords(id,notebook),next.records).filter(key=>notebook||key!=='tools:failure-notebook');setDifferences(keys);setSelected([]);}
  async function load(){setBusy(true);setError('');try {const next=await researchStateApi.load(id,token);setShared(next);compare(next);setMessage('Loaded shared version '+next.version+'. Browser data has not been replaced.');}catch(e){setError(e instanceof Error?e.message:'Could not load shared records.');}finally{setBusy(false);}}
  async function create(){if(!token||!window.confirm('Replace owner and reviewer links? Previous links will stop working.'))return;setBusy(true);setError('');try {const result=await noveltyApi.createWorkspace(id,token);setToken(result.owner_token);setShared(null);setDifferences([]);setSelected([]);setMessage('Previous links revoked. Copy the new owner and reviewer links; tokens are returned only once.');}catch(e){setError(e instanceof Error?e.message:'Could not create workspace.');}finally{setBusy(false);}}
  async function publish(){if(!shared)return;setBusy(true);setError('');try{
    const local=collectProjectRecords(id,notebook),records:Record<string,unknown>={};
    for(const key of selected)if(key in local)records[key]=local[key];
    const next=await researchStateApi.save(id,token,shared.version,records);setShared(next);compare(next);setMessage('Published shared version '+next.version+'.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save shared records.');}finally{setBusy(false);}}
  function apply(){if(!shared)return;try{const backup=collectProjectRecords(id,notebook);localStorage.setItem('researchscope-backup-'+id,JSON.stringify(backup));applyProjectRecords(id,Object.fromEntries(selected.filter(key=>key in shared.records).map(key=>[key,shared.records[key]])),notebook);compare(shared);setMessage('Selected shared records applied. A browser backup was retained.');}catch(e){setError(e instanceof Error?e.message:'Browser storage could not be updated.');}}
  useEffect(()=>{if(!monitor||!token||!shared)return;const timer=window.setInterval(()=>{researchStateApi.load(id,token).then(next=>{if(next.version!==shared.version)setMessage('A collaborator published version '+next.version+'. Reload shared records to compare.');}).catch(()=>{});},30000);return()=>clearInterval(timer);},[monitor,token,id,shared?.version]);
  function copy(role:'owner'|'reviewer'){try{const access=workspaceCapabilities(id),value=role==='owner'?access.owner:access.reviewer;if(!value)throw new Error('This browser has no '+role+' token.');void navigator.clipboard.writeText(location.origin+'/research-scope/reports/'+id+'#'+(role==='owner'?'owner':'review')+'='+encodeURIComponent(value)).catch(()=>setError('Could not copy link. Copy the capability from your current owner link.'));}catch(e){setError(e instanceof Error?e.message:'Could not copy link.');}}
  return <section className="report-section"><h2>Shared research records</h2><p>Save selected Defense Lab and integrity records to this report’s review workspace. Reload to compare collaborator edits before publishing. Local work remains available without a shared workspace.</p>
    {!available?<p>Shared storage requires a saved, unlisted live report. The fictional sample and public reports remain browser-only.</p>:<>
      <label>Owner or reviewer capability token<input type="password" autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);setShared(null);}}/></label>
      <div className="tool-link-row"><button className="quiet-button" disabled={busy||!token} onClick={create}>Replace workspace links</button><button className="quiet-button" onClick={()=>{try{setToken(localStorage.getItem('novelty-owner-'+id)||'');setShared(null);}catch{setError('Browser storage is unavailable.');}}}>Use saved owner token</button><button className="quiet-button" disabled={busy||!token} onClick={load}>Reload shared records</button><button className="quiet-button" onClick={()=>copy('owner')}>Copy owner link</button><button className="quiet-button" onClick={()=>copy('reviewer')}>Copy reviewer link</button></div>
      <label><input type="checkbox" checked={notebook} onChange={e=>{setNotebook(e.target.checked);setShared(null);}}/>Include the failure notebook shared across this browser’s projects</label>
      {shared&&<><p>Version {shared.version} · {shared.role} access · expires {new Date(shared.expires_at).toLocaleString()}</p><p>Only selected record groups will transfer. Conflicting revisions require a fresh comparison.</p>
        {differences.length?differences.map(key=><label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={e=>setSelected(e.target.checked?[...selected,key]:selected.filter(x=>x!==key))}/>{key} {!(key in shared.records)?'· browser only':!(key in collectProjectRecords(id,notebook))?'· shared only':'· differs'}</label>):<p>No differences detected.</p>}
        <button className="quiet-button" disabled={busy||!selected.length} onClick={publish}>Publish selected browser records</button><button className="quiet-button" disabled={busy||!selected.length} onClick={apply}>Apply selected shared records</button>
        <label><input type="checkbox" checked={monitor} onChange={e=>setMonitor(e.target.checked)}/>Check for collaborator updates while this page is open</label>
        <details><summary>Server revision history · {shared.history.length}</summary>{shared.history.map(item=><p key={item.version}>Version {item.version} · {item.role} · {item.at} · {item.changed.join(', ')}</p>)}</details>
        <button className="quiet-button" onClick={()=>downloadFile('shared-research-records.json',JSON.stringify(shared,null,2))}>Export shared records and history</button>
      </>}
    </>}
    {message&&<p role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
