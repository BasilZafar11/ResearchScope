import {z} from 'zod';
import {downloadFile} from '../../lib/researchIntegrity';
import {Field,Select,SaveBar,useDraft,text} from './Shared';

const schema=z.object({kind:z.enum(['comparison','association','description']),population:text,intervention:text,comparator:text,outcome:text,metric:text,setting:text,timeframe:text,assumptions:text,question:text,reviewed:z.boolean()});
export function QuestionCoach({id}:{id:string}) {
  const saved=useDraft('research-integrity-'+id+'-question',schema,{kind:'comparison',population:'',intervention:'',comparator:'',outcome:'',metric:'',setting:'',timeframe:'',assumptions:'',question:'',reviewed:false});
  const draft=saved.value;
  function change(key:keyof typeof draft,value:string){saved.save({...draft,[key]:value,reviewed:false});}
  const required=['population','intervention','outcome','metric','setting','timeframe',...(draft.kind==='comparison'?['comparator']:[])];
  const missing=required.filter(key=>!String(draft[key as keyof typeof draft]).trim());
  const template=draft.kind==='comparison'?`Among ${draft.population||'[population]'} in ${draft.setting||'[setting]'}, how does ${draft.intervention||'[intervention]'} compare with ${draft.comparator||'[comparator]'} on ${draft.outcome||'[outcome]'}, measured by ${draft.metric||'[metric]'} over ${draft.timeframe||'[timeframe]'}?`:draft.kind==='association'?`Among ${draft.population||'[population]'} in ${draft.setting||'[setting]'}, what association exists between ${draft.intervention||'[exposure]'} and ${draft.outcome||'[outcome]'}, measured by ${draft.metric||'[metric]'} over ${draft.timeframe||'[timeframe]'}?`:`In ${draft.population||'[population]'} within ${draft.setting||'[setting]'}, what is ${draft.outcome||'[outcome]'} for ${draft.intervention||'[phenomenon]'}, measured by ${draft.metric||'[metric]'} over ${draft.timeframe||'[timeframe]'}?`;
  return <>
    <p>Define one measurable question and explicitly record its boundaries. Association templates avoid assuming causality.</p>
    <Select label="Question type" value={draft.kind} options={['comparison','association','description']} onChange={value=>change('kind',value)}/>
    <div className="tool-input-grid">{(['population','intervention','comparator','outcome','metric','setting','timeframe'] as const).map(key=><Field key={key} label={key==='intervention'?'Intervention, exposure, or phenomenon':key} value={draft[key]} onChange={value=>change(key,value)}/>)}</div>
    <Field label="Assumptions and exclusions" area value={draft.assumptions} onChange={value=>change('assumptions',value)}/>
    <article className="integrity-card"><p>{template}</p><button className="quiet-button" onClick={()=>saved.save({...draft,question:template,reviewed:false})}>Use this question draft</button></article>
    <Field label="Editable research question" area value={draft.question} onChange={value=>change('question',value)}/>
    <p>{missing.length?'Scope gaps: '+missing.join(', '):'All scope fields provided. Review whether the study can measure this outcome.'}</p>
    <label className="integrity-check"><input type="checkbox" checked={draft.reviewed} disabled={missing.length>0||!draft.question.trim()} onChange={e=>saved.save({...draft,reviewed:e.target.checked})}/>I reviewed the question’s scope and measurability</label>
    <button className="quiet-button" onClick={()=>downloadFile('research-question.md','# Research question\n\n'+(draft.question||template)+'\n\n## Assumptions\n'+draft.assumptions+'\n\nReview status: '+(draft.reviewed?'reviewed':'draft'),'text/markdown')}>Download question brief</button>
    <SaveBar error={saved.error} onExport={saved.export}/>
  </>;
}
