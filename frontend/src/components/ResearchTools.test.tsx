import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {CompetitorExplorer,filterCompetitors,topicMatches} from './CompetitorExplorer';
import {EvidenceStrength,freshness} from './EvidenceStrength';
import fixture from '../fixtures/report.json';
import type {Report} from '../types/analysis';
vi.mock('./CompetitorMap',()=>({CompetitorMap:({competitors}:{competitors:Report['competitors']})=><div data-testid="filtered-map">{competitors.map(p=>p.name).join(', ')}</div>}));
afterEach(cleanup);
it('combines rating, volume and topic filters and uses IDs for duplicate names',()=>{
 const r=structuredClone(fixture) as Report;
 const topic={...r.review_topics[0],competitors:[{data_id:r.competitors[0].data_id,competitor:r.competitors[0].name}]};
 expect(filterCompetitors(r.competitors,4,200,topic).map(p=>p.rank)).toEqual([1]);
 expect(topicMatches({...r.competitors[0],data_id:'different'},topic)).toBe(false);
 expect(filterCompetitors([{...r.competitors[0],rating:null}],4,0)).toEqual([]);
 expect(filterCompetitors([{...r.competitors[0],rating:null}],0,0)).toHaveLength(1);
});
it('keeps table and map in sync, handles no matches, and resets without changing scores',()=>{
 const r=structuredClone(fixture) as Report,original=JSON.stringify(r);
 render(<CompetitorExplorer report={r}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Minimum review count'}),{target:{value:'200'}});
 expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 6');
 expect(screen.getByTestId('filtered-map')).toHaveTextContent('Demo River Workspace');
 expect(screen.queryByText('Demo Studio Collective')).not.toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'Minimum rating'}),{target:{value:'4.5'}});
 expect(screen.getByText(/No competitors match these filters/)).toBeInTheDocument();
 expect(screen.queryByTestId('filtered-map')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));
 expect(screen.getByRole('status')).toHaveTextContent('Showing 6 of 6');
 expect(JSON.stringify(r)).toBe(original);
});
it('explains excerpt-only topic filtering for old reports',()=>{
 const r=structuredClone(fixture) as Report;
 render(<CompetitorExplorer report={r}/>);
 fireEvent.change(screen.getByRole('combobox',{name:'Complaint topic'}),{target:{value:r.review_topics[0].topic}});
 expect(screen.getByText(/older report only stores representative excerpts/)).toBeInTheDocument();
});
it('shows saved completeness, geographic limits, and missing-source improvements',()=>{
 const r=structuredClone(fixture) as Report;
 r.news=[];r.sections.news={status:'failed',count:0};r.methodology.confidence_points.news=0;
 r.sections.reviews={status:'complete',count:4};r.methodology.confidence_points.reviews=0;
 render(<EvidenceStrength report={r}/>);
 expect(screen.getByText(/Synthetic sample: dates/)).toBeInTheDocument();
 expect(screen.getByText(/at least 14 more reviews/)).toBeInTheDocument();
 expect(screen.getByText(/At least 5 more dated articles/)).toBeInTheDocument();
 expect(screen.getByText(/City wording in keywords does not restrict/)).toBeInTheDocument();
 expect(screen.getByText('0/15 confidence points')).toBeInTheDocument();
});
it('handles absent dates honestly and orders dates chronologically',()=>{
 expect(freshness([null,'nonsense'])).toBe('Observation dates unavailable');
 expect(freshness(['2026-10-03T00:00:00Z',null,'2026-09-01T00:00:00Z'])).toBe('2026-09-01 to 2026-10-03 (2/3 dated observations)');
});
