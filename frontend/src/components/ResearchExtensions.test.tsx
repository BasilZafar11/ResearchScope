import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ResearchResults} from './ResearchResults';
import {ResearchInputForm} from './ResearchInputForm';
import {priceRanges,requestEstimate,toolKeys} from '../lib/researchTools';
import type {ResearchRun,ResearchRow,ResearchTool} from '../types/research';
import type {Report} from '../types/analysis';
import fixture from '../fixtures/report.json';
beforeEach(()=>{const store=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v)})});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
const row=(id:string,meta:ResearchRow['meta']={}):ResearchRow=>({id,title:id,url:'https://example.org/'+id,detail:'Evidence excerpt',meta,tags:[],image:null});
const run=(tool:ResearchTool,rows:ResearchRow[]):ResearchRun=>({id:'run',tool,status:'complete',created_at:'2026-10-06',data_mode:'fixture',input:{tool},planned_requests:1,completed_requests:1,sample_notice:'Synthetic',batches:[{label:'First',status:'complete',message:'',rows,source_url:null}],usage:{mode:'fixture',logical_requests:{},provider_attempts:{},total_requests:1,total_provider_attempts:0,billing_note:''}});
it('offers ten tools with bounded request estimates',()=>{
 expect(toolKeys).toHaveLength(10);
 expect(requestEstimate({tool:'directions',competitor_ranks:[1,2]})).toBe(2);
 expect(requestEstimate({tool:'hotels'})).toBe(3);
 expect(requestEstimate({tool:'autocomplete'})).toBe(3);
 expect(requestEstimate({tool:'scholar'})).toBe(1);
});
it('separates price currencies, retains zero and excludes unknown values',()=>{
 const values=[row('a',{Amount:0,Currency:'INR'}),row('b',{Amount:10,Currency:'INR'}),row('c',{Amount:5,Currency:'USD'}),row('d',{Amount:99,Currency:'Unspecified $'}),row('e',{Amount:null,Currency:'INR'})];
 expect(priceRanges(values)).toEqual([{currency:'INR',count:2,min:0,max:10,median:5},{currency:'USD',count:1,min:5,max:5,median:5}]);
});
it('requires product selection before calculating a benchmark',()=>{
 render(<ResearchResults reportId="report" run={run('shopping',[row('Chair',{Amount:100,Currency:'INR','Listed price':'₹100'})])}/>);
 expect(screen.queryByText(/median 100/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByLabelText('Include Chair'));
 expect(screen.getByText(/median 100/)).toBeInTheDocument();
});
it('does not classify an unavailable route as accessible',()=>{
 const data=run('directions',[row('Route',{Minutes:24})]);
 data.batches.push({label:'Missing',status:'failed',message:'Unavailable',rows:[],source_url:null});
 render(<ResearchResults reportId="report" run={data}/>);
 expect(screen.getByText('Yes')).toBeInTheDocument();expect(screen.getByText('Unknown')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Travel-time threshold (minutes)'),{target:{value:'20'}});
 expect(screen.getByText('No')).toBeInTheDocument();
});
it('keeps a saved paper available after a later empty search',()=>{
 const view=render(<ResearchResults reportId="report" run={run('scholar',[row('Paper')])}/>);
 fireEvent.click(screen.getByLabelText('Keep on research shelf'));
 fireEvent.change(screen.getByLabelText('Your observations'),{target:{value:'Read methods before using.'}});
 fireEvent.click(screen.getByText('Save observations'));view.unmount();
 render(<ResearchResults reportId="report" run={run('scholar',[])}/>);
 expect(screen.getByRole('link',{name:'Paper'})).toBeInTheDocument();
 expect(screen.getByLabelText('Your observations')).toHaveValue('Read methods before using.');
});
it('reports shelf storage failures honestly',()=>{
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('Full')}});
 render(<ResearchResults reportId="report" run={run('images',[row('Interior')])}/>);
 fireEvent.click(screen.getByText('Save observations'));
 expect(screen.getByText('Could not save; keep this tab open.')).toBeInTheDocument();
});
it('filters flight connections without treating missing data as nonstop',()=>{
 render(<ResearchResults reportId="report" run={run('flights',[row('Direct',{Connections:0}),row('Unknown route',{Connections:null})])}/>);
 fireEvent.click(screen.getByLabelText('Nonstop itineraries only'));
 expect(screen.getByText('Direct')).toBeInTheDocument();expect(screen.queryByText('Unknown route')).not.toBeInTheDocument();
});
it('caps route selections and submits the chosen travel mode',()=>{
 const submit=vi.fn();render(<ResearchInputForm tool="directions" report={fixture as Report} busy={false} onSubmit={submit}/>);
 const boxes=screen.getAllByRole('checkbox');
 expect(boxes.filter(b=>(b as HTMLInputElement).checked)).toHaveLength(3);
 expect(boxes[3]).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Travel mode'),{target:{value:'transit'}});
 fireEvent.click(screen.getByText('Run this research'));
 expect(submit).toHaveBeenCalledWith(expect.objectContaining({travel_mode:'transit'}));
});
