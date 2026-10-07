import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ScoringPriorities,weightedScore} from './ScoringPriorities';
import fixture from '../fixtures/report.json';
import type {Report} from '../types/analysis';
afterEach(cleanup);
it('normalizes custom weights and handles all-zero priorities',()=>{
 const scores={demand:80,competition_gap:20,unmet_need:50,market_momentum:50,advertising_gap:50};
 expect(weightedScore(scores,{demand:3,competition_gap:1,unmet_need:0,market_momentum:0,advertising_gap:0})).toBe(65);
 expect(weightedScore(scores,{demand:0,competition_gap:0,unmet_need:0,market_momentum:0,advertising_gap:0})).toBeNull();
});
it('updates, resets, and never mutates the saved report',()=>{
 const report=structuredClone(fixture) as Report;const original=JSON.stringify(report);
 render(<ScoringPriorities report={report}/>);
 for(const slider of screen.getAllByRole('slider'))fireEvent.change(slider,{target:{value:'0'}});
 expect(screen.getByRole('alert')).toHaveTextContent('Set at least one priority');
 fireEvent.change(screen.getByRole('slider',{name:'Demand priority'}),{target:{value:'100'}});
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.getByText('100 priority points · 100.0% effective weight')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reset weights'}));
 expect(screen.getByRole('slider',{name:'Demand priority'})).toHaveValue('25');
 expect(JSON.stringify(report)).toBe(original);
});
