/* One continuous flight through an authored clear-air corridor. The camera is
 * evaluated from progress, never accumulated state, so backward scroll is exact. */
import {T,V,ease} from './flight-kit.js';

const clamp=x=>Math.max(0,Math.min(1,x));
export const CRM_GEOGRAPHY={
 archive:[-140,0,-15],launch:[-143,7.4,-4],context:[-20,24,58],review:[112,44,-28],reply:[226,80,-80],
};
function smoothTrack(keys,p){
 let i=0;while(i<keys.length-2&&p>keys[i+1].p)i++;
 const a=keys[i],b=keys[i+1],before=keys[Math.max(0,i-1)],after=keys[Math.min(keys.length-1,i+2)];
 const dt=b.p-a.p,u=clamp((p-a.p)/dt),u2=u*u,u3=u2*u;
 const result=V();
 for(let axis=0;axis<3;axis++){
  const va=(b.v[axis]-before.v[axis])/(b.p-before.p),vb=(after.v[axis]-a.v[axis])/(after.p-a.p);
  result.setComponent(axis,(2*u3-3*u2+1)*a.v[axis]+(u3-2*u2+u)*dt*va+(-2*u3+3*u2)*b.v[axis]+(u3-u2)*dt*vb);
 }
 return result;
}

export function createCorrespondenceFlight(){
 const outbound=new T.CurvePath();
 outbound.add(new T.CubicBezierCurve3(V(-143,11.2,3),V(-142,14,27),V(-128,-10,66),V(-95,1,76)));
 outbound.add(new T.CubicBezierCurve3(V(-95,1,76),V(-62,12,86),V(-37,33,104),V(-20,37,82)));
 outbound.add(new T.CubicBezierCurve3(V(-20,37,82),V(-3,41,60),V(55,66,31),V(87,58,5)));
 outbound.add(new T.CubicBezierCurve3(V(87,58,5),V(119,50,-21),V(112,48.6,-10),V(112,48.6,-28)));
 // Leave the glasshouse through its open end before banking. The straight exit
 // gives the complete wingspan room between the roof and the cliff face.
 const ascent=new T.CurvePath();
 ascent.add(new T.LineCurve3(V(112,48.6,-28),V(112,48.6,-40.5)));
 ascent.add(new T.CubicBezierCurve3(V(112,48.6,-40.5),V(112,48.6,-46.023),V(116.477,48.6,-50.5),V(122,48.6,-50.5)));
 ascent.add(new T.CubicBezierCurve3(V(122,48.6,-50.5),V(142,48.6,-50.5),V(161,64,-13),V(182,78,-20)));
 ascent.add(new T.CubicBezierCurve3(V(182,78,-20),V(203,92,-27),V(215,90,-38),V(226,90,-56)));
 for(const curve of [outbound,ascent]){curve.arcLengthDivisions=1800;curve.updateArcLengths();}
 const cameraKeys=[
  {p:0,v:[16,11,23]},{p:.13,v:[-12,13,24]},{p:.25,v:[-20,13,30]},
  {p:.38,v:[-22,16,33]},{p:.48,v:[12,16,24]},{p:.53,v:[10,15,16]},{p:.66,v:[10,15,16]},
  {p:.73,v:[16,13,8]},{p:.79,v:[18,12,-4]},{p:.87,v:[-16,16,28]},{p:1,v:[-18,15,34]},
 ];
 const lensKeys=[{p:0,v:[43,0,0]},{p:.16,v:[54,0,0]},{p:.3,v:[49,0,0]},{p:.4,v:[55,0,0]},{p:.53,v:[40,0,0]},{p:.68,v:[40,0,0]},{p:.84,v:[53,0,0]},{p:1,v:[48,0,0]}];
 function pose(progress){
  const p=clamp(progress),depart=p>.70,holding=p>=.53&&p<=.70;
  // CurvePath already maps its parameter by segment arc length. Clamp the
  // eased result against floating-point overshoot at the review boundary.
  const curve=depart?ascent:outbound,u=clamp(depart?ease((p-.70)/.30):ease(p/.53));
  const position=holding?V(112,48.6,-28):curve.getPoint(u);
  const tangent=holding?V(0,0,-1):curve.getTangent(u).normalize();
  // Coordinate the bank with the upcoming turn; keep its entry and exit level.
  const before=curve.getTangent(clamp(u-.05)),after=curve.getTangent(clamp(u+.05));
  const yawChange=Math.atan2(before.z*after.x-before.x*after.z,before.x*after.x+before.z*after.z);
  const turnEnvelope=ease(u/.08)*(1-ease((u-.87)/.13));
  const bank=holding?0:Math.tanh(yawChange*1.8)*.62*turnEnvelope;
  const pitch=Math.asin(T.MathUtils.clamp(tangent.y,-1,1));
  const heading=Math.atan2(-tangent.x,-tangent.z);
  const quaternion=new T.Quaternion().setFromEuler(new T.Euler(pitch,heading,bank,'YXZ'));
  return {position,tangent,quaternion,bank,pitch,holding,u};
 }
 function camera(p){
  const state=pose(p),target=state.position.clone().add(V(0,.35,0));
  const lookAhead=9*ease((p-.12)/.1)*(1-ease((p-.38)/.12));
  target.addScaledVector(state.tangent,lookAhead).addScaledVector(V(0,7,-4),ease((p-.9)/.1));
  const offset=smoothTrack(cameraKeys,p),normal=V();
  // Authored look-ahead over a short interval, independent of frame history.
  // This retains the turn without flicking the camera at a change in curvature.
  for(let i=-3;i<=3;i++)normal.addScaledVector(V(0,1,0).applyQuaternion(pose(clamp(p+i*.004)).quaternion),4-Math.abs(i));
  normal.normalize();
  // Lift the tracking camera toward the paper's upper face during a steep bank.
  // A smooth positive part avoids a camera kink when this correction engages.
  const deficit=offset.length()*.65-offset.dot(normal);
  offset.addScaledVector(normal,(deficit+Math.sqrt(deficit*deficit+.16))*.5);
  const eye=target.clone().add(offset);
  // At the context pickup, portrait needs to show the station and the letter
  // together. Orbit toward the tower instead of simply shrinking the subject.
  const reveal=ease((p-.21)/.035)*(1-ease((p-.275)/.045));
  const portraitTarget=target.clone().lerp(V(-20,32,63),.4*reveal);
  const pickupOffset=offset.clone();pickupOffset.x=-8;pickupOffset.setLength(offset.length());
  const portraitEye=portraitTarget.clone().add(offset.clone().lerp(pickupOffset,reveal));
  return {eye,target,portraitEye,portraitTarget,fov:smoothTrack(lensKeys,p).x,roll:-state.bank*.19};
 }
 return {pose,camera};
}
