import {useState} from 'react';
import {z} from 'zod';
import {downloadFile,safeHttp} from '../../lib/researchIntegrity';
import {Field,Notice,SaveBar,useDraft,text} from './Shared';

const schema=z.object({repository:text,commit:text,environment:text,dependencies:text,command:text,configuration:text,seeds:text,dataAccess:text,dataLicense:text,hardware:text,expectedOutputs:text,verification:text});
const blank={repository:'',commit:'',environment:'',dependencies:'',command:'',configuration:'',seeds:'',dataAccess:'',dataLicense:'',hardware:'',expectedOutputs:'',verification:''};
type Attachment={name:string;sha256:string;content:string};
export function ReproducibilityBuilder({id}:{id:string}) {
  const saved=useDraft('research-integrity-'+id+'-reproducibility',schema,blank);
  const [files,setFiles]=useState<Attachment[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const missing=Object.entries(saved.value).filter(([,value])=>!value.trim()).map(([key])=>key);
  async function addFiles(selected:FileList|null){if(!selected)return;setBusy(true);setError('');try {
    if(selected.length+files.length>10)throw new Error('Attach at most ten text files.');
    const added:Attachment[]=[];
    for(const file of Array.from(selected)){
      if(!/\.(txt|md|json|ya?ml|toml|csv|py|r|sh|lock)$/i.test(file.name)||file.size>250000)throw new Error('Use text/configuration files up to 250 KB each.');
      if(/(^\.env|credential|secret|private.?key)/i.test(file.name))throw new Error('Remove credential files before packaging.');
      if([...files,...added].some(x=>x.name===file.name))throw new Error('Each attachment needs a unique filename.');
      const content=await file.text();
      if(content.includes('\u0000'))throw new Error('Binary files cannot be included.');
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
      added.push({name:file.name,content,sha256:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')});
    }
    setFiles([...files,...added]);
  }catch(e){setError(e instanceof Error?e.message:'Could not read attachment.');}finally{setBusy(false);}}
  function exportPackage(){
    if(saved.value.repository&&!safeHttp(saved.value.repository)){setError('Use an http or https repository URL.');return;}
    const readme='# Reproducibility instructions\n\n'+Object.entries(saved.value).map(([key,value])=>'## '+key+'\n\n'+(value||'NOT RECORDED')).join('\n\n');
    downloadFile('research-reproducibility-package.json',JSON.stringify({format:'research-reproducibility-v1',reportId:id,exportedAt:new Date().toISOString(),status:missing.length?'incomplete':'documented, execution not verified',missing,manifest:saved.value,files:[{name:'README.md',content:readme},...files]},null,2));
  }
  const labels:Record<keyof typeof blank,string>={repository:'Code repository URL',commit:'Commit or release identifier',environment:'Runtime and operating system',dependencies:'Dependency versions / lockfile instructions',command:'Exact execution command',configuration:'Configuration and hyperparameters',seeds:'Random seeds and determinism settings',dataAccess:'Dataset version, access URL, and access instructions',dataLicense:'Dataset license and redistribution restrictions',hardware:'Hardware and resource requirements',expectedOutputs:'Expected artifacts, metrics, and tolerances',verification:'Reproduction status, verifier, and evidence'};
  return <>
    <p>Build a portable JSON package containing a manifest, instructions, and optional text files with SHA-256 hashes. The package does not execute code.</p>
    <div className="tool-input-grid">{Object.keys(blank).map(key=><Field key={key} area label={labels[key as keyof typeof blank]} value={saved.value[key as keyof typeof blank]} onChange={value=>saved.save({...saved.value,[key]:value})}/>)}</div>
    <p>{missing.length?'Missing documentation: '+missing.map(x=>labels[x as keyof typeof blank]).join('; '):'All documentation fields are filled. Reproduction still needs an independent run.'}</p>
    <label>Attach supporting text files<input type="file" multiple accept=".txt,.md,.json,.yaml,.yml,.toml,.csv,.py,.r,.sh,.lock" disabled={busy} onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label>
    <small>Files stay in memory until export. Inspect attachments for secrets and restricted data; filenames alone cannot detect them.</small>
    {files.map(file=><p key={file.name}>{file.name} · SHA-256 {file.sha256.slice(0,16)}… <button className="quiet-button" onClick={()=>setFiles(files.filter(x=>x.name!==file.name))}>Remove</button></p>)}
    <button className="quiet-button" disabled={busy} onClick={exportPackage}>Download reproducibility package</button><Notice message={error}/>
    <SaveBar error={saved.error} onExport={saved.export}/>
  </>;
}
