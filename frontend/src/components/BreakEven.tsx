import {useState} from 'react';

export function breakEven(rent:number,other:number,price:number,variable:number,capacity:number) {
 if([rent,other,price,variable,capacity].some(v=>!Number.isFinite(v)||v<0)||price===0||capacity<=0||!Number.isInteger(capacity))return null;
 const fixed=rent+other,margin=price-variable;
 if(!Number.isFinite(fixed))return null;
 if(margin<=0)return {fixed,margin,customers:null,occupancy:null};
 const customers=Math.ceil(fixed/margin);
 if(!Number.isSafeInteger(customers)||!Number.isFinite(customers/capacity*100))return null;
 return {fixed,margin,customers,occupancy:customers/capacity*100};
}

export function BreakEven() {
 const initial={rent:'',other:'',price:'',variable:'',capacity:''};
 const [values,setValues]=useState(initial);
 const [currency,setCurrency]=useState('INR');
 const fields={rent:'Monthly rent',other:'Other monthly fixed costs',price:'Monthly price per customer',variable:'Monthly variable cost per customer',capacity:'Maximum customers per month'};
 const complete=Object.values(values).every(v=>v.trim()!=='');
 const result=complete?breakEven(Number(values.rent),Number(values.other),Number(values.price),Number(values.variable),Number(values.capacity)):null;
 return <section className="report-section" id="break-even"><h2>Break-even calculator</h2><p>Enter your own monthly assumptions using one currency. These values stay in this page and are not inferred from search data.</p>
 <label className="research-select">Currency label<input maxLength={12} value={currency} onChange={e=>setCurrency(e.target.value)}/></label><div className="research-form">{Object.entries(fields).map(([key,label])=><label key={key}>{label}<input type="number" min={key==='capacity'?1:0} step={key==='capacity'?1:'any'} value={values[key as keyof typeof values]} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}</div>
 <div className="calculator-result" aria-live="polite">{!complete?<p>Fill in all five assumptions to calculate break-even. Enter 0 for a cost that does not apply.</p>:!result?<p>Use finite, nonnegative amounts, a positive price, and a positive whole-number capacity.</p>:result.customers===null?<p>Break-even is not reachable: price must exceed variable cost per customer.</p>:<><h3>{result.customers.toLocaleString()} customers to break even</h3><p>{result.occupancy!.toFixed(1)}% of capacity · {currency} {result.fixed.toLocaleString()} monthly fixed costs</p>{result.occupancy!>100&&<p className="error">Break-even exceeds your entered capacity. Review costs, pricing, or capacity.</p>}<p>Contribution per customer: {currency} {result.margin.toLocaleString()}.</p></>}</div>
 <button className="secondary" onClick={()=>setValues(initial)}>Reset assumptions</button><details><summary>Calculation and assumptions</summary><p>Customers = ceiling((rent + other fixed costs) ÷ (price − variable cost)). Occupancy = customers ÷ capacity × 100. All inputs cover one month; include applicable taxes, salaries, financing, and other costs in your assumptions. This simple operating calculation excludes any cost you have not entered and does not estimate market demand or investment payback.</p></details></section>;
}
