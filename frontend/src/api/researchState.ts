import {request} from './client';
import type {ProjectRecords} from '../lib/projectRecords';
export type SharedResearchState={version:number;records:ProjectRecords;role:'owner'|'reviewer';expires_at:string;updated_at:string|null;history:{version:number;at:string;role:string;changed:string[];previous:ProjectRecords}[]};
const path=(id:string)=>`/api/novelty/analyses/${encodeURIComponent(id)}/research-state`;
export const researchStateApi={
  load:(id:string,token:string)=>request<SharedResearchState>(path(id),{headers:{'X-Review-Token':token}}),
  save:(id:string,token:string,version:number,records:ProjectRecords,remove:string[]=[])=>request<SharedResearchState>(path(id),{method:'POST',headers:{'X-Review-Token':token},body:JSON.stringify({expected_version:version,records,delete:remove})}),
};
