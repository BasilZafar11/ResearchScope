import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from 'recharts';
import type {Report} from '../types/analysis';
const colors=['#145cac','#0e8075','#a66014','#7c4b9e','#bd415d'];
export function DemandChart({series}:{series:Report['trend_series']}){
 if(!series.length)return <p className="empty">No search-interest series is available. Demand uses a neutral score.</p>;
 const keys=Array.from(new Set(series.flatMap(p=>Object.keys(p.values))));
 const rows=series.map(p=>({date:p.date,...p.values}));
 return <><p>Relative interest (0–100), compared across {series.length} time points. These values are not search volumes.</p><div className="chart" role="img" aria-label={`Search interest for ${keys.join(', ')}. Exact values are available in the table below.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{right:15,top:15,bottom:10}}><CartesianGrid strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" minTickGap={65} tick={{fontSize:12}}/><YAxis domain={[0,100]} width={36}/><Tooltip/><Legend/>{keys.map((k,i)=><Line type="monotone" key={k} dataKey={k} stroke={colors[i%5]} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div><details><summary>View exact trend values</summary><div className="table-scroll"><table><thead><tr><th>Date</th>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{series.map((p,i)=><tr key={i}><td>{p.date}</td>{keys.map(k=><td key={k}>{p.values[k]??'Unavailable'}</td>)}</tr>)}</tbody></table></div></details></>
}
