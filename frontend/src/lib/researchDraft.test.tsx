import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {renderHook,act,cleanup} from '@testing-library/react';
import {useResearchDraft} from './researchDraft';
beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),clear:()=>data.clear()});});
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
describe('research drafts',()=>{
 it('restores unfinished inputs without changing legacy records or credentials',()=>{localStorage.setItem('novelty-owner-report','secret');localStorage.setItem('novelty-tools-report-journal','[]');const first=renderHook(()=>useResearchDraft('report','notes',{text:''}));act(()=>first.result.current[1]({text:'Unfinished contribution'}));first.unmount();const second=renderHook(()=>useResearchDraft('report','notes',{text:''}));expect(second.result.current[0].text).toBe('Unfinished contribution');expect(localStorage.getItem('novelty-owner-report')).toBe('secret');expect(localStorage.getItem('novelty-tools-report-journal')).toBe('[]');});
 it('retains work in memory when storage is unavailable',()=>{vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw new Error('quota');});const hook=renderHook(()=>useResearchDraft('report','text',''));act(()=>hook.result.current[1]('Keep this work'));expect(hook.result.current[0]).toBe('Keep this work');});
 it('rejects malformed stored draft shapes',()=>{localStorage.setItem('researchscope-draft-v1:report:form','{"title":42}');const hook=renderHook(()=>useResearchDraft('report','form',{title:''}));expect(hook.result.current[0]).toEqual({title:''});});
});
