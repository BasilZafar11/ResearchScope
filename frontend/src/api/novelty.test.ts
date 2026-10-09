import {afterEach,expect,it,vi} from 'vitest';
import {noveltyApi} from './novelty';

afterEach(()=>vi.unstubAllGlobals());
const file=new File(['%PDF-1.4'],'study.pdf',{type:'application/pdf'});
it('uses the shared timeout and raw PDF body for document reviews',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({page_count:1})});vi.stubGlobal('fetch',fetch);
  expect(await noveltyApi.documentReview('sample',file)).toEqual({page_count:1});
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sample-report/document-review'),expect.objectContaining({method:'POST',body:file,signal:expect.any(AbortSignal)}));
  expect(new Headers(fetch.mock.calls[0][1].headers).get('Content-Type')).toBe('application/pdf');
});
it.each(['TimeoutError','AbortError'])('turns %s into a retryable timeout',async name=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('aborted',name)));
  await expect(noveltyApi.documentReview('sample',file)).rejects.toMatchObject({code:'TIMEOUT',message:expect.stringContaining('try again')});
});
it.each([new TypeError('network'),new SyntaxError('non-JSON response')])('handles unavailable and unreadable responses',async error=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(error));
  await expect(noveltyApi.documentReview('sample',file)).rejects.toMatchObject({code:'CONNECTION_FAILED'});
});
it('preserves a useful rejected-file message from the backend',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:'PDF could not be read.',code:'INVALID_PDF'}})}));
  await expect(noveltyApi.documentReview('report',file)).rejects.toMatchObject({code:'INVALID_PDF',message:'PDF could not be read.'});
});
