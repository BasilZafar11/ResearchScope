import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {NoveltyWorkspace} from './NoveltyWorkspace';
import type {NoveltyReport} from '../types/novelty';

const {revision}=vi.hoisted(()=>({revision:vi.fn().mockResolvedValue({baseline_overlap:40,preview_overlap:35,delta:-5,claim_comparison:[{claim:'A claim about low power crop diagnosis.',previous_coverage:55,preview_coverage:48}],guidance:{},limitation:'This preview did not search for new work.'})}));
vi.mock('../api/novelty',()=>({noveltyApi:{revision}}));
afterEach(()=>{cleanup();revision.mockClear()});

const report={sample_mode:true,input:{title:'Crop diagnosis on phones',abstract:'A long abstract describing crop disease diagnosis on low power phones and a privacy preserving review workflow.',claims:['A claim about low power crop diagnosis.']},summary:{disclaimer:'Search assistance only.'},queries:[],research_guidance:{contributions:[{dimension:'method',proposal_terms:['model'],assessment:'overlap in retrieved text',evidence_matches:[]}],closest_work:[],coverage:{queries_by_engine:{},records_by_source:{scholar:1,patent:0,web:0},earliest_returned_year:2024,latest_returned_year:2024,full_texts_inspected:0,source_warnings:[],next_checks:['Inspect full texts.']},gap_hypotheses:[{claim_id:'claim-1',hypothesis:'Limited overlap',basis:'Best match 20%.',follow_up_query:'crop diagnosis baseline',status:'unverified search hypothesis'}],experiments:[{claim_id:'claim-1',question:'How would you test diagnosis?',baseline_evidence_id:null,baseline_title:'Choose a baseline',suggested_checks:['Compare on same dataset.'],limitation:'Planning prompt.'}]},claims:[{id:'claim-1',text:'A claim about low power crop diagnosis.',coverage_score:20,coverage_label:'Low',matched_terms:[],matches:[]}]} as unknown as NoveltyReport;

it('shows evidence guidance and a bounded revision comparison',async()=>{
 render(<MemoryRouter><NoveltyWorkspace report={report} id="sample"/></MemoryRouter>);
 expect(screen.getByText('What appears different?')).toBeTruthy();
 expect(screen.getByText('How far did the search reach?')).toBeTruthy();
 expect(screen.getByText('unverified search hypothesis')).toBeTruthy();
 fireEvent.click(screen.getByText('Compare this revision'));
 expect(await screen.findByText(/Overlap on the original records: 40 → 35/)).toBeTruthy();
 expect(revision).toHaveBeenCalledWith('sample',expect.objectContaining({title:'Crop diagnosis on phones'}));
});
