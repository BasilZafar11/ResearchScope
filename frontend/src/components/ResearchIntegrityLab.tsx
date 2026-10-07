import type {ReactNode} from 'react';
import {useEffect,useState} from 'react';
import type {NoveltyReport} from '../types/novelty';
import {PublicationAlerts} from './integrity/PublicationAlerts';
import {ContradictoryEvidence} from './integrity/ContradictoryEvidence';
import {CitationSupport} from './integrity/CitationSupport';
import {QuestionCoach} from './integrity/QuestionCoach';
import {PowerPlanner} from './integrity/PowerPlanner';
import {ReproducibilityBuilder} from './integrity/ReproducibilityBuilder';
import {ArtifactAudit} from './integrity/ArtifactAudit';
import {ExtractionReconciliation} from './integrity/ExtractionReconciliation';
import {MultilingualDiscovery,selectedDiscoveryEvidence} from './integrity/MultilingualDiscovery';
import {SensitiveDataReadiness} from './integrity/SensitiveDataReadiness';
import '../styles/integrity.css';

function Feature({number,title,children}:{number:number;title:string;children:ReactNode}) {
  return <details className="tool-panel integrity-feature"><summary>{String(number).padStart(2,'0')} · {title}</summary><div className="integrity-content">{children}</div></details>;
}
export function ResearchIntegrityLab({report,id}:{report:NoveltyReport;id:string}) {
  const [discovered,setDiscovered]=useState(()=>selectedDiscoveryEvidence(id));
  useEffect(()=>{const update=()=>setDiscovered(selectedDiscoveryEvidence(id));update();window.addEventListener('research-integrity-evidence-update',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('research-integrity-evidence-update',update);window.removeEventListener('storage',update);};},[id]);
  const existing=new Set(report.papers.map(x=>String(x.details?.doi||x.details?.DOI||x.source_url||'').replace(/^https?:\/\/(dx\.)?doi.org\//,'').toLowerCase()));
  const additions=discovered.filter(x=>!existing.has(String(x.details?.doi).toLowerCase()));
  const expanded={...report,papers:[...report.papers,...additions]};
  const evidence=[...expanded.papers,...report.patents,...report.web_results];
  return <section className="toolkit integrity-lab" key={id}>
    <header><p className="kicker">Research integrity workspace</p><h2>Check the evidence and prepare a reproducible study</h2><p>Ten tools for source reliability, study design, and responsible data use. Records stay in this browser; export them to share or preserve your work.</p></header>
    {additions.length>0&&<p>{additions.length} selected discovery sources are available in these tools. They have not been included in the original report’s overlap score.</p>}
    <Feature number={1} title="Retraction and correction alerts"><PublicationAlerts report={expanded} id={id}/></Feature>
    <Feature number={2} title="Contradictory evidence explorer"><ContradictoryEvidence report={expanded} id={id}/></Feature>
    <Feature number={3} title="Citation support checker"><CitationSupport evidence={evidence} id={id}/></Feature>
    <Feature number={4} title="Research question precision coach"><QuestionCoach id={id}/></Feature>
    <Feature number={5} title="Statistical power and precision planner"><PowerPlanner id={id}/></Feature>
    <Feature number={6} title="Reproducibility package builder"><ReproducibilityBuilder id={id}/></Feature>
    <Feature number={7} title="Research artifact availability audit"><ArtifactAudit evidence={evidence} id={id}/></Feature>
    <Feature number={8} title="Evidence extraction reconciliation"><ExtractionReconciliation evidence={evidence} id={id}/></Feature>
    <Feature number={9} title="Multilingual prior-work discovery"><MultilingualDiscovery id={id} idea={report.input.title}/></Feature>
    <Feature number={10} title="Sensitive-data research readiness"><SensitiveDataReadiness id={id}/></Feature>
  </section>;
}
