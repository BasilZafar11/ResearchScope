import {createBrowserRouter,Link,NavLink,Outlet} from 'react-router-dom';
import {lazy,Suspense} from 'react';
import {VentureHome,VentureReport,VentureReports} from '../pages/VenturePages';
import {CompareReportsPage} from '../pages/CompareReportsPage';
import {PrivateResearchPage} from '../pages/PrivateResearchPage';
const ResearchPage=lazy(()=>import('../pages/ResearchPage').then(m=>({default:m.ResearchPage})));
const StrategyPage=lazy(()=>import('../pages/StrategyPage').then(m=>({default:m.StrategyPage})));
const ResearchScopeLayout=lazy(()=>import('../pages/ResearchScopePage').then(m=>({default:m.ResearchScopeLayout})));
const ResearchScopeHome=lazy(()=>import('../pages/ResearchScopePage').then(m=>({default:m.ResearchScopeHome})));
const ResearchScopeReport=lazy(()=>import('../pages/ResearchScopePage').then(m=>({default:m.ResearchScopeReport})));
const ResearchLandingPage=lazy(()=>import('../pages/ResearchLandingPage').then(m=>({default:m.ResearchLandingPage})));
function Layout(){return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link className="brand" to="/market">VentureAtlas<span className="brand-sub">Evidence for your next venture</span></Link><nav aria-label="Main navigation"><NavLink to="/market" end>New analysis</NavLink><NavLink to="/reports">Reports</NavLink><NavLink to="/compare">Compare</NavLink></nav></header><main id="main"><Suspense fallback={<p>Loading workspace…</p>}><Outlet/></Suspense></main><footer className="site-footer">VentureAtlas · Market research with SerpApi</footer></>}
export const router=createBrowserRouter([{path:'/',element:<Suspense fallback={<p>Loading ResearchScope…</p>}><ResearchScopeLayout/></Suspense>,children:[{index:true,element:<ResearchLandingPage/>}]},{path:'/research-scope',element:<Suspense fallback={<p>Loading research workspace…</p>}><ResearchScopeLayout/></Suspense>,children:[{index:true,element:<ResearchScopeHome/>},{path:'private',element:<PrivateResearchPage/>},{path:'reports/:id',element:<ResearchScopeReport/>}]},{element:<Layout/>,children:[{path:'/market',element:<VentureHome/>},{path:'/reports',element:<VentureReports/>},{path:'/reports/:id',element:<VentureReport/>},{path:'/reports/:id/research',element:<ResearchPage/>},{path:'/reports/:id/strategy',element:<StrategyPage/>},{path:'/compare',element:<CompareReportsPage/>},{path:'*',element:<p>Page not found. <Link to="/research-scope">Open ResearchScope</Link></p>}]}]);
