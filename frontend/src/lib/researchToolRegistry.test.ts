import {describe,it,expect} from 'vitest';
import {researchTools,reportViews,reportView} from './researchToolRegistry';
describe('research tool destinations',()=>{
 it('accounts for all fifty tools exactly once',()=>{expect(researchTools).toHaveLength(50);expect(new Set(researchTools.map(tool=>tool.id)).size).toBe(50);for(const tool of researchTools)expect(reportViews).toContain(tool.view);expect(researchTools.filter(tool=>tool.group==='toolkit')).toHaveLength(20);expect(researchTools.filter(tool=>tool.group==='defense')).toHaveLength(20);expect(researchTools.filter(tool=>tool.group==='integrity')).toHaveLength(10);});
 it('falls back to overview for unknown sections',()=>{expect(reportView('unknown')).toBe('overview');expect(reportView(null)).toBe('overview');});
});
