import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ScoringPriorities} from './ScoringPriorities';
import type {Report,ScoreKey,Section} from '../types/analysis';
import {CompetitorExplorer} from './CompetitorExplorer';
import {EvidenceStrength} from './EvidenceStrength';
import {DemandChart} from './DemandChart';
import {ReviewMatrix,KeywordFinder,Seasonality} from './MarketResearch';
import {BreakEven} from './BreakEven';
import {ResearchNotebook} from './ResearchNotebook';
import '../styles/research.css';
import {HoursGaps,BrandCompetition,ReputationChanges} from './CompetitionTools';
import {RelevanceReview} from './RelevanceReview';
import {SearchUsagePanel} from './SearchPlanner';
import {OpportunityStress} from './OpportunityStress';
import {AreaExplorer} from './AreaExplorer';
import {ConceptSandbox} from './ConceptSandbox';
import {ValidationLab} from './ValidationLab';
import {DecisionJournal} from './DecisionJournal';

const labels:Record<ScoreKey,string>={demand:'Demand',competition_gap:'Competition gap',unmet_need:'Unmet need',market_momentum:'Market momentum',advertising_gap:'Advertising gap'};
const sectionFor:Record<ScoreKey,string>={demand:'trends',competition_gap:'maps',unmet_need:'reviews',market_momentum:'news',advertising_gap:'ads'};
export function External({url,children}:{url:string|null;children:React.ReactNode}){return url&&/^https?:\/\//i.test(url)?<a href={url} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a>:<span>{children}</span>}
const date=(value:string|null)=>value?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Date unavailable';
function Status({section}:{section:Section}){return <span className={`status ${section.status}`}>{section.status==='complete'?`${section.count} observations`:section.status}</span>}
function Source({children}:{children:React.ReactNode}){return <p className="source">Source: {children}</p>}

export function ReportView({report:r}:{report:Report}){
 const [shared,setShared]=useState('');
 async function share(){try{await navigator.clipboard.writeText(window.location.href);setShared('Link copied')}catch{setShared('Copy this page’s URL from your address bar')}}
 return <>
  <div className="report-heading"><div><p className="muted">Market report · {date(r.created_at)}</p><h1>{r.input.business_category}<span className="location">{r.input.city}, {r.input.country}</span></h1></div><div className="report-actions"><Link className="secondary" to={`/compare?left=${encodeURIComponent(r.id)}`}>Compare report</Link><button className="secondary" onClick={share}>Copy report link</button></div><span role="status">{shared}</span></div>
  {r.relevance_audit&&<div className="notice"><strong>Revised evidence selection</strong> · This report excludes user-selected results. <Link to={`/reports/${r.relevance_audit.source_report_id}`}>View the source report</Link> or <a href="#relevance-review">inspect the exclusion record</a>.</div>}
  {r.data_mode==='fixture'&&<div className="sample-banner"><strong>Sample report</strong> · Synthetic observations for interface testing. These scores are not evidence about the real Pune market. Sample sources are illustrative.</div>}
  {r.warnings.filter(w=>!w.startsWith('Sample report')).length>0&&<details className="warnings" open><summary>Data notes ({r.warnings.filter(w=>!w.startsWith('Sample report')).length})</summary><ul>{r.warnings.filter(w=>!w.startsWith('Sample report')).map(w=><li key={w}>{w}</li>)}</ul></details>}
  <section className="score-hero" aria-labelledby="result-heading"><div className="score-dial"><span className="big-score">{r.overall_score}</span><span>/ 100 opportunity</span></div><div className="score-copy"><span className="pill">{r.interpretation}</span><h2 id="result-heading">{r.recommendation.headline}</h2><p>Search signals support research. Validate with customer interviews and financial analysis before committing resources.</p><a href="#methodology">How this score is calculated</a></div><div className="confidence"><strong>{r.confidence_score}<small>/100</small></strong><span>{r.confidence_label} confidence</span><p>Data completeness,<br/>not business certainty.</p></div></section>
  <section className="report-section" aria-label="Recommendation"><div className="recommendation-grid">{([['Relative strengths',r.recommendation.strengths],['Areas to validate',r.recommendation.risks],['Next checks',r.recommendation.next_checks]] as const).map(([title,items])=><div key={title}><h3>{title}</h3>{items.length?<ul>{items.map((i,n)=><li key={n}><a href={i.href}>{i.text}</a></li>)}</ul>:<p className="muted">Insufficient evidence for this comparison.</p>}</div>)}</div></section>
  <section className="report-section"><div className="section-heading"><h2>What drives the score</h2><a href="#evidence-strength">Check evidence strength</a></div><div className="score-breakdown">{(Object.keys(labels) as ScoreKey[]).map(key=><a href={`#${key}`} key={key} className="component"><div><span>{labels[key]}</span><strong>{r.component_scores[key].toFixed(0)}</strong></div><meter min={0} max={100} value={r.component_scores[key]} aria-label={`${labels[key]} score`}/><span className="hint">{r.methodology.weights[key]*100}% weight · {r.sections[sectionFor[key]].status==='complete'?'Available evidence':'Neutral fallback'}</span></a>)}</div></section>
  <EvidenceStrength report={r}/>
  <section className="report-section"><h2>Turn evidence into a venture plan</h2><p>Connect findings, investigate conflicts, collaborate and prepare an evidence-backed pitch.</p><Link className="primary" to={`/reports/${r.id}/strategy`}>Open decision workspace</Link></section>
  <section className="report-section"><h2>Research beyond the core report</h2><p>Explore travel times, forum questions, search suggestions, events, jobs, product prices, hotels, flights, visual examples and scholarly research.</p><Link className="primary" to={`/reports/${r.id}/research`}>Explore 10 data sources</Link><p className="hint">Run each source when you need it. Request estimates and saved results are available in the research workspace.</p></section>
  <nav className="research-nav" aria-label="Opportunity experiments"><a href="#opportunity-stress">Stress test</a><a href="#area-explorer">Service areas</a><a href="#concept-sandbox">Concept sandbox</a><a href="#validation-lab">Validation lab</a><a href="#decision-journal">Decision journal</a></nav>
  <OpportunityStress key={`stress-${r.id}`} report={r}/>
  <AreaExplorer key={`areas-${r.id}`} report={r}/>
  <ConceptSandbox key={`concept-${r.id}`} report={r}/>
  <ValidationLab key={`lab-${r.id}`} report={r}/>
  <DecisionJournal key={`journal-${r.id}`} report={r}/>
  <nav className="research-nav" aria-label="Market validation tools"><a href="#hours-gaps">Opening-hours gaps</a><a href="#brand-competition">Brand concentration</a><a href="#reputation-changes">Reputation changes</a><a href="#relevance-review">Review relevance</a><a href="#search-usage">Search usage</a></nav>
  <HoursGaps key={`hours-${r.id}`} report={r}/>
  <BrandCompetition key={`brands-${r.id}`} report={r}/>
  <ReputationChanges report={r}/>
  <RelevanceReview key={`relevance-${r.id}`} report={r}/>
  <SearchUsagePanel usage={r.search_usage}/>
  <nav className="research-nav" aria-label="Research tools"><a href="#review-matrix">Strengths and weaknesses</a><a href="#break-even">Break-even calculator</a><a href="#keyword-opportunities">Keyword opportunities</a><a href="#seasonality">Seasonality</a><a href="#notebook">Notebook</a></nav>
  <ReviewMatrix report={r}/>
  <BreakEven key={`calculator-${r.id}`}/>
  <KeywordFinder key={`keywords-${r.id}`} report={r}/>
  <Seasonality key={`season-${r.id}`} report={r}/>
  <ResearchNotebook key={`notes-${r.id}`} report={r}/>
  <ScoringPriorities key={r.id} report={r}/>
  <CompetitorExplorer key={`explorer-${r.id}`} report={r}/>
  <section className="report-section" id="demand"><div className="section-heading"><div><h2>Demand over time</h2><p>Country-level interest in {r.input.country}; keyword wording carries the city intent.</p></div><Status section={r.sections.trends}/></div><DemandChart series={r.trend_series}/><Source>Google Trends via SerpApi · one year requested</Source></section>
  <section className="report-section" id="unmet_need"><div className="section-heading"><div><h2>Where customers see room to improve</h2><p>Topics in sampled 1–3 star reviews from up to three competitors.</p></div><Status section={r.sections.reviews}/></div>{r.review_topics.length?<div className="topic-grid">{r.review_topics.map(t=><article className="topic" key={t.topic}><div className="section-heading"><h3>{t.topic}</h3>{t.repeated&&<span className="pill">Repeated</span>}</div><p className="muted">{t.mentions} mentions · {t.competitor_count} competitors</p>{t.excerpts.map((e,i)=><blockquote key={i}><p>“{e.text||'Rating only; no review text returned.'}”</p><footer><External url={e.source_url}>{e.competitor}</External> · {e.rating}/5 · {date(e.published_at)}{!e.source_url&&' · Direct review link unavailable'}</footer></blockquote>)}</article>)}</div>:<p className="empty">No complaint topics are available from this sample.</p>}<Source>Google Maps Reviews via SerpApi. One recent page per selected competitor; not a representative customer survey.</Source></section>
  <section className="report-section" id="market_momentum"><div className="section-heading"><div><h2>Market developments</h2><p>Exact keyword matches and dates determine the news signal.</p></div><Status section={r.sections.news}/></div>{r.news.length?<div className="news-list">{r.news.map((n,i)=><article key={i}><div><span className={`sentiment ${n.sentiment}`}>{n.sentiment}</span><span className="muted">{n.source} · {date(n.published_at)}</span></div><h3><External url={n.source_url}>{n.title}</External></h3>{n.snippet&&<p>{n.snippet}</p>}<p className="hint">Matched: {n.matched_keywords.join(', ')||'none'} · Recency weight: {n.weight}</p></article>)}</div>:<p className="empty">Market news is unavailable. Momentum uses a neutral score.</p>}<Source>Google News via SerpApi. Keyword classification can miss context and negation.</Source></section>
  <section className="report-section" id="advertising_gap"><div className="section-heading"><div><h2>Visible advertising activity</h2><p>Matched advertiser creatives; worldwide coverage, not local spend.</p></div><Status section={r.sections.ads}/></div>{r.advertising.length?<div className="table-scroll"><table><thead><tr><th>Advertiser</th><th>Format</th><th>First shown</th><th>Last shown</th><th>Evidence</th></tr></thead><tbody>{r.advertising.map((a,i)=><tr key={i}><td>{a.advertiser}</td><td>{a.format||'Unavailable'}</td><td>{date(a.first_shown)}</td><td>{date(a.last_shown)}</td><td><External url={a.source_url}>{a.source_url?'View creative':'Link unavailable'}</External></td></tr>)}</tbody></table></div>:<p className="empty">No reliable active advertiser match is available. A neutral score does not imply low advertising competition.</p>}<Source>Google Ads Transparency Center via SerpApi · up to three advertiser searches</Source></section>
  <section className="report-section" id="evidence"><div className="section-heading"><h2>Evidence register</h2><span className="muted">Retrieved {date(r.created_at)}</span></div><details><summary>Inspect {r.evidence.length} source records</summary><ol className="evidence-list">{r.evidence.map(e=><li key={e.id}><External url={e.source_url}>{e.title}</External><span className="hint">{e.source_name} · {date(e.published_at)}{!e.source_url&&' · Direct source link unavailable'}</span></li>)}</ol></details></section>
  <section className="report-section methodology" id="methodology"><h2>Methodology & limitations</h2><p>Version {r.methodology_version} · deterministic rules · no generative AI</p><details open><summary>Overall score and confidence</summary><p>Opportunity = demand × 25% + competition gap × 25% + unmet need × 25% + market momentum × 15% + advertising gap × 10%, rounded to the nearest integer. Missing components keep their weights and use neutral 50.</p><p>{r.methodology.confidence_rule}</p><dl className="confidence-points">{Object.entries(r.methodology.confidence_points).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v} points</dd></div>)}</dl><p>75–100: Strong signals. 55–74: Mixed-positive. 40–54: Mixed. 0–39: Weak signals.</p></details>{(Object.keys(labels) as ScoreKey[]).map(k=><details key={k}><summary>{labels[k]} · {r.component_scores[k]}/100</summary><p>{r.methodology.components[k].formula}</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(r.methodology.components[k]).filter(([name])=>name!=='formula')),null,2)}</pre></details>)}<p className="limitation">Search visibility is not market size. Reviews are a small, biased sample. Trends are relative interest, news matching is heuristic, and advertising matches can be incomplete. Scores do not estimate revenue, profitability, or probability of success.</p></section>
 </>
}
