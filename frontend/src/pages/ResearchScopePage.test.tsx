import {afterEach,it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {ResearchScopeLayout} from './ResearchScopePage';
afterEach(cleanup);
function Location(){const location=useLocation();return <output data-testid="location">{location.pathname+location.hash}</output>;}
it('moves keyboard users to content without replacing the review capability fragment',()=>{render(<MemoryRouter initialEntries={['/research-scope/reports/sample#review=test']}><Routes><Route path="/research-scope" element={<ResearchScopeLayout/>}><Route path="reports/:id" element={<Location/>}/></Route></Routes></MemoryRouter>);fireEvent.click(screen.getByRole('link',{name:'Skip to content'}));expect(screen.getByRole('main')).toHaveFocus();expect(screen.getByTestId('location')).toHaveTextContent('/research-scope/reports/sample#review=test');});
