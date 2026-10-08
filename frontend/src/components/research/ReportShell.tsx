import {useEffect,useRef,type ReactNode} from 'react';
import {useSearchParams,Link,useLocation,useNavigate} from 'react-router-dom';
import {reportViews,reportView,type ReportView} from '../../lib/researchToolRegistry';
import {DraftStatus} from './DraftStatus';

export function reportDestination(search:string,view:ReportView,tool?:string){const params=new URLSearchParams(search);params.set('view',view);params.delete('source');params.delete('tool');if(tool)params.set('tool',tool);return '?'+params.toString();}
export function ReportShell({children}:{children:ReactNode}){
  const [params]=useSearchParams();const location=useLocation();const navigate=useNavigate();const current=reportView(params.get('view'));const heading=useRef<HTMLHeadingElement>(null);const initial=useRef(true);const positions=useRef(new Map<string,number>());const route=location.pathname+location.search;const section=current+':'+(params.get('tool')||'')+':'+(params.get('source')||'');
  useEffect(()=>{const record=()=>positions.current.set(route,window.scrollY);window.addEventListener('scroll',record);return()=>{record();window.removeEventListener('scroll',record);};},[route]);
  useEffect(()=>{if(initial.current){initial.current=false;return;}heading.current?.focus({preventScroll:true});window.scrollTo({top:positions.current.get(route)||0});},[section]);
  return <div className="report-shell"><aside className="report-rail"><p>Report sections</p><nav aria-label="Report sections">{reportViews.map(view=><Link key={view} to={{search:reportDestination(location.search,view),hash:location.hash}} aria-current={view===current?'page':undefined}>{view[0].toUpperCase()+view.slice(1)}</Link>)}</nav><p className="hint">Use Find a tool to reach any research check.</p></aside><div className="report-content"><label className="mobile-report-nav">Report section<select value={current} onChange={e=>navigate({search:reportDestination(location.search,e.target.value as ReportView),hash:location.hash})}>{reportViews.map(view=><option key={view} value={view}>{view[0].toUpperCase()+view.slice(1)}</option>)}</select></label><h2 tabIndex={-1} ref={heading} className="view-heading">{current[0].toUpperCase()+current.slice(1)}</h2><DraftStatus/>{children}</div></div>;
}
