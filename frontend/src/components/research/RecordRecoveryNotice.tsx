import {recoverableRecords} from '../../lib/projectRecords';

export function RecordRecoveryNotice({id}:{id:string}){
  const records=recoverableRecords(id);
  if(!Object.keys(records).length)return null;
  function download(){
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'researchscope-record-recovery-v1',reportId:id,records},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='researchscope-record-recovery.json';link.click();URL.revokeObjectURL(url);
  }
  return <section className="report-section" role="alert"><h2>Some saved records need repair</h2>
    <p>Invalid records are not used by the tools. Their original contents have been kept for recovery.</p>
    <ul>{Object.keys(records).map(key=><li key={key}>{key}</li>)}</ul>
    <button className="quiet-button" onClick={download}>Download original records</button>
  </section>;
}
