import {describe,it,expect} from 'vitest';
import {publicReportUrl} from './CopyLink';
describe('public report link',()=>{it('excludes all capability tokens and local navigation',()=>{expect(publicReportUrl('https://example.org/reports/123?view=review&token=secret#owner=secret&review=other')).toBe('https://example.org/reports/123');});});
