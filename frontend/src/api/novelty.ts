import type {Job,NoveltyReport,RevisionPreview,DocumentReview,Workspace} from '../types/novelty';
const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export class NoveltyApiError extends Error{constructor(message:string,public code:string){super(message)}}
async function get<T>(path:string,options?:RequestInit):Promise<T>{const r=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...options?.headers},signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw new NoveltyApiError(d.error?.message||'The service is unavailable.',d.error?.code||'REQUEST_FAILED');return d}
const path=(id:string)=>`/api/novelty/analyses/${encodeURIComponent(id)}`;
async function uploadPdf(id:string,file:File):Promise<DocumentReview>{const r=await fetch(base+(id==='sample'?'/api/sample-report':path(id))+'/document-review',{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});const d=await r.json();if(!r.ok)throw new NoveltyApiError(d.error?.message||'PDF review failed.',d.error?.code||'REQUEST_FAILED');return d}
export const noveltyApi={status:()=>get<{hosted_mode:string;sample_mode:boolean;groq_mode:string;message:string}>('/api/demo-status'),sample:()=>get<NoveltyReport>('/api/sample-report'),create:(data:unknown)=>get<{id:string;report_url:string;status:string}>('/api/novelty/analyses',{method:'POST',body:JSON.stringify(data)}),report:(id:string)=>get<NoveltyReport|Job>(path(id)),recent:()=>get<{id:string;title:string;field:string;overlap_score:number;confidence_score:number;created_at:string}[]>('/api/novelty/analyses'),
 revision:(id:string,data:unknown)=>get<RevisionPreview>((id==='sample'?'/api/sample-report':path(id))+'/revision-preview',{method:'POST',body:JSON.stringify(data)}),
 refresh:(id:string,ownerToken:string)=>get<{id:string;report_url:string;status:string}>(path(id)+'/refresh',{method:'POST',headers:{'X-Review-Token':ownerToken}}),
 brief:(id:string)=>get<Record<string,unknown>>(path(id)+'/brief'),documentReview:uploadPdf,
 workspace:(id:string)=>get<Workspace>(path(id)+'/workspace'),
 createWorkspace:(id:string)=>get<{review_token:string;owner_token:string;workspace:Workspace}>(path(id)+'/workspace',{method:'POST'}),
 comment:(id:string,token:string,data:unknown)=>get<{comments:Workspace['comments']}>(path(id)+'/workspace/comments',{method:'POST',headers:{'X-Review-Token':token},body:JSON.stringify(data)}),
 watch:(id:string,token:string,watched:boolean)=>get<Workspace>(path(id)+'/workspace/watch',{method:'POST',headers:{'X-Review-Token':token},body:JSON.stringify({watched})})};
