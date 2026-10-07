import type {ResearchInput,ResearchTool,ResearchRow} from '../types/research';
import type {Report} from '../types/analysis';
export const researchTools:Record<ResearchTool,{title:string;purpose:string;limitation:string;example:string;doc:string}>={
 directions:{title:'Travel-time catchments',purpose:'Compare routes from a public starting landmark to up to three sampled competitors.',limitation:'Returned route times are estimates for the requested travel mode. This compares selected destinations; it does not draw a complete travel-time boundary or measure customer demand.',example:'',doc:'google-maps-directions-api'},
 forums:{title:'Customer-question discovery',purpose:'Find questions and discussion excerpts beyond business reviews.',limitation:'Topic labels use words in titles and snippets. Forum results are a biased sample; snippets and answer excerpts can omit context.',example:'coworking Pune costs and alternatives',doc:'google-forums-api'},
 autocomplete:{title:'Search-intent branching',purpose:'Explore suggestions for a phrase and its “for” and “near” branches.',limitation:'Suggestions and heuristic intent labels describe search language, not search counts, demand size or customer identities.',example:'coworking Pune',doc:'google-autocomplete-api'},
 events:{title:'Local event-demand calendar',purpose:'Group returned events by their published dates to investigate temporary opportunities.',limitation:'Dates are displayed as provided. Missing years and dates remain unresolved. Listings do not establish attendance, sales or a causal effect on demand.',example:'business events in Pune',doc:'google-events-api'},
 jobs:{title:'Hiring and skills pulse',purpose:'Inspect employers, roles, published salaries and skill mentions in a local job-search sample.',limitation:'One page of listings cannot establish actual hiring or labor shortages. Skill matching uses a small fixed vocabulary; missing salary data stays unknown.',example:'community manager Pune',doc:'google-jobs-api'},
 shopping:{title:'Price-range benchmark',purpose:'Select comparable products and compare their listed price ranges by currency.',limitation:'Variants, shipping and taxes may differ. Choose comparable items before using the range. Prices with an unknown or ambiguous currency are excluded from the benchmark.',example:'ergonomic task chair',doc:'google-shopping-api'},
 hotels:{title:'Hospitality rate calendar',purpose:'Compare a stay with the same length and guest count over three weekly start dates.',limitation:'The sample may contain different properties on different dates. Listed nightly rates do not reveal occupancy, revenue or comparable room conditions.',example:'hotels in Pune',doc:'google-hotels-api'},
 flights:{title:'Visitor-access lens',purpose:'Compare one-way flight options for a chosen airport pair and departure date.',limitation:'Fares are provider-reported for the requested travelers. Baggage, taxes and fare conditions need confirmation; available routes do not measure visitor demand.',example:'',doc:'google-flights-api'},
 images:{title:'Visual landscape',purpose:'Review linked competitor imagery and add your own observations and tags.',limitation:'Images may be stale, unrelated or copyrighted. Open the source to verify context and reuse rights. Tags are your own judgments.',example:'coworking Pune interior',doc:'google-images-api'},
 scholar:{title:'Research evidence shelf',purpose:'Inspect scholarly search results and save papers with notes about applicability.',limitation:'A search snippet is not a full paper. Citation counts do not establish quality or local relevance. Full text may require access through its publisher.',example:'coworking workplace choice commuting',doc:'google-scholar-api'},
};
export const toolKeys=Object.keys(researchTools) as ResearchTool[];
export function requestEstimate(input:ResearchInput){return input.tool==='directions'?(input.competitor_ranks?.length||0):input.tool==='hotels'||input.tool==='autocomplete'?3:1}
export function defaultResearchInput(tool:ResearchTool,report:Report):ResearchInput{
 const future=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const defaults:ResearchInput={tool,query:researchTools[tool].example.replaceAll('Pune',report.input.city),refresh:false};
 if(tool==='directions')return {tool,origin:`${report.input.city} railway station`,competitor_ranks:report.competitors.filter(p=>p.latitude!==null&&p.longitude!==null).slice(0,3).map(p=>p.rank),travel_mode:'walking',refresh:false};
 if(tool==='hotels')return {...defaults,check_in:future(7),check_out:future(8),adults:1,currency:report.input.country==='India'?'INR':'USD'};
 if(tool==='flights')return {tool,departure_airport:'',arrival_airport:'',departure_date:future(7),adults:1,currency:report.input.country==='India'?'INR':'USD',refresh:false};
 if(['forums','autocomplete','images'].includes(tool))defaults.query=`${report.input.business_category} ${report.input.city}${tool==='forums'?' alternatives':tool==='images'?' images':''}`;
 return defaults;
}
export function priceRanges(rows:ResearchRow[]){
 const groups=new Map<string,number[]>();
 for(const row of rows){const amount=row.meta.Amount,currency=row.meta.Currency;if(typeof amount==='number'&&Number.isFinite(amount)&&amount>=0&&typeof currency==='string'&&!['Unknown','Unspecified $',''].includes(currency))groups.set(currency,[...(groups.get(currency)||[]),amount])}
 return [...groups].map(([currency,values])=>{values.sort((a,b)=>a-b);const n=values.length;return {currency,count:n,min:values[0],max:values[n-1],median:n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2}});
}
export const safeLink=(url:string|null|undefined)=>!!url&&/^https?:\/\//i.test(url);
