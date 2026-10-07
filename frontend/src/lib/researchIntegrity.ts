export function safeHttp(value: string): string {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function doiFrom(value: string): string {
  return value.match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0].replace(/[.,;]$/, '') || '';
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const words = (value: string) => new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(x => x.length > 3));
export function citationDiagnostics(statement: string, passage: string) {
  const asserted = words(statement), cited = words(passage);
  const missing = [...asserted].filter(word => !cited.has(word));
  const numbers = statement.match(/\b\d+(?:\.\d+)?%?(?![\w%])/g) || [];
  const passageNumbers: string[] = passage.match(/\b\d+(?:\.\d+)?%?(?![\w%])/g) || [];
  const missingNumbers = numbers.filter(number => !passageNumbers.includes(number));
  const broad = statement.match(/\b(all|always|every|never|proves?|causes?|guarantees?)\b/gi) || [];
  return {missing, missingNumbers, broad, shared: [...asserted].filter(word => cited.has(word))};
}

// Acklam inverse standard normal approximation, absolute error approximately 1e-9.
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('Probability must be between zero and one.');
  const a = [-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
  const b = [-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
  const c = [-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
  const d = [.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
  if (p < .02425 || p > .97575) {
    const q = Math.sqrt(-2 * Math.log(p < .02425 ? p : 1-p));
    const value = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    return p < .02425 ? value : -value;
  }
  const q=p-.5, r=q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

export type PowerInput = {mode: 'two means'|'paired mean'|'proportion precision'; effect:number; sd:number; alpha:number; power:number; attrition:number; margin:number; proportion:number};
export function sampleRequirement(input: PowerInput) {
  const {mode,effect,sd,alpha,power,attrition,margin,proportion} = input;
  if (![alpha,power,attrition].every(Number.isFinite) || alpha<=0 || alpha>=.5 || power<=.5 || power>=1 || attrition<0 || attrition>=1) throw new Error('Check significance, power, and attrition values.');
  const za=normalQuantile(1-alpha/2), zb=normalQuantile(power);
  let required: number;
  if(mode==='proportion precision') {
    if(!Number.isFinite(margin)||margin<=0||margin>=1||!Number.isFinite(proportion)||proportion<=0||proportion>=1) throw new Error('Enter a margin and expected proportion between zero and one.');
    required=za*za*proportion*(1-proportion)/(margin*margin);
  } else {
    if(!Number.isFinite(effect)||effect<=0||!Number.isFinite(sd)||sd<=0) throw new Error('Effect and standard deviation must be positive.');
    required=(mode==='two means'?2:1)*(za+zb)**2*(sd/effect)**2;
  }
  if(!Number.isFinite(required)||required>1e7) throw new Error('Required sample is too large; review the assumptions.');
  const analyzed=Math.ceil(required), recruited=Math.ceil(analyzed/(1-attrition));
  return {analyzed,recruited,total:recruited*(mode==='two means'?2:1)};
}
