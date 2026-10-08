import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ResearchLandingPage} from './ResearchLandingPage';
vi.mock('../api/novelty',()=>({noveltyApi:{status:vi.fn().mockResolvedValue({hosted_mode:'unavailable'})}}));
afterEach(cleanup);
it('offers a sample when search is disabled and makes the claim example interactive',async()=>{render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ResearchLandingPage/></MemoryRouter></QueryClientProvider>);expect(await screen.findByText(/Live search is currently unavailable/)).toBeTruthy();expect(screen.getAllByRole('link',{name:'View sample report'})[0]).toHaveAttribute('href','/research-scope/reports/sample');fireEvent.click(screen.getByLabelText('Refer uncertain predictions for expert review.'));expect(screen.getByText('Does referral improve the outcome for farmers?')).toBeTruthy();});
