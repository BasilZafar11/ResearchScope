export function normalizedCondition(value:string,kind:string) {
  const cleaned=value.trim().toLowerCase().replace(/\s+/g,' ');
  if(kind==='evaluation metric')return cleaned.replace(/^f[ -]?1(?: score)?$/,'f1').replace(/^accuracy(?: score)?$/,'accuracy');
  if(!['compute budget','tuning budget'].includes(kind))return cleaned;
  const match=cleaned.match(/^(\d+(?:\.\d+)?)\s*(gpu|cpu)?\s*(seconds?|secs?|s|minutes?|mins?|min|hours?|hrs?|h)$/);
  if(!match)return cleaned;
  const unit=match[3],factor=/^(h|hour|hr)/.test(unit)?3600:/^(m|min)/.test(unit)?60:1;
  return (match[2]||'wall')+' seconds:'+Number((Number(match[1])*factor).toFixed(6));
}
export function dependencyProblem(tasks:{id:string;dependsOn:string[];status:string}[],id:string,dependencies:string[]) {
  const lookup=new Map(tasks.map(task=>[task.id,task]));
  if(dependencies.includes(id))return 'A task cannot depend on itself.';
  for(const dependency of dependencies){if(!lookup.has(dependency))return 'A selected dependency no longer exists.';const seen=new Set<string>();const visit=(target:string):boolean=>{if(target===id)return true;if(seen.has(target))return false;seen.add(target);return (lookup.get(target)?.dependsOn||[]).some(visit);};if(visit(dependency))return 'This dependency would create a cycle.';}
  return '';
}
