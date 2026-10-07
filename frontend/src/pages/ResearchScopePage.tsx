import {Link,Outlet} from 'react-router-dom';
import {HomePage} from './HomePage';
import {ReportPage} from './ReportPage';
import researchStyles from '../styles/novelty.css?inline';

export function ResearchScopeLayout(){return <div className="research-scope"><style>{'@scope (.research-scope) {'+researchStyles.replaceAll(':root',':scope')+'}'}</style><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link className="brand" to="/research-scope">ResearchScope</Link><nav aria-label="ResearchScope navigation"><Link to="/research-scope">New research</Link><Link to="/research-scope/reports/sample">Sample report</Link><Link to="/market">Market tools</Link></nav></header><main id="main"><Outlet/></main></div>;}
export function ResearchScopeHome(){return <HomePage reportBase="/research-scope/reports"/>;}
export function ResearchScopeReport(){return <ReportPage homePath="/research-scope" reportBase="/research-scope/reports"/>;}
