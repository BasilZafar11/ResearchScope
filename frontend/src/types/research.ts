import type {SearchUsage} from './analysis';
export type ResearchTool='directions'|'forums'|'autocomplete'|'events'|'jobs'|'shopping'|'hotels'|'flights'|'images'|'scholar';
export interface ResearchInput{tool:ResearchTool;query?:string;origin?:string;competitor_ranks?:number[];travel_mode?:string;check_in?:string;check_out?:string;departure_date?:string;departure_airport?:string;arrival_airport?:string;currency?:string;adults?:number;refresh?:boolean}
export interface ResearchRow{id:string;title:string;url:string|null;detail:string;meta:Record<string,string|number|null>;tags:string[];image:string|null}
export interface ResearchBatch{label:string;status:string;message:string;rows:ResearchRow[];source_url:string|null}
export interface ResearchSummary{id:string;tool:ResearchTool;status:string;created_at:string;data_mode:'fixture'|'live';input:ResearchInput}
export interface ResearchRun extends ResearchSummary{planned_requests:number;completed_requests:number;sample_notice:string;batches:ResearchBatch[];usage:SearchUsage;error?:string}
