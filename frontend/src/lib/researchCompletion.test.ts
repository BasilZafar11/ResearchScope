import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {applyProjectRecords,collectProjectRecords,validateProjectRecords} from './projectRecords';
import {nearTextFindings,temporalFindings} from './datasetAudit';
import {normalizedCondition,dependencyProblem} from './researchReview';
import {readSearchHistory} from '../components/SearchStoppingAssistant';
import {parseCsv} from '../components/DatasetLeakageAudit';

beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{get length(){return data.size;},key:(i:number)=>[...data.keys()][i]??null,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)});});
afterEach(()=>vi.unstubAllGlobals());
describe('research record transfer',()=>{
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
