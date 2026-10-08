import {ThemeControl,useResearchTheme} from '../components/research/ThemeControl';
import uiStyles from '../styles/research-ui.css?inline';
import {Link,Outlet} from 'react-router-dom';
import {HomePage} from './HomePage';
import {ReportPage} from './ReportPage';
import researchStyles from '../styles/novelty.css?inline';

export function ResearchScopeLayout(){const appearance=useResearchTheme();return <div className="research-scope" data-theme={appearance.theme}><style>{'@scope (.research-scope) {'+researchStyles.replaceAll(':root',':scope')+uiStyles+'}'}</style><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link className="brand" to="/">ResearchScope</Link><nav aria-label="ResearchScope navigation"><Link to="/research-scope">New research</Link><Link to="/research-scope/reports/sample">Sample report</Link><Link to="/market">Market tools</Link></nav><ThemeControl value={appearance.choice} onChange={appearance.change}/></header><main id="main"><Outlet/></main></div>;}
export function ResearchScopeHome(){return <HomePage reportBase="/research-scope/reports"/>;}
export function ResearchScopeReport(){return <ReportPage homePath="/research-scope" reportBase="/research-scope/reports"/>;}
