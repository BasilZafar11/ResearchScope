import {useState} from 'react';
import {z} from 'zod';
import {safeHttp} from '../../lib/researchIntegrity';
import {useLocalRecords} from '../../lib/useLocalRecords';
import {Field,Select,Notice,SourceLink,text,recordBase,stamp} from './Shared';

const statuses=['unknown','required and pending','approved','not required with reason'] as const;
const schema=z.object({...recordBase,dataset:text,version:text,purpose:text,sensitivity:text,consentScope:text,permittedUses:text,prohibitedUses:text,accessRestrictions:text,retention:text,sharing:text,approval:z.enum(statuses),approvalReference:text,sourceUrl:text,sourcePassage:text,reviewer:text,reviewDate:text,questions:text});
type Record=z.infer<typeof schema>;
const blank=()=>({dataset:'',version:'',purpose:'',sensitivity:'',consentScope:'',permittedUses:'',prohibitedUses:'',accessRestrictions:'',retention:'',sharing:'',approval:'unknown' as Record['approval'],approvalReference:'',sourceUrl:'',sourcePassage:'',reviewer:'',reviewDate:'',questions:''});
export function SensitiveDataReadiness({id}:{id:string}) {
  const records=useLocalRecords('research-integrity-'+id+'-data-readiness',schema);
  const [draft,setDraft]=useState(blank),[error,setError]=useState('');
  function save(){if(!draft.dataset.trim()||!draft.purpose.trim()){setError('Record the dataset and intended use.');return;}if(draft.sourceUrl&&!safeHttp(draft.sourceUrl)){setError('Use an http or https policy link.');return;}
    if(['approved','not required with reason'].includes(draft.approval)&&(!draft.approvalReference.trim()||!draft.reviewer.trim()||!draft.reviewDate)){setError('An approval conclusion needs a reference or reason, reviewer, and review date.');return;}
    if(records.save([...records.items,{...draft,...stamp()}])){setDraft(blank());setError('');}}
  function gaps(record:Record){const fields=['consentScope','permittedUses','accessRestrictions','retention','sharing','sourcePassage'] as const;return [...fields.filter(key=>!record[key].trim()),...(['unknown','required and pending'].includes(record.approval)?['institutional approval']:[]),...(record.questions.trim()?['unresolved questions']:[])];}
  const labels:{key:keyof ReturnType<typeof blank>;label:string}[]=[{key:'dataset',label:'Dataset name'},{key:'version',label:'Dataset version'},{key:'purpose',label:'Intended research use'},{key:'sensitivity',label:'Sensitive attributes or participant groups'},{key:'consentScope',label:'Documented consent scope'},{key:'permittedUses',label:'Permitted uses and fit to this study'},{key:'prohibitedUses',label:'Prohibited uses'},{key:'accessRestrictions',label:'Access restrictions and authorized people'},{key:'retention',label:'Retention and deletion requirements'},{key:'sharing',label:'Sharing, publication, and derived-data rules'},{key:'approvalReference',label:'Approval reference or reason approval is not required'},{key:'sourceUrl',label:'Consent / access policy URL'},{key:'sourcePassage',label:'Relevant policy wording'},{key:'reviewer',label:'Reviewer or institutional contact'},{key:'reviewDate',label:'Review date'},{key:'questions',label:'Unresolved questions and next actions'}];
  return <>
    <p>Document consent and access conditions before using sensitive data. Save policy summaries and approval references; keep participant records out of this form.</p>
    <div className="tool-input-grid">{labels.map(({key,label})=><Field key={key} label={label} area={['consentScope','permittedUses','prohibitedUses','accessRestrictions','retention','sharing','sourcePassage','questions'].includes(key)} type={key==='reviewDate'?'date':key==='sourceUrl'?'url':'text'} value={draft[key]} onChange={value=>setDraft({...draft,[key]:value})}/>)}</div>
    <Select label="Institutional approval status" value={draft.approval} options={statuses} onChange={approval=>setDraft({...draft,approval:approval as Record['approval']})}/>
    <button className="quiet-button" onClick={save}>Save readiness assessment</button><Notice message={error}/>
    {records.items.map(record=><article className="integrity-card" key={record.id}><h4>{record.dataset} · {record.version||'Version unspecified'}</h4><p>{record.purpose}</p><p>{gaps(record).length?'Review required: '+gaps(record).join(', '):'Documentation complete for institutional review.'}</p><dl>{labels.filter(x=>!['dataset','version','purpose'].includes(x.key)).map(({key,label})=><div key={key}><dt>{label}</dt><dd>{record[key]||'Unknown'}</dd></div>)}</dl><p>Approval: {record.approval}</p><SourceLink url={record.sourceUrl}>Policy source</SourceLink><button className="quiet-button" onClick={()=>{const {id:recordId,createdAt,...rest}=record;void recordId;void createdAt;setDraft(rest);}}>Revise as new assessment</button><button className="quiet-button" onClick={()=>records.save(records.items.filter(x=>x.id!==record.id))}>Remove</button></article>)}
    <button className="quiet-button" onClick={records.download}>Export readiness assessments</button><p role="status">{records.message}</p>
    <small>This checklist records user-reviewed conditions. It does not issue institutional approval or determine legal compliance.</small>
  </>;
}
