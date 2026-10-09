import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {RouteError} from './RouteError';

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('provides recovery links without exposing the exception or clearing drafts',async()=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key),setItem:(key:string,value:string)=>stored.set(key,value)});
  let fail=true;
  function Broken(){if(fail)throw new Error('private internal exception');return <h1>Recovered page</h1>;}
  const router=createMemoryRouter([{path:'/research-scope/reports/:id',element:<Broken/>,errorElement:<RouteError/>},{path:'/',element:<h1>Home</h1>}],{initialEntries:['/research-scope/reports/one?view=evidence#review=secret']});
  localStorage.setItem('saved-draft','keep this');
  render(<RouterProvider router={router}/>);
  expect(await screen.findByRole('heading',{name:'This page could not be opened.'})).toBeTruthy();
  expect(screen.queryByText('private internal exception')).toBeNull();
  expect(screen.getByRole('link',{name:'Return to report overview'})).toHaveAttribute('href','/research-scope/reports/one#review=secret');
  fail=false;fireEvent.click(screen.getByRole('button',{name:'Try again'}));
  expect(await screen.findByText('Recovered page')).toBeTruthy();
  expect(localStorage.getItem('saved-draft')).toBe('keep this');
});
