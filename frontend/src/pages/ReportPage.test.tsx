import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {ReportPage} from './ReportPage';

vi.mock('../api/novelty',()=>({noveltyApi:{sample:vi.fn().mockResolvedValue({id:'sample',status:'complete',sample_mode:true,input:{title:'Privacy preserving crop research',field:'Agriculture',keywords:['crop disease'],claims:[]},queries:[{engine:'google_scholar',query:'SYNTHETIC DEMO QUERY',timestamp:'2026-10-06T00:00:00Z'}],overlap_score:24,novelty_signal:76,confidence_score:21,confidence_label:'Low',interpretation:'Limited overlap found in searched sources',credential_mode:'sample',ai_analysis:{status:'not_configured',executive_summary:'Fictional sample evidence only.',warnings:[]},summary:{strongest_overlaps:[],least_covered_claims:[],disclaimer:'Search assistance only.'},claims:[],papers:[],patents:[],web_results:[],timeline:[],assignee_summary:[],warnings:['All evidence is fictional.'],methodology_version:'1.0',created_at:'2026-10-06T00:00:00Z'})}}));
afterEach(cleanup);
it('labels the sample as fictional and renders transparent scoring sections',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/reports/sample']}><Routes><Route path="/reports/:id" element={<ReportPage/>}/></Routes></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText('Illustrative sample')).toBeTruthy();
 expect(screen.getByText(/evidence is fictional and demonstrates/)).toBeTruthy();
 expect(screen.queryByText('SYNTHETIC DEMO QUERY')).toBeNull();
 expect(screen.getByRole('heading',{name:'Overview'})).toBeTruthy();
 fireEvent.click(screen.getByRole('link',{name:'Record'}));
 expect(screen.getByText(/Search-based novelty signal:/)).toBeTruthy();
 expect(screen.getByText('Searches and scoring')).toBeTruthy();
 expect(screen.getByText('SYNTHETIC DEMO QUERY')).toBeTruthy();
});
