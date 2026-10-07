import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ComparisonTable,CompareReportsPage} from './CompareReportsPage';
import {api} from '../api/client';
import fixture from '../fixtures/report.json';
import type {Report} from '../types/analysis';
afterEach(()=>{cleanup();vi.restoreAllMocks()});
it('compares original scores and clearly flags incompatible evidence',()=>{
 const a=structuredClone(fixture) as Report,b=structuredClone(fixture) as Report;
 b.id='second';b.input.city='Mumbai';b.data_mode='live';b.methodology_version='2.0';b.overall_score=72;
 render(<MemoryRouter><ComparisonTable reports={[a,b]}/></MemoryRouter>);
 expect(screen.getByText('72/100')).toBeInTheDocument();
 expect(screen.getByText(/Their scores are not directly comparable/)).toBeInTheDocument();
 expect(screen.getByText(/different methodology versions/)).toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Mumbai/})).toHaveAttribute('href','/reports/second');
});
function mount(url:string){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[url]}><CompareReportsPage/></MemoryRouter></QueryClientProvider>)}
it('loads selected snapshots without creating analyses',async()=>{
 vi.spyOn(api,'recent').mockResolvedValue([]);
 const create=vi.spyOn(api,'create');
 vi.spyOn(api,'get').mockImplementation(async id=>({...fixture,id}) as Report);
 mount('/compare?left=first&right=second');
 expect(await screen.findByRole('table')).toBeInTheDocument();
 expect(api.get).toHaveBeenCalledWith('first');expect(api.get).toHaveBeenCalledWith('second');expect(create).not.toHaveBeenCalled();
});
it('rejects comparing a report with itself and handles failed loads',async()=>{
 vi.spyOn(api,'recent').mockResolvedValue([]);
 vi.spyOn(api,'get').mockRejectedValue(new Error('Unavailable'));
 mount('/compare?left=first&right=first');
 expect(screen.getByRole('alert')).toHaveTextContent('Choose two different reports');
});
it('shows an actionable error for a missing saved report',async()=>{
 vi.spyOn(api,'recent').mockResolvedValue([]);
 vi.spyOn(api,'get').mockRejectedValue(new Error('Not found'));
 mount('/compare?left=first&right=second');
 expect(await screen.findByRole('alert')).toHaveTextContent('A selected report could not be loaded');
});
