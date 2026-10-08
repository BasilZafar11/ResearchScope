import {useMemoryDraft} from '../lib/researchDraft';
import {useMemo,useState} from 'react';
import {nearTextFindings,temporalFindings} from '../lib/datasetAudit';
type CsvData={headers:string[];rows:string[][]};
type Finding={kind:string;value:string;splits:string[];rows:number[]};
export function parseCsv(input:string):CsvData{
 const text=input.replace(/^\uFEFF/,'');const records:string[][]=[];let row:string[]=[],cell='',quoted=false,closedQuote=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'&&text[i+1]==='"'){cell+='"';i++}else if(char==='"'){quoted=false;closedQuote=true}else cell+=char;continue}
  if(char==='"'){if(cell.length||closedQuote)throw new Error('Unexpected quote in an unquoted field.');quoted=true}
  else if(char===','){row.push(cell);cell='';closedQuote=false}
  else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))records.push(row);row=[];cell='';closedQuote=false}
  else {if(closedQuote)throw new Error('Unexpected text after a quoted field.');cell+=char}
 }
 if(quoted)throw new Error('The file ends inside a quoted field.');
 row.push(cell);if(row.some(value=>value.trim()))records.push(row);
 if(records.length<2)throw new Error('Add a header row and at least one data row.');
 const headers=records.shift()!.map(value=>value.trim());
 if(headers.some(value=>!value))throw new Error('Every column needs a header.');
 if(new Set(headers.map(value=>value.toLocaleLowerCase())).size!==headers.length)throw new Error('Column names must be unique.');
 if(records.length>10000)throw new Error('The manifest has more than 10,000 rows. Split it into smaller files; no rows were silently dropped.');
 if(records.some(record=>record.length!==headers.length))throw new Error('Each data row must have exactly the same number of fields as the header.');
 return {headers,rows:records.map(record=>headers.map((_,index)=>(record[index]||'').trim()))};
}
function duplicatesAcross(rows:string[][],headers:string[],splitColumn:string,valueColumn:string,allowedSplits:Set<string>){
 const splitIndex=headers.indexOf(splitColumn),valueIndex=headers.indexOf(valueColumn);if(splitIndex<0||valueIndex<0)return [];
 const groups=new Map<string,{splits:Set<string>;rows:number[]}>();
  rows.forEach((row,index)=>{const value=row[valueIndex]?.trim();const split=row[splitIndex]?.trim();if(!value||!allowedSplits.has(split))return;const group=groups.get(value)||{splits:new Set<string>(),rows:[]};group.splits.add(split);group.rows.push(index+2);groups.set(value,group)});
 return [...groups].filter(([,group])=>group.splits.size>1).map(([value,group])=>({value,splits:[...group.splits],rows:group.rows}));
}
function duplicatesWithin(rows:string[][],headers:string[],splitColumn:string,valueColumn:string,allowedSplits:Set<string>){
 const splitIndex=headers.indexOf(splitColumn),valueIndex=headers.indexOf(valueColumn);if(splitIndex<0||valueIndex<0)return [];
 const groups=new Map<string,{split:string;rows:number[]}>();
  rows.forEach((row,index)=>{const value=row[valueIndex]?.trim();const split=row[splitIndex]?.trim();if(!value||!allowedSplits.has(split))return;const key=split+'\u0000'+value;const group=groups.get(key)||{split,rows:[]};group.rows.push(index+2);groups.set(key,group)});
 return [...groups].filter(([,group])=>group.rows.length>1).map(([key,group])=>({value:key.slice(group.split.length+1),splits:[group.split],rows:group.rows}));
}
const saveCsv=(findings:Finding[])=>{
 const csv=[['finding','value','splits','row numbers'],...findings.map(item=>[item.kind,item.value,item.splits.join(' | '),item.rows.join(' | ')])].map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='dataset-leakage-findings.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

export function DatasetLeakageAudit({reportId='local'}:{reportId?:string}){
 const [data,setData]=useMemoryDraft<CsvData|null>(reportId+':dataset-data',null),[fileName,setFileName]=useMemoryDraft(reportId+':dataset-fileName',''),[error,setError]=useState('');
 const [splitColumn,setSplitColumn]=useMemoryDraft(reportId+':dataset-splitColumn',''),[sampleColumn,setSampleColumn]=useMemoryDraft(reportId+':dataset-sampleColumn',''),[subjectColumn,setSubjectColumn]=useMemoryDraft(reportId+':dataset-subjectColumn',''),[hashColumn,setHashColumn]=useMemoryDraft(reportId+':dataset-hashColumn','');
 const [train,setTrain]=useMemoryDraft(reportId+':dataset-train',''),[validation,setValidation]=useMemoryDraft(reportId+':dataset-validation',''),[test,setTest]=useMemoryDraft(reportId+':dataset-test','');
 const [timeColumn,setTimeColumn]=useMemoryDraft(reportId+':dataset-timeColumn',''),[strictTime,setStrictTime]=useMemoryDraft(reportId+':dataset-strictTime',true),[textColumn,setTextColumn]=useMemoryDraft(reportId+':dataset-textColumn',''),[nearEnabled,setNearEnabled]=useMemoryDraft(reportId+':dataset-nearEnabled',false);
 const [labelColumn,setLabelColumn]=useMemoryDraft(reportId+':dataset-labelColumn',''),[predictors,setPredictors]=useMemoryDraft<string[]>(reportId+':dataset-predictors',[]),[preprocessing,setPreprocessing]=useMemoryDraft(reportId+':dataset-preprocessing','unknown');
 const splitValues=useMemo(()=>{const index=data?.headers.indexOf(splitColumn)??-1;return index<0?[]:[...new Set(data!.rows.map(row=>row[index]).filter(Boolean))].sort()},[data,splitColumn]);
 const findings=useMemo(()=>{
  if(!data||!splitColumn)return [] as Finding[];
  const result:Finding[]=[];
  const selected=new Set([train,validation,test].filter(Boolean));
  const labels:Array<[string,string,boolean]>=[['sample ID',sampleColumn,true],['subject/group ID',subjectColumn,false],['content hash',hashColumn,true]];
  for(const [kind,column,checkWithin] of labels){if(!column)continue;const across=duplicatesAcross(data.rows,data.headers,splitColumn,column,selected).filter(item=>item.splits.length>1);for(const item of across)result.push({kind:kind+' shared across splits',...item});if(checkWithin){const within=duplicatesWithin(data.rows,data.headers,splitColumn,column,selected);for(const item of within)result.push({kind:kind+' repeated within split',...item})}}
  if(timeColumn)result.push(...temporalFindings(data.rows,data.headers.indexOf(splitColumn),data.headers.indexOf(timeColumn),train,validation,test,strictTime));
  if(nearEnabled&&textColumn)result.push(...nearTextFindings(data.rows,data.headers.indexOf(splitColumn),data.headers.indexOf(textColumn),selected));
  if(labelColumn&&predictors.includes(labelColumn))result.push({kind:'target column included as predictor',value:labelColumn,splits:[...selected],rows:[]});
  if(['all splits','validation or test'].includes(preprocessing))result.push({kind:'preprocessing exposure reported',value:'Fitted preprocessing used '+preprocessing,splits:[...selected],rows:[]});
  return result;
 },[data,splitColumn,sampleColumn,subjectColumn,hashColumn,train,validation,test,timeColumn,strictTime,textColumn,nearEnabled,labelColumn,predictors,preprocessing]);
 const onFile=async(file?:File)=>{if(!file)return;setError('');setData(null);if(file.size>2000000){setError('Select a CSV manifest under 2 MB.');return}try{const parsed=parseCsv(await file.text());setData(parsed);setFileName(file.name);setSplitColumn('');setSampleColumn('');setSubjectColumn('');setHashColumn('');setTrain('');setValidation('');setTest('');setTimeColumn('');setTextColumn('');setNearEnabled(false);setLabelColumn('');setPredictors([]);setPreprocessing('unknown')}catch(reason){setFileName('');setError(reason instanceof Error?reason.message:'The CSV could not be read.')}};
 const overlapCount=findings.filter(item=>item.kind.includes('shared across splits')).length;
 const auditReady=Boolean(data&&splitColumn&&train&&test&&train!==test&&(!validation||validation!==train&&validation!==test)&&(sampleColumn||subjectColumn||hashColumn||timeColumn||labelColumn||nearEnabled&&textColumn||preprocessing!=='unknown'));
 return <>
<p className="hint">Uploaded manifests stay in memory for this visit. Reloading requires choosing the file again; no manifest data is saved in browser storage.</p><button className="quiet-button" onClick={()=>{setData(null);setFileName('');}}>Clear loaded manifest</button>
  <p>Upload a CSV manifest to compare explicit split labels. The file and row values stay in this browser session. Results are cleared when the page reloads; export them yourself if you need a record.</p>
  <label>CSV manifest<input type="file" accept=".csv,text/csv" onChange={event=>void onFile(event.target.files?.[0])}/></label>
  {fileName&&data&&<p>{fileName} · {data.rows.length.toLocaleString()} rows · {data.headers.length} columns</p>}
  {error&&<p className="warning-line" role="alert">{error}</p>}
  {data&&<><div className="tool-input-grid"><label>Split column<select value={splitColumn} onChange={event=>{setSplitColumn(event.target.value);setTrain('');setValidation('');setTest('')}}><option value="">Choose split column</option>{data.headers.map(name=><option key={name}>{name}</option>)}</select></label><label>Sample ID column<select value={sampleColumn} onChange={event=>setSampleColumn(event.target.value)}><option value="">Skip</option>{data.headers.map(name=><option key={name}>{name}</option>)}</select></label><label>Subject/group ID column<select value={subjectColumn} onChange={event=>setSubjectColumn(event.target.value)}><option value="">Skip</option>{data.headers.map(name=><option key={name}>{name}</option>)}</select></label><label>Content hash column<select value={hashColumn} onChange={event=>setHashColumn(event.target.value)}><option value="">Skip</option>{data.headers.map(name=><option key={name}>{name}</option>)}</select></label></div>
  {splitColumn&&<div className="tool-input-grid"><label>Training split<select value={train} onChange={event=>setTrain(event.target.value)}><option value="">Select value</option>{splitValues.map(value=><option key={value}>{value}</option>)}</select></label><label>Validation split<select value={validation} onChange={event=>setValidation(event.target.value)}><option value="">Optional</option>{splitValues.filter(value=>value!==train&&value!==test).map(value=><option key={value}>{value}</option>)}</select></label><label>Test split<select value={test} onChange={event=>setTest(event.target.value)}><option value="">Select value</option>{splitValues.filter(value=>value!==train).map(value=><option key={value}>{value}</option>)}</select></label></div>}
  {data&&splitColumn&&!auditReady&&<p className="warning-line">To run the check, choose distinct training and test split values and map at least one sample ID, subject/group ID, or content hash column.</p>}
  {auditReady&&<><div className="coverage-strip"><span>Cross-split overlap findings<b>{overlapCount}</b></span><span>All exact duplicate findings<b>{findings.length}</b></span></div>{findings.length>0&&<><div className="leakage-findings">{findings.slice(0,100).map((item,index)=><article key={item.kind+item.value+index}><b>{item.kind}</b><code>{item.value}</code><small>Splits: {item.splits.join(', ')} · Rows: {item.rows.join(', ')}</small></article>)}</div><button type="button" className="quiet-button" onClick={()=>saveCsv(findings)}>Export findings CSV</button></>}{findings.length===0&&<p className="empty-state">No exact repeated values were found in the mapped columns and selected split values.</p>}</>}
  </>}
  {data&&<details><summary>Temporal, label, preprocessing, and text checks</summary><p>Temporal ordering is appropriate only if your study requires past observations to precede evaluation observations.</p><label>Timestamp column<select value={timeColumn} onChange={e=>setTimeColumn(e.target.value)}><option value="">Skip temporal check</option>{data.headers.map(x=><option key={x}>{x}</option>)}</select></label><label><input type="checkbox" checked={strictTime} onChange={e=>setStrictTime(e.target.checked)}/>Require strictly earlier timestamps across train → validation → test</label><small>Use ISO dates or timestamps with a timezone. Unknown or invalid dates stay unresolved.</small><label>Target label column<select value={labelColumn} onChange={e=>setLabelColumn(e.target.value)}><option value="">Skip label check</option>{data.headers.map(x=><option key={x}>{x}</option>)}</select></label><p>Columns actually used as predictors:</p>{data.headers.map(column=><label key={column}><input type="checkbox" checked={predictors.includes(column)} onChange={e=>setPredictors(e.target.checked?[...predictors,column]:predictors.filter(x=>x!==column))}/>{column}</label>)}<label>Which data fitted preprocessing statistics?<select value={preprocessing} onChange={e=>setPreprocessing(e.target.value)}>{['unknown','training only','all splits','validation or test'].map(x=><option key={x}>{x}</option>)}</select></label><label>Text content column<select value={textColumn} onChange={e=>setTextColumn(e.target.value)}><option value="">Choose text column</option>{data.headers.map(x=><option key={x}>{x}</option>)}</select></label><label><input type="checkbox" checked={nearEnabled} onChange={e=>setNearEnabled(e.target.checked)}/>Compare text candidates across splits</label><small>Text comparison uses the first 250 selected rows with text of at least 20 characters and at most 200 tokens per row. A 90% token overlap suggests review, not proven leakage. Images and semantic duplicates remain unchecked.</small></details>}
  <div className="tool-result"><b>Scope of this audit</b><p>Exact IDs and hashes are checked across mapped splits. Optional temporal checks enforce your chosen order; label and preprocessing checks use your declarations. Text overlap is bounded and heuristic. Indirect label proxies, semantic duplicates, images, and unreported preprocessing remain unchecked. No findings does not prove a leakage-free dataset.</p></div>
 </>;
}
