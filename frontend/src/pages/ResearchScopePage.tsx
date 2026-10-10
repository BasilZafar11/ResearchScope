import {ThemeControl,useResearchTheme} from '../components/research/ThemeControl';
import uiStyles from '../styles/research-ui.css?inline';
import {Link,Outlet} from 'react-router-dom';
import {lazy,Suspense} from 'react';
const HomePage=lazy(()=>import('./HomePage').then(module=>({default:module.HomePage})));
const ReportPage=lazy(()=>import('./ReportPage').then(module=>({default:module.ReportPage})));
import researchStyles from '../styles/novelty.css?inline';

export function ResearchScopeLayout(){const appearance=useResearchTheme();return <div className="research-scope" data-theme={appearance.theme}><style>{'@scope (.research-scope) {'+researchStyles.replaceAll(':root',':scope')+uiStyles+'}'}</style><a className="skip-link" href="#main" onClick={event=>{event.preventDefault();document.getElementById('main')?.focus();}}>Skip to content</a><header className="site-header"><Link className="brand" to="/research-scope/about">ResearchScope</Link><nav aria-label="ResearchScope navigation"><Link to="/research-scope">New research</Link><Link to="/research-scope/reports/sample">Sample report</Link></nav><ThemeControl value={appearance.choice} onChange={appearance.change}/></header><main id="main" tabIndex={-1}><Outlet/></main></div>;}
export function ResearchScopeHome(){return <Suspense fallback={<p role="status">Loading research form…</p>}><HomePage reportBase="/research-scope/reports"/></Suspense>;}
export function ResearchScopeReport(){return <Suspense fallback={<p role="status">Loading report…</p>}><ReportPage homePath="/research-scope" reportBase="/research-scope/reports"/></Suspense>;}
