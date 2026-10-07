import type {AnalysisInput,Job,Report,Summary} from '../types/analysis';
import type {StressResult} from '../components/OpportunityStress';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const stress=(id:string)=>request<StressResult>(`/api/analyses/${encodeURIComponent(id)}/stress`);
export class ApiError extends Error { constructor(message:string,public code:string,public details:Record<string,string>={}) {super(message)} }
export async function request<T>(path:string, options?:RequestInit):Promise<T> {
  const res=await fetch(base+path,{...options,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...options?.headers}});
  const data=await res.json();
  if(!res.ok) throw new ApiError(data.error?.message||'The service is unavailable. Please try again.',data.error?.code||'REQUEST_FAILED',data.error?.details);
  return data;
}
export const api={health:()=>request<{live_serpapi_enabled:boolean}>('/health'),create:(input:AnalysisInput)=>request<{id:string;cached:boolean;report_url:string}>('/api/analyses',{method:'POST',body:JSON.stringify(input)}),get:(id:string)=>request<Job|Report>(`/api/analyses/${encodeURIComponent(id)}`),recent:()=>request<Summary[]>('/api/analyses'),revise:(id:string,changes:{competitor_ranks:number[];news_indices:number[];reason:string})=>request<{id:string;report_url:string}>(`/api/analyses/${encodeURIComponent(id)}/relevance`,{method:'POST',body:JSON.stringify(changes)})};
