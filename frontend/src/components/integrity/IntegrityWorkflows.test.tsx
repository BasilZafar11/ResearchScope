import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {CitationSupport} from './CitationSupport';
import {ExtractionReconciliation} from './ExtractionReconciliation';
import {SensitiveDataReadiness} from './SensitiveDataReadiness';
import {ResearchIntegrityLab} from '../ResearchIntegrityLab';
import type {NoveltyReport} from '../../types/novelty';
import type {Evidence} from '../../types/novelty';

const evidence:Evidence[]=[{id:'p1',source_type:'scholar',title:'Study A',summary_text:'Example',similarity_score:40,source_url:'https://example.org/study'}];
beforeEach(()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key),clear:()=>data.clear()});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('integrity review workflows',()=>{
  it('renders all ten tools without initiating provider requests',()=>{
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    const report={papers:evidence,patents:[],web_results:[],claims:[],input:{title:'Example study'}} as unknown as NoveltyReport;
    render(<ResearchIntegrityLab report={report} id="one"/>);
    expect(document.querySelectorAll('.integrity-feature')).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('requires a passage and reviewer reason, then persists citation reviews by report',()=>{
    const view=render(<CitationSupport evidence={evidence} id="one"/>);
    fireEvent.change(screen.getByLabelText('Draft sentence'),{target:{value:'The treatment helps.'}});
    fireEvent.change(screen.getByLabelText('Source'),{target:{value:'p1'}});
    fireEvent.click(screen.getByText('Save citation review'));
    expect(screen.getByRole('alert')).toHaveTextContent('source passage');
    fireEvent.change(screen.getByLabelText('Exact cited passage'),{target:{value:'The treatment was associated with benefit.'}});
    fireEvent.change(screen.getByLabelText('Verdict reason'),{target:{value:'Association only; causal wording needs revision.'}});
    fireEvent.click(screen.getByText('Save citation review'));
    view.unmount();render(<CitationSupport evidence={evidence} id="one"/>);
    expect(screen.getByText('Association only; causal wording needs revision.')).toBeInTheDocument();
    cleanup();render(<CitationSupport evidence={evidence} id="two"/>);
    expect(screen.queryByText('Association only; causal wording needs revision.')).not.toBeInTheDocument();
  });
  it('keeps two independent extractions and rejects the same reviewer',()=>{
    render(<ExtractionReconciliation evidence={evidence} id="one"/>);
    fireEvent.change(screen.getByLabelText('Source'),{target:{value:'p1'}});
    fireEvent.change(screen.getByLabelText('reviewer'),{target:{value:'Alice'}});
    fireEvent.change(screen.getByLabelText('finding'),{target:{value:'Benefit observed'}});
    fireEvent.change(screen.getByLabelText('Supporting passage'),{target:{value:'Group A improved'}});
    fireEvent.click(screen.getByText('Submit first extraction'));
    expect(screen.queryByText('Benefit observed')).not.toBeInTheDocument();
    const stored=JSON.parse(localStorage.getItem('research-integrity-one-extractions')!);
    fireEvent.change(screen.getByLabelText('Extraction stage'),{target:{value:stored[0].id}});
    fireEvent.change(screen.getByLabelText('reviewer'),{target:{value:'alice'}});
    fireEvent.change(screen.getByLabelText('finding'),{target:{value:'Unclear benefit'}});
    fireEvent.change(screen.getByLabelText('Supporting passage'),{target:{value:'No clear difference'}});
    fireEvent.click(screen.getByText('Submit second extraction'));
    expect(screen.getByRole('alert')).toHaveTextContent('different reviewer');
    fireEvent.change(screen.getByLabelText('reviewer'),{target:{value:'Bob'}});
    fireEvent.click(screen.getByText('Submit second extraction'));
    expect(screen.getByText('Benefit observed')).toBeInTheDocument();
    expect(screen.getByText('Unclear benefit')).toBeInTheDocument();
  });
  it('prevents an unsupported approval conclusion',()=>{
    render(<SensitiveDataReadiness id="one"/>);
    fireEvent.change(screen.getByLabelText('Dataset name'),{target:{value:'Dataset A'}});
    fireEvent.change(screen.getByLabelText('Intended research use'),{target:{value:'Model evaluation'}});
    fireEvent.change(screen.getByLabelText('Institutional approval status'),{target:{value:'approved'}});
    fireEvent.click(screen.getByText('Save readiness assessment'));
    expect(screen.getByRole('alert')).toHaveTextContent('reference or reason');
    expect(localStorage.getItem('research-integrity-one-data-readiness')).toBeNull();
  });
});
