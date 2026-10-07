import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {HomePage} from './HomePage';

vi.mock('../api/novelty',()=>({noveltyApi:{status:vi.fn().mockResolvedValue({hosted_mode:'unavailable',sample_mode:true,groq_mode:'unavailable',message:'Sample mode available'}),create:vi.fn()}}));
afterEach(cleanup);
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter><HomePage/></MemoryRouter></QueryClientProvider>)}

describe('NoveltyMap home',()=>{
 it('shows structured idea fields and sample access when hosted search is unavailable',async()=>{
  mount();
  expect(await screen.findByText(/Hosted search is not configured/)).toBeTruthy();
  expect(screen.getByLabelText(/^Abstract/)).toBeTruthy();
  expect(screen.getByLabelText(/^Key claims/)).toBeTruthy();
  expect(screen.getByRole('link',{name:/Open the prepared sample/})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Search papers and patents'}).hasAttribute('disabled')).toBe(true);
 });
});
