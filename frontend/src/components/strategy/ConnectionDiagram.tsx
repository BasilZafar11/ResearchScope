import type {StrategyNote} from '../../lib/strategy';

export function ConnectionDiagram({sources,notes,focus,onFocus}:{sources:{id:string;title:string}[];notes:StrategyNote[];focus:string;onFocus:(id:string)=>void}) {
 const nodes=[...sources.slice(0,18).map((s,i)=>({...s,x:10,y:36+i*48})),...notes.slice(0,18).map((n,i)=>({id:n.id,title:`${n.kind}: ${n.text}`,x:370,y:36+i*48}))];
 const height=Math.max(140,Math.max(Math.min(sources.length,18),Math.min(notes.length,18))*48+40);
 return <div className="graph-diagram"><svg viewBox={`0 0 660 ${height}`} aria-label="Evidence connection diagram" role="group">
 <text x="10" y="20">Saved evidence</text><text x="370" y="20">Your reasoning</text>
 {notes.slice(0,18).flatMap(n=>n.sources.map(id=>{const start=nodes.find(v=>v.id===id),end=nodes.find(v=>v.id===n.id);return start&&end?<path key={n.id+id} d={`M ${start.x+280} ${start.y+16} C 340 ${start.y+16}, 330 ${end.y+16}, ${end.x} ${end.y+16}`} fill="none" stroke={focus===n.id||focus===id?'#087f8c':'#b4c7cb'} strokeWidth="2"/>:null}))}
 {nodes.map(n=><g key={n.id} role="button" tabIndex={0} aria-label={`Focus connections for ${n.title}`} onClick={()=>onFocus(focus===n.id?'':n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onFocus(focus===n.id?'':n.id)}}}><title>{n.title}</title><rect x={n.x} y={n.y} width="280" height="34" rx="5" fill={focus===n.id?'#d6f3ee':'#f1f6f7'} stroke="#087f8c"/><text x={n.x+10} y={n.y+22} fontSize="12">{n.title.length>38?n.title.slice(0,35)+'…':n.title}</text></g>)}
 </svg>{(sources.length>18||notes.length>18)&&<p className="hint">Diagram shows the first 18 sources and notes. The complete list and export remain below.</p>}</div>;
}
