import {providerFetch} from './providerKeys';
import type {Job,NoveltyReport,RevisionPreview,DocumentReview,Workspace} from '../types/novelty';
const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export class NoveltyApiError extends Error{constructor(message:string,public code:string){super(message)}}
async function get<T>(path:string,options?:RequestInit):Promise<T>{try{const r=await providerFetch(base+path,{...options,headers:{'Content-Type':'application/json',...options?.headers}});const d=await r.json();if(!r.ok)throw new NoveltyApiError(d.error?.message||'The service is unavailable. Try again shortly.',d.error?.code||'REQUEST_FAILED');return d;}catch(error){if(error instanceof NoveltyApiError)throw error;if(error instanceof DOMException&&(error.name==='TimeoutError'||error.name==='AbortError'))throw new NoveltyApiError('The backend took too long to respond. It may be waking up; try again in a moment.','TIMEOUT');throw new NoveltyApiError('Could not reach the backend or read its response. Check your connection and try again.','CONNECTION_FAILED');}}
const path=(id:string)=>`/api/novelty/analyses/${encodeURIComponent(id)}`;
async function uploadPdf(id:string,file:File):Promise<DocumentReview>{return get<DocumentReview>((id==='sample'?'/api/sample-report':path(id))+'/document-review',{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});}
export const noveltyApi={status:()=>get<{hosted_mode:string;sample_mode:boolean;groq_mode:string;message:string;quota_exhausted:boolean}>('/api/demo-status'),sample:()=>get<NoveltyReport>('/api/sample-report'),create:async(data:unknown)=>{const result=await get<{id:string;report_url:string;status:string;owner_token?:string;review_token?:string}>('/api/novelty/analyses',{method:'POST',body:JSON.stringify(data)});rememberOwner(result);return result;},report:(id:string)=>get<NoveltyReport|Job>(path(id)),recent:()=>get<{id:string;title:string;field:string;overlap_score:number;confidence_score:number;created_at:string}[]>('/api/novelty/analyses'),
 revision:(id:string,data:unknown)=>get<RevisionPreview>((id==='sample'?'/api/sample-report':path(id))+'/revision-preview',{method:'POST',body:JSON.stringify(data)}),
 refresh:async(id:string,ownerToken:string)=>{const result=await get<{id:string;report_url:string;status:string;owner_token?:string;review_token?:string}>(path(id)+'/refresh',{method:'POST',headers:{'X-Review-Token':ownerToken}});rememberOwner(result);return result;},
 brief:(id:string)=>get<Record<string,unknown>>(path(id)+'/brief'),documentReview:uploadPdf,
 workspace:(id:string)=>get<Workspace>(path(id)+'/workspace',{headers:{'X-Review-Token':workspaceToken(id)}}),
 createWorkspace:async(id:string,ownerToken:string)=>{const result=await get<{review_token:string;owner_token:string;workspace:Workspace}>(path(id)+'/workspace/rotate',{method:'POST',headers:{'X-Review-Token':ownerToken}});rememberOwner({id,...result},true);return result;},
 comment:(id:string,token:string,data:unknown)=>get<{comments:Workspace['comments']}>(path(id)+'/workspace/comments',{method:'POST',headers:{'X-Review-Token':token},body:JSON.stringify(data)}),
 watch:(id:string,token:string,watched:boolean)=>get<Workspace>(path(id)+'/workspace/watch',{method:'POST',headers:{'X-Review-Token':token},body:JSON.stringify({watched})})};

const capabilities=new Map<string,{owner:string;reviewer:string}>();
export function workspaceCapabilities(id:string){
 const hash=new URLSearchParams(location.hash.slice(1)),memory=capabilities.get(id);let owner=memory?.owner||'',reviewer=memory?.reviewer||'';
 try{owner=owner||localStorage.getItem('novelty-owner-'+id)||'';reviewer=reviewer||localStorage.getItem('novelty-invite-'+id)||'';}catch{/* Capabilities still work in page memory and owner links. */}
 return {owner:hash.get('owner')||owner,reviewer,token:hash.get('owner')||hash.get('review')||owner};
}
function workspaceToken(id:string){return workspaceCapabilities(id).token;}
function rememberOwner(result:{id:string;owner_token?:string;review_token?:string},rotated=false){if(result.owner_token){
 capabilities.set(result.id,{owner:result.owner_token,reviewer:result.review_token||''});
 if(rotated){const url=new URL(location.href);url.hash='owner='+encodeURIComponent(result.owner_token);history.replaceState(history.state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}));}
 try{localStorage.setItem('novelty-owner-'+result.id,result.owner_token);if(result.review_token)localStorage.setItem('novelty-invite-'+result.id,result.review_token);}catch{/* The caller retains the owner capability in its new report link. */}
 if(rotated)window.dispatchEvent(new CustomEvent('workspace-capabilities-changed',{detail:result.id}));
}}
