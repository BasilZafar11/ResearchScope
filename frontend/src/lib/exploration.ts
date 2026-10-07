import type {Competitor} from '../types/analysis';
export type Point=[number,number];
const rad=Math.PI/180;
export function usablePoint(p:Point){return p.every(Number.isFinite)&&Math.abs(p[0])<=85&&Math.abs(p[1])<=180}
function project(points:Point[]){
 const [lat,lon]=points[0];
 return points.map(([a,b])=>[(b-lon)*rad*6371*Math.cos(lat*rad),(a-lat)*rad*6371] as Point);
}
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function onSegment(a:Point,b:Point,p:Point){return Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9}
function intersects(a:Point,b:Point,c:Point,d:Point){return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b)}
export function polygonArea(points:Point[]){
 if(points.length<3||points.length>20||points.some(p=>!usablePoint(p)))return null;
 const projected=project(points),n=points.length;
 if(projected.some(p=>Math.hypot(...p)>100))return null;
 for(let i=0;i<n;i++){
  if(Math.hypot(projected[i][0]-projected[(i+1)%n][0],projected[i][1]-projected[(i+1)%n][1])<.001)return null;
  for(let j=i+1;j<n;j++)if(j!==i+1&&!(i===0&&j===n-1)&&intersects(projected[i],projected[(i+1)%n],projected[j],projected[(j+1)%n]))return null;
 }
 const area=Math.abs(projected.reduce((sum,p,i)=>sum+p[0]*projected[(i+1)%n][1]-projected[(i+1)%n][0]*p[1],0))/2;
 return area>=.01?area:null;
}
export function insidePolygon(point:Point,polygon:Point[]){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i];
  if(onSegment(a,b,point))return true;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function areaSummary(points:Point[],places:Competitor[]){
 const area=polygonArea(points);
 const mapped=places.filter(p=>p.latitude!==null&&p.longitude!==null&&usablePoint([p.latitude,p.longitude]));
 const members=area===null?[]:mapped.filter(p=>insidePolygon([p.latitude!,p.longitude!],points));
 return {area,members,missing:places.length-mapped.length,density:area===null?null:members.length/area};
}
export function outcome(target:number,required:number,completed:number,positive:number){
 if(completed<target)return 'Still collecting responses';
 return positive/completed>=required/target?'Success criterion met':'Success criterion not met';
}
