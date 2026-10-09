import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ResearchProjectTransfer} from './ResearchProjectTransfer';
import {NoveltyWorkspace} from './NoveltyWorkspace';
import {noveltyApi} from '../api/novelty';
import type {NoveltyReport} from '../types/novelty';

vi.mock('../api/novelty',()=>({noveltyApi:{documentReview:vi.fn()}}));
const report={sample_mode:true,input:{title:'Study',abstract:'A study',claims:[]},claims:[],queries:[],summary:{disclaimer:'Sample'}} as unknown as NoveltyReport;
beforeEach(()=>{const stored=new Map<string,string>();vi.stubGlobal('localStorage',{get length(){return stored.size;},key:(index:number)=>[...stored.keys()][index]??null,getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('rejects the original malformed queue import during inspection',async()=>{
  localStorage.setItem('novelty-tools-import-check-queue','["keep"]');
  render(<ResearchProjectTransfer id="import-check" report={report}/>);
  const file={size:250,text:async()=>JSON.stringify({format:'researchscope-project-v1',reportId:'import-check',title:'Malformed queue',exportedAt:'2026-10-09T00:00:00Z',records:{'tools:queue':{unexpected:'object instead of array'}}})};
  fireEvent.change(screen.getByLabelText('Inspect an exported project'),{target:{files:[file]}});
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid research records');
  expect(screen.queryByRole('button',{name:'Apply imported records'})).toBeNull();
  expect(localStorage.getItem('novelty-tools-import-check-queue')).toBe('["keep"]');
});
it('releases the PDF control after failure and allows a successful retry',async()=>{
  vi.mocked(noveltyApi.documentReview).mockRejectedValueOnce(new Error('The backend took too long to respond. Try again.')).mockResolvedValueOnce({page_count:1,pages_checked:1,limitation:'Text only',claims:[]});
  render(<MemoryRouter><NoveltyWorkspace id="pdf-check" report={report} view="evidence"/></MemoryRouter>);
  const input=screen.getByLabelText('Choose PDF');const file=new File(['%PDF-1.4'],'study.pdf',{type:'application/pdf'});
  fireEvent.change(input,{target:{files:[file]}});
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  await waitFor(()=>expect(input).toBeEnabled());
  fireEvent.change(input,{target:{files:[file]}});
  expect(await screen.findByText(/1 of 1 pages checked/)).toBeTruthy();
  expect(input).toBeEnabled();
});
it('rejects an object timestamp before displaying an import preview',async()=>{
  render(<ResearchProjectTransfer id="bad-timestamp" report={report}/>);
  const file={size:200,text:async()=>JSON.stringify({format:'researchscope-project-v1',reportId:'bad-timestamp',title:'Study',exportedAt:{bad:true},records:{'tools:queue':[]}})};
  fireEvent.change(screen.getByLabelText('Inspect an exported project'),{target:{files:[file]}});
  expect(await screen.findByRole('alert')).toHaveTextContent('timestamp is invalid');
  expect(screen.queryByRole('button',{name:'Apply imported records'})).toBeNull();
});
