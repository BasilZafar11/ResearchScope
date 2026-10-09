import {ResearchReport} from '../components/research/ResearchReport';
import {RecordRecoveryNotice} from '../components/research/RecordRecoveryNotice';
import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useParams} from 'react-router-dom';
import {noveltyApi} from '../api/novelty';
import type {Job,NoveltyReport} from '../types/novelty';
import {retrievedEvidence} from '../components/ResearchRetrieval';
import {selectedDiscoveryEvidence} from '../components/integrity/MultilingualDiscovery';

function isJob(x:NoveltyReport|Job):x is Job{return x.status!=='complete'}
export function ReportPage({homePath='/',reportBase='/reports'}:{homePath?:string;reportBase?:string}){const {id=''}=useParams();const sample=id==='sample';const query=useQuery({queryKey:['novelty-report',id],queryFn:()=>sample?noveltyApi.sample():noveltyApi.report(id),refetchInterval:q=>!q.state.data||['queued','running'].includes((q.state.data as NoveltyReport|Job).status)?1800:false});
 const [recordRevision,setRecordRevision]=useState(0);
 const [,setEvidenceRevision]=useState(0);
 useEffect(()=>{const update=()=>setEvidenceRevision(value=>value+1);window.addEventListener('research-evidence-updated',update);return()=>window.removeEventListener('research-evidence-updated',update);},[]);
 useEffect(()=>{const update=()=>setRecordRevision(value=>value+1);window.addEventListener('research-workspace-applied',update);return()=>window.removeEventListener('research-workspace-applied',update);},[]);
 if(query.isPending)return <div className="wrap status-page"><p className="kicker">Opening evidence report</p><p role="status">Loading…</p></div>;
 if(query.isError)return <div className="wrap status-page"><p className="kicker">Report unavailable</p><h1>We couldn’t open this report.</h1><p>{query.error instanceof Error?query.error.message:'The report may have expired or its link may be incomplete.'}</p><Link className="primary-button inline-button" to={homePath}>Start a new search</Link></div>;
 const result=query.data as NoveltyReport|Job;
 if(isJob(result)){if(result.status==='failed')return <div className="wrap status-page"><p className="kicker">Search stopped</p><h1>The report could not be completed.</h1><p>{result.error_message}</p><Link to={reportBase+'/sample'}>Open the prepared sample</Link></div>;return <div className="wrap progress-page"><Link to={homePath} className="back-link">← New search</Link><p className="kicker">Building your report</p><h1>Searching the research landscape</h1><p>Retrieved results will be compared against each claim. Source failures remain visible in the completed report.</p><div className="progress-track"><span style={{width:`${result.progress}%`}}/></div><div className="progress-label"><strong>{result.stage.replaceAll('_',' ')}</strong><span>{result.progress}%</span></div><p className="hint">This page updates automatically while the search runs.</p></div>}
 const r=result;
 const additional=[...retrievedEvidence(id),...selectedDiscoveryEvidence(id)];
 const sourceIds=new Set(r.papers.map(source=>String(source.details?.doi||source.details?.DOI||source.source_url||source.id).replace(/^https?:\/\/doi.org\//i,'').toLowerCase()));
 const unique=new Map(additional.filter(source=>!sourceIds.has(String(source.details?.doi).toLowerCase())).map(source=>[source.id,source]));
 const researchReport={...r,papers:[...r.papers,...unique.values()]};
 return <><RecordRecoveryNotice id={id}/><ResearchReport key={id} report={r} expanded={researchReport} id={id} homePath={homePath} reportBase={reportBase} revision={recordRevision}/></>;
}
