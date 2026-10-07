import type {Competitor} from '../types/analysis';
export type SearchOptions={ads:boolean;keywords:boolean;seasonality:boolean;hours:boolean;reputation:boolean};
export const defaultOptions:SearchOptions={ads:true,keywords:true,seasonality:true,hours:true,reputation:true};
export const optionLabels:Record<keyof SearchOptions,string>={ads:'Advertising activity',keywords:'Related keywords',seasonality:'Five-year seasonality',hours:'Opening-hours details',reputation:'Additional review history'};
export function searchEstimate(options:SearchOptions){
 const guaranteed=3+Number(options.keywords)+Number(options.seasonality);
 const maximum=6+3*Number(options.ads)+Number(options.keywords)+Number(options.seasonality)+3*Number(options.hours)+3*Number(options.reputation);
 return {minimum:guaranteed,maximum,retryMaximum:maximum*3};
}
export const days=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
function minute(text:string):number|null{
 const m=text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
 if(!m)return null;
 let hour=Number(m[1]);const min=Number(m[2]||0);
 if(min>59)return null;
 if(m[3]){if(hour<1||hour>12)return null;hour=hour%12+(m[3].toUpperCase()==='PM'?12:0)}
 else if(hour>23||m[2]===undefined)return null;
 return hour*60+min;
}
export function parseHours(value?:string):[number,number][]|null{
 if(!value)return null;
 const normalized=value.replace(/[\u2009\u202f\u00a0]/g,' ').trim();
 if(/^closed$/i.test(normalized))return [];
 if(/^(open )?24 hours$/i.test(normalized))return [[0,1440]];
 const result:[number,number][]=[];
 for(const part of normalized.split(/[,;]/)){
  const pair=part.split(/\s*[–—-]\s*/);if(pair.length!==2)return null;
  const start=minute(pair[0]),end=minute(pair[1]);
  if(start===null||end===null||start===end)return null;
  result.push([start,end<start?end+1440:end]);
 }
 return result;
}
export function openingState(hours:Record<string,string>|undefined,day:number,at:number):'Open'|'Closed'|'Unknown'{
 const today=parseHours(hours?.[days[day]]),previous=parseHours(hours?.[days[(day+6)%7]]);
 if(today?.some(([s,e])=>at>=s&&at<e)||previous?.some(([s,e])=>at+1440>=s&&at+1440<e))return 'Open';
 return today===null||previous===null?'Unknown':'Closed';
}
export type BrandChoice={group:string;kind:'unverified'|'chain'|'independent'};
export function suggestBrands(competitors:Competitor[],known:string[]):Record<string,BrandChoice>{
 const host=(url:string|null)=>{try{const h=new URL(url||'').hostname.replace(/^www\./,'');return /(^|\.)(google|facebook|instagram|linkedin)\.com$/.test(h)?'':h}catch{return ''}};
 const hosts=competitors.map(p=>host(p.website));
 return Object.fromEntries(competitors.map((p,i)=>{
  const normalized=p.name.toLowerCase();
  const match=known.find(k=>!k.includes('.')&&(normalized===k.toLowerCase()||normalized.startsWith(k.toLowerCase()+' ')||normalized.startsWith(k.toLowerCase()+'-')));
  const commonHost=hosts[i]&&hosts.filter(h=>h===hosts[i]).length>1?hosts[i]:'';
  return [String(p.rank),{group:match||commonHost||p.name.split(/\s[–—-]\s/)[0],kind:'unverified'}];
 }));
}
