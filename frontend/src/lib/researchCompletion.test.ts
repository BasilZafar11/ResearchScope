import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {applyProjectRecords,collectProjectRecords,validateProjectRecords,parseStoredRecord,writeStoredRecord,recoverableRecords} from './projectRecords';
import {nearTextFindings,temporalFindings} from './datasetAudit';
import {normalizedCondition,dependencyProblem} from './researchReview';
import {readSearchHistory} from '../components/SearchStoppingAssistant';
import {parseCsv} from '../components/DatasetLeakageAudit';

beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{get length(){return data.size;},key:(i:number)=>[...data.keys()][i]??null,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)});});
afterEach(()=>vi.unstubAllGlobals());
describe('research record transfer',()=>{
  it.each([
    {'tools:queue':{}},{'tools:queue':[3]},{'tools:quality':{paper:'yes'}},
    {'tools:journal':[{id:'one',text:[],created_at:'today'}]},
    {'tools:screening':{paper:{state:[]}}},
    {'defense:tasks':[{dependsOn:{bad:true}}]},
    {'defense:measurements':{claim:[{outcome:42}]}},
    {'defense:evidence-snapshots':[{}]},
    {'defense:venue-criteria':{criteria:[{}]}},
    {'integrity:retrieval':[{items:'wrong'}]},
    {'tools:unknown':[]},
  ])('rejects malformed records before replacing any stored work: %j',records=>{
    localStorage.setItem('novelty-tools-one-queue','["original"]');
    expect(()=>applyProjectRecords('one',records)).toThrow();
    expect(localStorage.getItem('novelty-tools-one-queue')).toBe('["original"]');
  });
  it('retains supported legacy tasks, measurements and manually counted rounds',()=>{
    expect(()=>validateProjectRecords({'defense:tasks':[{id:'old',data:{title:'Review',dependsOn:[]}}],'defense:measurements':{claim:{outcome:'Accuracy'}},'defense:rounds':[{title:'Search',data:{new_records:3}}]})).not.toThrow();
  });
  it('accepts valid access metadata and rejects unrecognized form options',()=>{
    const access={'integrity:access-paper':{doi:'10.1234/study',work:{title:'Study'},candidates:[],failures:[],checked_at:'today',coverage:'Metadata only'}};
    expect(()=>validateProjectRecords(access)).not.toThrow();
    expect(()=>validateProjectRecords({'integrity:power':{mode:'invalid',effect:1,sd:1,alpha:0.05,power:0.8,attrition:0,margin:1,proportion:0.5,rationale:''}})).toThrow();
  });
  it('preserves corrupt browser bytes even when saving a replacement',()=>{
    const key='novelty-tools-one-queue';localStorage.setItem(key,'{"unexpected":true}');
    expect(()=>parseStoredRecord(key)).toThrow();
    writeStoredRecord(key,'[]');
    expect(parseStoredRecord(key)).toEqual([]);
    expect(recoverableRecords('one')[key]).toBe('{"unexpected":true}');
    expect(recoverableRecords('two')).toEqual({});
  });
  it('keeps malformed JSON available for recovery',()=>{
    const key='novelty-defense-one-tasks';localStorage.setItem(key,'{unfinished');
    expect(recoverableRecords('one')[key]).toBe('{unfinished');
    expect(localStorage.getItem(key)).toBe('{unfinished');
  });
  it('does not prevent a report from opening when browser storage is blocked',()=>{
    vi.stubGlobal('localStorage',{get length(){throw new DOMException('Blocked','SecurityError');}});
    expect(recoverableRecords('one')).toEqual({});
  });
  it('exports only the chosen project and excludes credentials and other projects',()=>{
    localStorage.setItem('novelty-defense-one-tasks','[]');localStorage.setItem('novelty-owner-one','private');localStorage.setItem('novelty-defense-two-tasks','[]');localStorage.setItem('novelty-shared-failures','[]');
    expect(collectProjectRecords('one')).toEqual({'defense:tasks':[]});
    expect(collectProjectRecords('one',true)).toHaveProperty('tools:failure-notebook');
  });
  it('rejects active-content URLs and unsafe namespaces',()=>{
    expect(()=>validateProjectRecords({'integrity:citations':[{sourceUrl:'javascript:alert(1)'}]})).toThrow();
    expect(()=>validateProjectRecords({'owner-token':'private'})).toThrow();
    expect(()=>validateProjectRecords(JSON.parse('{"defense:tasks":{"__proto__":{}}}'))).toThrow();
  });
  it('remaps namespaces to the current report without changing capability keys',()=>{
    localStorage.setItem('novelty-owner-one','private');applyProjectRecords('one',{'defense:tasks':[{'title':'Review'}]});
    expect(JSON.parse(localStorage.getItem('novelty-defense-one-tasks')!)).toEqual([{title:'Review'}]);expect(localStorage.getItem('novelty-owner-one')).toBe('private');
  });
});
describe('research audits',()=>{
  it('distinguishes strict temporal equality from permitted ties and preserves original row references',()=>{
    const rows=[['train','2024-01-01'],['test','2024-01-01'],['test','unknown']];
    const strict=temporalFindings(rows,0,1,'train','','test',true);
    expect(strict.find(x=>x.kind==='temporal ordering violation')?.rows).toEqual([2,3]);
    expect(strict.find(x=>x.kind==='timestamp unknown or invalid')?.rows).toEqual([4]);
    expect(temporalFindings(rows,0,1,'train','','test',false)).toHaveLength(1);
  });
  it('reports text candidates only across splits and rejects malformed CSV field counts',()=>{
    expect(nearTextFindings([['train','A repeated passage about plant disease diagnosis'],['test','A repeated passage about plant disease diagnosis']],0,1,new Set(['train','test']))).toHaveLength(1);
    expect(()=>parseCsv('sample,split\nonly-one-field')).toThrow('same number');
  });
  it('normalizes equivalent time units without equating CPU and GPU time',()=>{
    expect(normalizedCondition('2 GPU hours','compute budget')).toBe(normalizedCondition('120 gpu minutes','compute budget'));
    expect(normalizedCondition('2 CPU hours','compute budget')).not.toBe(normalizedCondition('2 GPU hours','compute budget'));
  });
  it('detects transitive cycles and missing task dependencies',()=>{
    const tasks=[{id:'a',dependsOn:['b'],status:'open'},{id:'b',dependsOn:[],status:'open'}];
    expect(dependencyProblem(tasks,'b',['a'])).toContain('cycle');expect(dependencyProblem(tasks,'a',['missing'])).toContain('no longer exists');
  });
  it('preserves original array-based search history as manual estimates',()=>{
    localStorage.setItem('old',JSON.stringify([{id:'old-1',title:'Legacy query',data:{new_records:3}}]));
    expect(readSearchHistory('old').rounds[0]).toMatchObject({query:'Legacy query',legacyCount:3,identifiers:[]});
  });
});
