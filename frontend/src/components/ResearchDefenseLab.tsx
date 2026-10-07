import {useMemo} from 'react';
import type {ReactNode} from 'react';
import type {NoveltyReport} from '../types/novelty';
import {CombinationOverlapAudit} from './CombinationOverlapAudit';
import {NoveltyWordingChecker} from './NoveltyWordingChecker';
import {ClaimBoundaryEditor} from './ClaimBoundaryEditor';
import {BaselineFairnessAudit} from './BaselineFairnessAudit';
import {OutdatedBaselineDetector} from './OutdatedBaselineDetector';
import {DatasetLeakageAudit} from './DatasetLeakageAudit';
import {BenchmarkContaminationTracker} from './BenchmarkContaminationTracker';
import {HiddenPriorWorkDiscovery} from './HiddenPriorWorkDiscovery';
import {PublicationLineageView} from './PublicationLineageView';
import {EvidenceCutoffSnapshots} from './EvidenceCutoffSnapshots';
import {FullTextAccessFinder} from './FullTextAccessFinder';
import {SearchStoppingAssistant} from './SearchStoppingAssistant';
import {ContributionImportanceAssessment} from './ContributionImportanceAssessment';
import {ClaimMeasurementAlignment} from './ClaimMeasurementAlignment';
import {ConfounderFinder} from './ConfounderFinder';
import {MinimumStudyPlanner} from './MinimumStudyPlanner';
import {FailureKnowledgeNotebook} from './FailureKnowledgeNotebook';
import {VenueCriteriaMapper} from './VenueCriteriaMapper';
import {ResearchTaskBoard} from './ResearchTaskBoard';
import {ProceedDecisionGate} from './ProceedDecisionGate';

const componentsDefault=(r:NoveltyReport)=>r.input.keywords.slice(0,4).join('\n');

function Feature({n,title,children}: {n:number;title:string;children:ReactNode}){return <details className="tool-panel defense-feature" onToggle={()=>window.dispatchEvent(new Event('research-defense-refresh'))}><summary>{String(n).padStart(2,'0')} · {title}</summary>{children}</details>}

export function ResearchDefenseLab({report,id}:{report:NoveltyReport;id:string}){
 const allEvidence=useMemo(()=>[...report.papers,...report.patents,...report.web_results],[report]);

 return <section className="toolkit defense-lab"><header><p className="kicker">Research Defense Lab</p><h2>Test whether the contribution is clear, fair, and feasible</h2><p>Twenty structured checks for the hardest decisions in a research project. User judgments stay labeled as judgments; text matches remain search signals.</p></header>

  <Feature n={1} title="Combination overlap audit"><CombinationOverlapAudit reportId={id} initialComponents={componentsDefault(report)} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={2} title="Novelty wording checker"><NoveltyWordingChecker reportId={id} initialText={[report.input.title,report.input.abstract,...report.input.claims].join(String.fromCharCode(10))} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={3} title="Claim boundary editor"><ClaimBoundaryEditor reportId={id} initialClaim={[report.input.title,report.input.abstract,...report.input.claims].filter(Boolean).join(String.fromCharCode(10))} evidence={allEvidence}/></Feature>

  <Feature n={4} title="Baseline fairness audit"><BaselineFairnessAudit reportId={id}/></Feature>

  <Feature n={5} title="Outdated baseline detector"><OutdatedBaselineDetector reportId={id} papers={report.papers} idea={report.input.title+" "+report.input.abstract}/></Feature>

  <Feature n={6} title="Dataset leakage audit"><DatasetLeakageAudit/></Feature>

  <Feature n={7} title="Benchmark contamination check"><BenchmarkContaminationTracker reportId={id} idea={report.input.title}/></Feature>

  <Feature n={8} title="Hidden prior-work discovery"><HiddenPriorWorkDiscovery reportId={id} idea={report.input.title}/></Feature>

  <Feature n={9} title="Publication lineage view"><PublicationLineageView reportId={id} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={10} title="Evidence cutoff snapshot"><EvidenceCutoffSnapshots reportId={id} report={report} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={11} title="Full-text access finder"><FullTextAccessFinder reportId={id} papers={report.papers}/></Feature>

  <Feature n={12} title="Search stopping assistant"><SearchStoppingAssistant reportId={id}/></Feature>

  <Feature n={13} title="Contribution importance assessment"><ContributionImportanceAssessment reportId={id}/></Feature>

  <Feature n={14} title="Claim-to-measurement alignment"><ClaimMeasurementAlignment reportId={id} claims={report.claims.map(claim=>({id:claim.id,text:claim.text}))}/></Feature>

  <Feature n={15} title="Confounder finder"><ConfounderFinder reportId={id}/></Feature>

  <Feature n={16} title="Minimum convincing study planner"><MinimumStudyPlanner reportId={id} claims={report.claims.map(claim=>({id:claim.id,text:claim.text}))}/></Feature>

  <Feature n={17} title="Failure knowledge notebook"><FailureKnowledgeNotebook/></Feature>

  <Feature n={18} title="Venue criteria mapper"><VenueCriteriaMapper reportId={id} claims={report.claims.map(claim=>({id:claim.id,text:claim.text}))} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={19} title="Research task ownership board"><ResearchTaskBoard reportId={id} claims={report.claims.map(claim=>({id:claim.id,text:claim.text}))} evidence={[...report.papers,...report.patents,...report.web_results]}/></Feature>

  <Feature n={20} title="Proceed, revise, or pause gate"><ProceedDecisionGate reportId={id}/></Feature>
 </section>
}
