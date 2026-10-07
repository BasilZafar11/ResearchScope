export type AuditFinding={kind:string;value:string;splits:string[];rows:number[]};
function timestamp(value:string){if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))return NaN;const time=Date.parse(value);if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value.slice(0,10)&&!value.includes('T'))return NaN;return time;}
export function temporalFindings(rows:string[][],splitIndex:number,timeIndex:number,train:string,validation:string,test:string,strict=true):AuditFinding[]{
  const selected=new Set([train,validation,test].filter(Boolean));const result:AuditFinding[]=[];
  const dated=rows.map((row,index)=>({split:row[splitIndex],date:timestamp(row[timeIndex]||''),row:index+2})).filter(x=>selected.has(x.split));
  for(const row of dated)if(!Number.isFinite(row.date))result.push({kind:'timestamp unknown or invalid',value:'Temporal check could not evaluate this row',splits:[row.split],rows:[row.row]});
  const pairs=validation?[[train,validation],[train,test],[validation,test]]:[[train,test]];
  for(const [earlier,later] of pairs){const a=dated.filter(x=>x.split===earlier&&Number.isFinite(x.date)),b=dated.filter(x=>x.split===later&&Number.isFinite(x.date));if(!a.length||!b.length)continue;const latest=a.reduce((x,y)=>x.date>=y.date?x:y),first=b.reduce((x,y)=>x.date<=y.date?x:y);if(strict?latest.date>=first.date:latest.date>first.date)result.push({kind:'temporal ordering violation',value:'Latest '+earlier+' observation is '+(strict?'not strictly before':'after')+' earliest '+later+' observation',splits:[earlier,later],rows:[latest.row,first.row]});}
  return result;
}
export function nearTextFindings(rows:string[][],splitIndex:number,textIndex:number,selected:Set<string>,limit=250):AuditFinding[]{
  const items=rows.map((row,index)=>({split:row[splitIndex],text:(row[textIndex]||'').toLowerCase().replace(/\s+/g,' ').trim(),row:index+2})).filter(x=>selected.has(x.split)&&x.text.length>=20).slice(0,limit);
  const tokens=items.map(x=>new Set((x.text.match(/[\p{L}\p{N}]+/gu)||[]).slice(0,200)));
  const result:AuditFinding[]=[];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){if(items[i].split===items[j].split)continue;const overlap=[...tokens[i]].filter(x=>tokens[j].has(x)).length;const union=new Set([...tokens[i],...tokens[j]]).size;const score=union?overlap/union:0;if(items[i].text===items[j].text||score>=.9)result.push({kind:'near-duplicate text candidate',value:'Token similarity '+Math.round(score*100)+'% · inspect original rows',splits:[items[i].split,items[j].split],rows:[items[i].row,items[j].row]});}
  return result;
}
