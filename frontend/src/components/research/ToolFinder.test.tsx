import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ToolFinder} from './ToolFinder';

afterEach(cleanup);
it('shows all tools immediately on Overview and preserves the review capability',()=>{
  render(<MemoryRouter initialEntries={['/research-scope/reports/sample#review=secret']}><ToolFinder view="overview"/></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('50 tools');
  expect(screen.getAllByRole('link')).toHaveLength(50);
  expect(screen.getAllByRole('link')[0].getAttribute('href')).toContain('#review=secret');
});
it('filters other sections but searches the whole catalog when a query is entered',()=>{
  render(<MemoryRouter><ToolFinder view="evidence"/></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('in evidence');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'baseline'}});
  expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  expect(screen.getByRole('status')).not.toHaveTextContent('in evidence');
});
