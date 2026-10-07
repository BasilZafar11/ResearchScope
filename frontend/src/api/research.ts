import {request} from './client';
import type {ResearchInput,ResearchRun,ResearchSummary} from '../types/research';
const path=(id:string)=>`/api/analyses/${encodeURIComponent(id)}/research`;
export const researchApi={
 list:(id:string)=>request<ResearchSummary[]>(path(id)),
 get:(id:string,run:string)=>request<ResearchRun>(path(id)+'/'+encodeURIComponent(run)),
 create:(id:string,input:ResearchInput)=>request<{id:string;cached:boolean}>(path(id),{method:'POST',body:JSON.stringify(input)}),
};
