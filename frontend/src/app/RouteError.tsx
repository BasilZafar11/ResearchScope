import {Link,useLocation,useNavigate} from 'react-router-dom';

export function RouteError(){
  const location=useLocation(),navigate=useNavigate();
  const reportPath=location.pathname.match(/^\/(?:research-scope\/)?reports\/[^/]+/)?.[0];
  return <main id="main" tabIndex={-1} className="report-section" role="alert">
    <h1>This page could not be opened.</h1>
    <p>Your saved records and browser drafts have been kept. Try again, or return to another page.</p>
    <button onClick={()=>navigate(location.pathname+location.search+location.hash,{replace:true})}>Try again</button>
    {reportPath&&<p><Link to={reportPath+location.hash}>Return to report overview</Link></p>}
    <p><Link to="/">Return home</Link></p>
  </main>;
}
