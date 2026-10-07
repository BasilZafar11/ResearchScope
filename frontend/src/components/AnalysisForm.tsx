import {useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {z} from 'zod';
import {api,ApiError} from '../api/client';
import {SearchPlanner} from './SearchPlanner';
import {defaultOptions} from '../lib/marketTools';

export const example={business_category:'Coworking space',city:'Pune',country:'India',keywords:['coworking Pune','shared office Pune','flexible office Pune'],known_competitors:['WeWork','Awfis']};
const clean=z.string().refine(s=>!/[\p{Cc}\p{Cf}]/u.test(s),'Control characters are not allowed').transform(s=>s.trim().replace(/\s+/g,' '));
const field=clean.pipe(z.string().min(2).max(80));
const entries=z.array(clean.pipe(z.string().min(2).max(100))).max(5).refine(a=>new Set(a.map(v=>v.toLowerCase())).size===a.length,'Entries must be unique');
export const inputSchema=z.object({business_category:field,city:field,country:field,keywords:entries.refine(a=>a.length>0,'Enter at least one keyword'),known_competitors:entries,refresh:z.boolean(),options:z.object({ads:z.boolean(),keywords:z.boolean(),seasonality:z.boolean(),hours:z.boolean(),reputation:z.boolean()}).optional()});
export function AnalysisForm(){
 const [form,setForm]=useState({...example,keywords:example.keywords.join(', '),known_competitors:example.known_competitors.join(', '),refresh:false});
 const [error,setError]=useState(''); const navigate=useNavigate();
 const [options,setOptions]=useState(defaultOptions);
 const health=useQuery({queryKey:['health'],queryFn:api.health});
 const mutation=useMutation({mutationFn:api.create,onSuccess:r=>navigate(r.report_url),onError:e=>{if(e instanceof ApiError && e.code==='ANALYSIS_RUNNING' && e.details.id)navigate(`/reports/${e.details.id}`);else setError(e.message)}});
 const update=(key:string,value:string|boolean)=>setForm(f=>({...f,[key]:value}));
 return <form className="analysis-form" onSubmit={e=>{e.preventDefault();setError('');const split=(s:string)=>s.trim()?s.split(',').map(v=>v.trim()):[];const parsed=inputSchema.safeParse({...form,options,keywords:split(form.keywords),known_competitors:split(form.known_competitors)});if(!parsed.success){setError(parsed.error.issues.map(i=>`${String(i.path[0])}: ${i.message}`).join('. '));return}mutation.mutate(parsed.data)}}>
  <div className="section-heading"><h2>Choose your market</h2><button type="button" className="text-button" onClick={()=>{setForm({...example,keywords:example.keywords.join(', '),known_competitors:example.known_competitors.join(', '),refresh:false});setError('')}}>Load Pune example</button></div>
  <label>Business category<input name="business_category" value={form.business_category} onChange={e=>update('business_category',e.target.value)} required minLength={2} maxLength={80}/></label>
  <div className="form-row"><label>City<input name="city" value={form.city} onChange={e=>update('city',e.target.value)} required minLength={2} maxLength={80}/></label><label>Country<input name="country" value={form.country} onChange={e=>update('country',e.target.value)} required minLength={2} maxLength={80}/></label></div>
  <label>Demand keywords<textarea value={form.keywords} onChange={e=>update('keywords',e.target.value)} required maxLength={510} rows={2}/><span className="hint">1–5 phrases, separated by commas. Include your city for local intent.</span></label>
  <label>Known competitors <span className="muted">(optional)</span><input value={form.known_competitors} onChange={e=>update('known_competitors',e.target.value)} maxLength={510}/><span className="hint">Up to 5 names or domains, separated by commas.</span></label>
  <label className="checkbox"><input type="checkbox" checked={form.refresh} onChange={e=>update('refresh',e.target.checked)}/> Refresh instead of reusing a report from the past hour</label>
  <SearchPlanner options={options} onChange={setOptions}/>
  {health.data && !health.data.live_serpapi_enabled && <div className="notice">Sample mode uses synthetic Pune coworking data. Live searches are disabled.</div>}
  <p className="hint">Reports and inputs are public. Do not enter personal or confidential information.</p>
  {error&&<p className="error" role="alert">{error}</p>}
  <button className="primary" type="submit" disabled={mutation.isPending}>{mutation.isPending?'Starting analysis…':'Analyze this market'}</button>
  <span className="hint">Core live analyses target 30–90 seconds. Optional detail searches may take longer. No sign-in required.</span>
 </form>
}

