import {z} from 'zod';
import {sampleRequirement} from '../../lib/researchIntegrity';
import type {PowerInput} from '../../lib/researchIntegrity';
import {Field,Select,SaveBar,useDraft} from './Shared';

const schema=z.object({mode:z.enum(['two means','paired mean','proportion precision']),effect:z.number(),sd:z.number(),alpha:z.number(),power:z.number(),attrition:z.number(),margin:z.number(),proportion:z.number(),rationale:z.string().max(12000)});
export function PowerPlanner({id}:{id:string}) {
  const saved=useDraft<z.infer<typeof schema>>('research-integrity-'+id+'-power',schema,{mode:'two means',effect:.5,sd:1,alpha:.05,power:.8,attrition:.1,margin:.05,proportion:.5,rationale:''});
  const value=saved.value;
  let error='',result:ReturnType<typeof sampleRequirement>|undefined;
  try{result=sampleRequirement(value);}catch(e){error=e instanceof Error?e.message:'Check inputs.';}
  const scenarios=[.75,1,1.25].map(factor=>{try {const input={...value,...(value.mode==='proportion precision'?{margin:value.margin*factor}:{effect:value.effect*factor})};return {factor,...sampleRequirement(input)};}catch{return undefined;}}).filter(x=>x!==undefined);
  const numberField=(label:string,key:keyof PowerInput)=> <label key={key}>{label}<input type="number" step="any" value={String(value[key])} onChange={e=>{const numeric=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(numeric))saved.save({...value,[key]:numeric});}}/></label>;
  return <>
    <p>Estimate sample requirements using a two-sided normal approximation. The result is conditional on your assumptions.</p>
    <Select label="Design" value={value.mode} options={['two means','paired mean','proportion precision']} onChange={mode=>saved.save({...value,mode:mode as PowerInput['mode']})}/>
    <div className="tool-input-grid">
      {value.mode==='proportion precision'?<>{numberField('Expected proportion (0–1)','proportion')}{numberField('Confidence interval half-width (0–1)','margin')}</>:<>{numberField('Smallest meaningful difference','effect')}{numberField(value.mode==='paired mean'?'Standard deviation of paired differences':'Common standard deviation','sd')}{numberField('Desired power (0.5–1)','power')}</>}
      {numberField('Significance α (0–0.5)','alpha')}{numberField('Expected attrition fraction (0–1)','attrition')}
    </div>
    <Field label="Evidence for assumptions and planned analysis" area value={value.rationale} onChange={rationale=>saved.save({...value,rationale})}/>
    {error?<p role="alert" className="warning-line">{error}</p>:result&&<article className="integrity-card"><h4>{result.total.toLocaleString()} total recruitment target</h4><p>{result.analyzed.toLocaleString()} analyzable {value.mode==='two means'?'observations per group':value.mode==='paired mean'?'pairs':'observations'}; recruit {result.recruited.toLocaleString()} {value.mode==='two means'?'per group':''} after attrition.</p><p>{value.mode==='two means'?'Equal independent groups; common known/anticipated variance.':value.mode==='paired mean'?'Matched pairs; variance describes within-pair differences.':'Single proportion confidence interval; normal approximation, no finite population correction.'}</p></article>}
    {!!result&&<div className="integrity-table-wrap"><table><caption>Sensitivity to {value.mode==='proportion precision'?'precision margin':'meaningful difference'}</caption><thead><tr><th>Assumption</th><th>Analyzable {value.mode==='two means'?'per group':''}</th><th>Total recruitment</th></tr></thead><tbody>{scenarios.map(x=><tr key={x.factor}><td>{x.factor*100}% of entered {value.mode==='proportion precision'?'margin':'effect'}</td><td>{x.analyzed}</td><td>{x.total}</td></tr>)}</tbody></table></div>}
    <small>Normal approximation may be inadequate for small samples or rare proportions. Clustered, repeated, sequential, survival, and unequal-allocation designs need another method. Multiple outcomes require a multiplicity plan. Formula references: <a href="https://www.itl.nist.gov/div898/handbook/prc/section2/prc222.htm" target="_blank" rel="noreferrer">NIST sample planning</a> and <a href="https://www.itl.nist.gov/div898/handbook/ppc/section3/ppc333.htm" target="_blank" rel="noreferrer">proportion precision</a>.</small>
    <SaveBar error={saved.error} onExport={saved.export}/>
  </>;
}
