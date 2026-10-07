import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {BreakEven,breakEven} from './BreakEven';
import {monthlyInterest,ReviewMatrix,KeywordFinder,Seasonality} from './MarketResearch';
import {ResearchNotebook} from './ResearchNotebook';
import type {Report} from '../types/analysis';
import fixture from '../fixtures/report.json';
const report=fixture as Report;
beforeEach(()=>{
 const data=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),clear:()=>data.clear()});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
it('computes break-even and catches impossible, invalid, and zero-fixed-cost scenarios',()=>{
 expect(breakEven(1000,500,100,25,30)?.customers).toBe(20);
 expect(breakEven(1000,500,100,25,30)?.occupancy).toBeCloseTo(100*20/30);
 expect(breakEven(100,0,10,10,20)?.customers).toBeNull();
 expect(breakEven(0,0,10,0,20)?.customers).toBe(0);
 expect(breakEven(-1,0,10,0,20)).toBeNull();
 expect(breakEven(1,0,10,0,0)).toBeNull();
 expect(breakEven(Infinity,0,10,0,20)).toBeNull();
});
it('updates calculator interactively and warns above capacity',()=>{
 render(<BreakEven/>);
 for(const [label,value] of [['Monthly rent','1000'],['Other monthly fixed costs','500'],['Monthly price per customer','100'],['Monthly variable cost per customer','25'],['Maximum customers per month','10']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 expect(screen.getByText('20 customers to break even')).toBeInTheDocument();
 expect(screen.getByText(/exceeds your entered capacity/)).toBeInTheDocument();
 fireEvent.click(screen.getByText('Reset assumptions'));
 expect(screen.getByText(/Fill in all five/)).toBeInTheDocument();
});
it('averages years equally and retains zeros, ignoring invalid dates and values',()=>{
 const point=(date:string,value:number)=>({date,values:{test:value}});
 const result=monthlyInterest([point('2024-01-01',0),point('2024-01-15',20),point('2025-01-01',50),point('garbage',80),point('2025-02-01',NaN)],'test');
 expect(result[0]).toEqual({mean:30,years:2,points:3});
 expect(result[1].mean).toBeNull();
});
it('old reports show honest empty states for new data',()=>{
 render(<><ReviewMatrix report={report}/><KeywordFinder report={report}/><Seasonality report={report}/></>);
 expect(screen.getByText(/Review comparison data is unavailable/)).toBeInTheDocument();
 expect(screen.getByText(/No matching related queries/)).toBeInTheDocument();
 expect(screen.getByText(/No longer-term history/)).toBeInTheDocument();
});
it('filters queries and exposes review evidence',()=>{
 render(<><KeywordFinder report={{...report,related_queries:[{query:'day pass',kind:'top',value:'100'},{query:'weekend',kind:'rising',value:'Breakout'}]}}/><ReviewMatrix report={{...report,review_matrix:[{competitor:'Example',data_id:'x',sample_size:1,topics:{Service:{positive:[{competitor:'Example',rating:5,text:'Helpful staff',published_at:null,source_url:'https://example.com/review'}],negative:[]}}}]}}/></>);
 fireEvent.change(screen.getByLabelText('Show queries'),{target:{value:'rising'}});
 expect(screen.queryByText('day pass')).not.toBeInTheDocument();
 expect(screen.getByText('Breakout')).toBeInTheDocument();
 expect(screen.getByText('Helpful staff')).toBeInTheDocument();
});
it('persists notes and competitor bookmarks, isolates reports, handles blocked storage',()=>{
 const view=render(<ResearchNotebook report={report}/>);
 fireEvent.change(screen.getByLabelText('Research notes'),{target:{value:'Visit on Friday'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Shortlist '+report.competitors[0].name}));
 fireEvent.click(screen.getByText('Save notebook'));view.unmount();
 const again=render(<ResearchNotebook report={report}/>);
 expect(screen.getByLabelText('Research notes')).toHaveValue('Visit on Friday');
 expect(screen.getByRole('checkbox',{name:'Shortlist '+report.competitors[0].name})).toBeChecked();again.unmount();
 render(<ResearchNotebook report={{...report,id:'other'}}/>);
 expect(screen.getByLabelText('Research notes')).toHaveValue('');
 vi.spyOn(window.localStorage,'setItem').mockImplementation(()=>{throw Error('blocked')});
 fireEvent.click(screen.getByText('Save notebook'));
 expect(screen.getByRole('status')).toHaveTextContent('Storage is unavailable');
});
