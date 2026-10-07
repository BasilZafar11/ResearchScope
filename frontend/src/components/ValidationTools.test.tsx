import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {openingState,parseHours,days,searchEstimate,defaultOptions,suggestBrands} from '../lib/marketTools';
import {HoursGaps,BrandCompetition,ReputationChanges} from './CompetitionTools';
import {SearchPlanner} from './SearchPlanner';
import {RelevanceReview} from './RelevanceReview';
import {api} from '../api/client';
import type {Report} from '../types/analysis';
import fixture from '../fixtures/report.json';
const report=fixture as Report;
beforeEach(()=>{const store=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v)})});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
it('handles overnight, split shifts, 24h and unknown weekly schedules',()=>{
 const h=Object.fromEntries(days.map(d=>[d,'Closed']));h.friday='9 AM–2 AM';h.saturday='10 AM–12 PM, 2 PM–6 PM';
 expect(openingState(h,5,60)).toBe('Open');
 expect(openingState(h,5,120)).toBe('Closed');
 expect(openingState(h,5,13*60)).toBe('Closed');
 expect(openingState(h,5,15*60)).toBe('Open');
 expect(openingState(undefined,5,15*60)).toBe('Unknown');
 expect(parseHours('Open 24 hours')).toEqual([[0,1440]]);
 expect(parseHours('9–5 PM')).toBeNull();
 expect(parseHours('9:99 AM–6 PM')).toBeNull();
 expect(parseHours('09:00–18:00')).toEqual([[540,1080]]);
});
it('shows unknown rather than treating missing hours as closed',()=>{
 render(<HoursGaps report={report}/>);
 expect(screen.getByText('0 open · 0 closed · 6 unknown')).toBeInTheDocument();
});
it('estimates bounded optional requests and toggles planner selection',()=>{
 expect(searchEstimate(defaultOptions)).toEqual({minimum:5,maximum:17,retryMaximum:51});
 const onChange=vi.fn();render(<SearchPlanner options={defaultOptions} onChange={onChange}/>);
 fireEvent.click(screen.getByRole('checkbox',{name:/Additional review history/}));
 expect(onChange).toHaveBeenCalledWith({...defaultOptions,reputation:false});
});
it('suggests groups without declaring ownership and persists manual corrections',()=>{
 const r={...report,competitors:[{...report.competitors[0],name:'Acme - East'},{...report.competitors[1],name:'Acme - West'}]};
 expect(Object.values(suggestBrands(r.competitors,[])).map(v=>v.group)).toEqual(['Acme','Acme']);
 const view=render(<BrandCompetition report={r}/>);
 expect(screen.getByText(/0 marked chain · 0 marked independent · 2 unverified/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Classification for Acme - East'),{target:{value:'chain'}});
 fireEvent.change(screen.getByLabelText('Brand for Acme - East'),{target:{value:'Corrected group'}});
 fireEvent.click(screen.getByText('Save brand corrections'));view.unmount();
 render(<BrandCompetition report={r}/>);
 expect(screen.getByLabelText('Brand for Acme - East')).toHaveValue('Corrected group');
 expect(screen.getByLabelText('Classification for Acme - East')).toHaveValue('chain');
});
it('handles old reports lacking review-history data',()=>{
 render(<ReputationChanges report={report}/>);
 expect(screen.getByText(/No review-history comparison/)).toBeInTheDocument();
});
it('submits selected exclusions and reason without running a new analysis',async()=>{
 const revised=vi.spyOn(api,'revise').mockResolvedValue({id:'new',report_url:'/reports/new'});
 const create=vi.spyOn(api,'create');
 render(<MemoryRouter><RelevanceReview report={report}/></MemoryRouter>);
 expect(screen.getByRole('button',{name:/Save revised report/})).toBeDisabled();
 fireEvent.click(screen.getByLabelText('Exclude '+report.competitors[0].name,{exact:false}));
 fireEvent.click(screen.getByRole('button',{name:/Save revised report/}));
 expect(revised).toHaveBeenCalledWith(report.id,{competitor_ranks:[1],news_indices:[],reason:'Outside the requested category or target market'});
 expect(create).not.toHaveBeenCalled();
});
