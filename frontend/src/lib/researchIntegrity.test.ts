import {describe,expect,it} from 'vitest';
import {citationDiagnostics,normalQuantile,safeHttp,sampleRequirement} from './researchIntegrity';

describe('sample planning',()=>{
  const input={mode:'two means' as const,effect:.5,sd:1,alpha:.05,power:.8,attrition:0,margin:.05,proportion:.5};
  it('matches standard equal-group normal approximation and labels group totals',()=>{
    expect(normalQuantile(.975)).toBeCloseTo(1.9599639845,7);
    expect(normalQuantile(.025)).toBeCloseTo(-1.9599639845,7);
    expect(sampleRequirement(input)).toEqual({analyzed:63,recruited:63,total:126});
  });
  it('uses variance of paired differences and inflates recruitment for attrition',()=>{
    expect(sampleRequirement({...input,mode:'paired mean',attrition:.2})).toEqual({analyzed:32,recruited:40,total:40});
  });
  it('matches worst-case proportion precision estimate',()=>{
    expect(sampleRequirement({...input,mode:'proportion precision'}).analyzed).toBe(385);
  });
  it('rejects invalid assumptions instead of displaying a finite target',()=>{
    expect(()=>sampleRequirement({...input,effect:0})).toThrow();
    expect(()=>sampleRequirement({...input,attrition:1})).toThrow();
    expect(()=>sampleRequirement({...input,sd:NaN})).toThrow();
    expect(()=>sampleRequirement({...input,mode:'proportion precision',margin:0})).toThrow();
  });
});
describe('citation diagnostics',()=>{
  it('flags an unsupported number and broad causal wording without issuing an entailment verdict',()=>{
    const result=citationDiagnostics('Treatment causes improvement in all patients by 42%.','Treatment was associated with improvement in some patients by 24%.');
    expect(result.missingNumbers).toEqual(['42%']);expect(result.broad).toEqual(['causes','all']);expect(result).not.toHaveProperty('verdict');
  });
  it('rejects active-content and malformed source URLs',()=>{
    expect(safeHttp('javascript:alert(1)')).toBe('');expect(safeHttp('not a URL')).toBe('');expect(safeHttp('https://example.org/paper')).toBe('https://example.org/paper');
  });
});
