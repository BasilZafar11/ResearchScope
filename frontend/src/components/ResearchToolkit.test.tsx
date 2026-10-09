import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ResearchToolkit} from './ResearchToolkit';
import {RecordRecoveryNotice} from './research/RecordRecoveryNotice';
import type {NoveltyReport} from '../types/novelty';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens toolkit pages with a corrupt legacy queue and exposes the original for recovery',()=>{
  const stored=new Map<string,string>();vi.stubGlobal('localStorage',{get length(){return stored.size;},key:(index:number)=>[...stored.keys()][index]??null,getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
  localStorage.setItem('novelty-tools-sample-queue','{"unexpected":"object instead of array"}');
  const report={input:{title:'Study',field:'Agriculture',keywords:['crop'],claims:[]},papers:[],patents:[],web_results:[],claims:[]} as unknown as NoveltyReport;
  render(<MemoryRouter><RecordRecoveryNotice id="sample"/><ResearchToolkit id="sample" report={report} tool={8}/></MemoryRouter>);
  expect(screen.getByText('08 · Assess study quality')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Download original records'})).toBeTruthy();
  expect(localStorage.getItem('novelty-tools-sample-queue')).toBe('{"unexpected":"object instead of array"}');
});
