import {lazy,Suspense} from 'react';
import type {NoveltyReport} from '../../types/novelty';
import type {ResearchTool} from '../../lib/researchToolRegistry';
const Toolkit=lazy(()=>import('../ResearchToolkit').then(module=>({default:module.ResearchToolkit})));
const Defense=lazy(()=>import('../ResearchDefenseLab').then(module=>({default:module.ResearchDefenseLab})));
const Integrity=lazy(()=>import('../ResearchIntegrityLab').then(module=>({default:module.ResearchIntegrityLab})));
export function ToolHost({tool,report,id}:{tool:ResearchTool;report:NoveltyReport;id:string}){return <section className="selected-tool"><h3>{tool.title}</h3><Suspense fallback={<p role="status">Loading tool…</p>}>{tool.group==='toolkit'?<Toolkit report={report} id={id} tool={tool.number}/>:tool.group==='defense'?<Defense report={report} id={id} tool={tool.number}/>:<Integrity report={report} id={id} tool={tool.number}/>}</Suspense></section>;}
