import {MemoryRouter} from 'react-router-dom';
import {render as testingRender,screen,cleanup} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const render=(ui:React.ReactNode)=>testingRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
import {afterEach,describe,it,expect,vi} from 'vitest';
import {ReportView} from './ReportView';
import {inputSchema,example} from './AnalysisForm';
import fixture from '../fixtures/report.json';
import type {Report} from '../types/analysis';
vi.mock('./CompetitorMap',()=>({CompetitorMap:()=> <div>Competitor map</div>}));
vi.mock('./DemandChart',()=>({DemandChart:()=> <div>Demand chart</div>}));
vi.mock('./ServiceAreaMap',()=>({default:()=> <div>Service area map</div>}));
afterEach(cleanup);
describe('report',()=>{
 it('renders a complete report with evidence and methodology',()=>{render(<MemoryRouter><ReportView report={fixture as Report}/></MemoryRouter>);expect(screen.getByText('Sample report')).toBeInTheDocument();expect(screen.getByText('The competitive landscape')).toBeInTheDocument();expect(screen.getByText('Evidence register')).toBeInTheDocument();expect(screen.getByText('Methodology & limitations')).toBeInTheDocument();expect(screen.getAllByText('Demo River Workspace').length).toBeGreaterThan(0)});
 it('renders optional engine failures and honest empty states',()=>{const r=structuredClone(fixture) as Report;r.news=[];r.advertising=[];r.review_topics=[];r.sections.news={status:'failed',count:0};r.warnings=['News: unavailable'];render(<MemoryRouter><ReportView report={r}/></MemoryRouter>);expect(screen.getByText('News: unavailable')).toBeInTheDocument();expect(screen.getByText('Market news is unavailable. Momentum uses a neutral score.')).toBeInTheDocument();expect(screen.getByText(/No reliable active advertiser match is available/)).toBeInTheDocument()});
 it('validates the demo and rejects missing, repeated or too many keywords',()=>{expect(inputSchema.safeParse({...example,refresh:false}).success).toBe(true);for(const keywords of [[],['aa','AA'],['a','b','c','d','e','f']])expect(inputSchema.safeParse({...example,keywords,refresh:false}).success).toBe(false)});
});
