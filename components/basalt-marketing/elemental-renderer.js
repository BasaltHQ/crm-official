/* Landscape films: the GPU traces actual 3D geological fields, with no models,
 * illustrated billboards, or remote assets. Scroll owns terrain and camera. */
import {THREE as T} from './three-runtime.js';
import {elementalEditorial} from './elemental-editorial.js';
import {elementalIntelligence} from './elemental-intelligence.js';
import {elementalOperations} from './elemental-operations.js';

const films={...elementalEditorial,...elementalIntelligence,...elementalOperations};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const v=a=>new T.Vector3(...a);
const common=`
uniform vec2 uResolution;uniform vec2 uOffset;
uniform vec3 uEye;uniform vec3 uTarget;uniform vec3 uAccent;uniform vec3 uMist;
uniform float uFov;uniform float uProgress;uniform float uTime;uniform float uDetail;
varying vec2 vUv;
float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise3(p)*.57+noise3(p*2.03+7.1)*.28+noise3(p*4.11-9.3)*.15;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float phase(float a,float b){float t=clamp((uProgress-a)/(b-a),0.,1.);return t*t*t*(t*(t*6.-15.)+10.);}
`;
const light=`
vec3 sky(vec3 rd){
 float h=pow(clamp(rd.y*.5+.5,0.,1.),.6);
 vec3 horizon=mix(vec3(.095,.073,.055),uAccent*.1,.17);
 vec3 zenith=mix(vec3(.012,.023,.032),uAccent*.03,.2);
 vec3 col=mix(horizon,zenith,h);
 vec3 sun=normalize(vec3(-.65,.42,-.8));float a=max(dot(rd,sun),0.);
 col+=vec3(1.,.66,.33)*pow(a,64.)*.14+vec3(1.,.82,.58)*pow(a,900.)*.65;
 return col;
}
vec3 normalAt(vec3 p,float distance){
 float e=max(.006,distance*.00028);vec2 k=vec2(1.,-1.);
 return normalize(k.xyy*mapScene(p+k.xyy*e).x+k.yyx*mapScene(p+k.yyx*e).x+k.yxy*mapScene(p+k.yxy*e).x+k.xxx*mapScene(p+k.xxx*e).x);
}
float shadowAt(vec3 p,vec3 light){
 float result=1.,t=.12;
 for(int i=0;i<12;i++){float h=mapScene(p+light*t).x;result=min(result,12.*h/t);t+=clamp(h,.16,1.4);if(result<.04)break;}
 return clamp(result,.08,1.);
}
vec3 shade(vec3 p,vec3 n,vec3 rd,float mat,float distance){
 if(mat<2.5){
  float texture=noise3(p*9.);
  vec3 grain=vec3(noise3(p*9.+vec3(.17,0,0)),noise3(p*9.+vec3(0,.17,0)),noise3(p*9.+vec3(0,0,.17)))-texture;
  n=normalize(n+(grain-n*dot(grain,n))*uDetail);
 }else{
  n=normalize(n+vec3(sin(p.x*4.2+p.z*2.3+uTime*.45),0.,cos(p.z*5.5-p.x*1.2-uTime*.32))*.025);
 }
 vec3 sun=normalize(vec3(-.65,.72,.58)),albedo=sceneColor(p,mat,n);
 float ndl=max(dot(n,sun),0.),sh=shadowAt(p+n*.08,sun);
 float occ=1.;occ-=max(0.,.2-mapScene(p+n*.2).x)*.7;occ-=max(0.,.7-mapScene(p+n*.7).x)*.27;occ=clamp(occ,.48,1.);
 vec3 bounce=mix(vec3(.045,.046,.043),vec3(.16,.205,.23),n.y*.5+.5);
 vec3 color=albedo*(bounce*occ+vec3(1.12,.91,.72)*ndl*sh*1.7);
 float fresnel=pow(1.-max(dot(n,-rd),0.),4.);
 if(mat>2.5){
  vec3 reflected=sky(reflect(rd,n));
  float ripples=sin(p.x*3.8+p.z*2.5+uTime*.62)*sin(p.z*5.1-p.x*.9-uTime*.41);
  float spec=pow(max(dot(reflect(-sun,n),-rd),0.),90.);
  color=mix(albedo*.68,reflected,.18+fresnel*.5)+vec3(1.,.86,.63)*spec*sh*.45+uAccent*.014*ripples;
 }else{
  float spec=pow(max(dot(reflect(-sun,n),-rd),0.),mat>.5?32.:12.);
  color+=vec3(.58,.66,.67)*spec*sh*(mat>.5?.25:.07)+uAccent*fresnel*.06;
 }
 if(mat>1.5&&mat<2.5)color+=albedo*2.2;
 float mist=1.-exp(-distance*.0045);
 return mix(color,sky(rd)*.72,mist);
}
void main(){
 vec2 uv=vUv*2.-1.-uOffset;uv.x*=uResolution.x/uResolution.y;
 vec3 forward=normalize(uTarget-uEye),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
 vec3 rd=normalize(forward+tan(uFov*.00872664626)*(uv.x*right+uv.y*up));
 float distance=.12,mat=0.;bool hit=false;vec3 p=uEye;
 for(int i=0;i<152;i++){
  p=uEye+rd*distance;vec2 field=mapScene(p);
  if(field.x<max(.004,distance*.00035)){hit=true;mat=field.y;break;}
  distance+=max(field.x,.004);if(distance>120.)break;
 }
 // Shallow grazing rays may converge slowly on eroded height fields. Their
 // last surface estimate remains terrain; exposing the sky creates holes.
 if(!hit&&distance<120.){p=uEye+rd*distance;mat=mapScene(p).y;hit=true;}
 vec3 color=sky(rd);
 if(hit){vec3 n=normalAt(p,distance);color=shade(p,n,rd,mat,distance);}
 float extent=min(distance,90.);
 for(int j=0;j<8;j++){
  float t=(float(j)+.5)/8.*extent;vec3 cloudPoint=uEye+rd*t;
  float density=sceneDensity(cloudPoint)*extent/8.;
  color=mix(color,uMist*(.64+.36*noise3(cloudPoint*.13)),clamp(density,0.,.38));
 }
 // Subtle film grain breaks up long gradients without obscuring surface detail.
 color+=(hash3(vec3(gl_FragCoord.xy,0.))-.5)*.004;
 color*=1.-.15*pow(length(vUv-.5),1.5);
 gl_FragColor=vec4(max(color,vec3(0.)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;

export function createElementalRenderer(canvas,kind,accent){
 const film=films[kind];if(!film)return null;
 let renderer;
 try{renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});}catch{return null;}
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const uniforms={uResolution:{value:new T.Vector2(1,1)},uOffset:{value:new T.Vector2()},uEye:{value:new T.Vector3()},uTarget:{value:new T.Vector3()},uFov:{value:45},uProgress:{value:0},uTime:{value:0},uDetail:{value:kind==='wave'?.12:.5},uAccent:{value:new T.Color(accent)},uMist:{value:new T.Color(film.mistColor||'#a79d85')}};
 const density=film.glsl.includes('sceneDensity(')?'':'float sceneDensity(vec3 p){return 0.;}';
 const material=new T.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:common+film.glsl+density+light,depthWrite:false,depthTest:false});
 const geometry=new T.PlaneGeometry(2,2),scene=new T.Scene(),camera=new T.Camera();scene.add(new T.Mesh(geometry,material));
 const eyes=new T.CatmullRomCurve3(film.shots.map(s=>v(s.eye)),false,'centripetal');
 const targets=new T.CatmullRomCurve3(film.shots.map(s=>v(s.look)),false,'centripetal');
 let disposed=false,width=0,height=0;
 const pointer=new T.Vector2(),aim=new T.Vector2();
 const onPointer=event=>{const r=canvas.getBoundingClientRect();if(event.pointerType==='touch'||event.clientY<r.top||event.clientY>r.bottom){aim.set(0,0);return;}aim.set(clamp((event.clientX-r.left)/r.width)*2-1,1-clamp((event.clientY-r.top)/r.height)*2);};
 window.addEventListener('pointermove',onPointer,{passive:true});
 canvas.dataset.engine='basalt-elemental-field';canvas.dataset.accent=accent;
 return{
  render(progress,time,reduced){
   if(disposed)return[];
   const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return[];
   if(width!==r.width||height!==r.height){width=r.width;height=r.height;const maxPixels=width<=750?360000:1000000;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25,Math.sqrt(maxPixels/(width*height))));renderer.setSize(width,height,false);uniforms.uResolution.value.set(width,height);}
   const p=clamp(progress),cameraProgress=window.__BASALT_SCENE_AUDIT__&&Number.isFinite(window.__BASALT_REVIEW_RAIL__)?clamp(window.__BASALT_REVIEW_RAIL__):p;
   const i=Math.min(film.shots.length-2,Math.max(0,film.shots.findIndex((s,j)=>j<film.shots.length-1&&cameraProgress<=film.shots[j+1].p))),a=film.shots[i],b=film.shots[i+1],u=clamp((cameraProgress-a.p)/(b.p-a.p)),rail=(i+u)/(film.shots.length-1);
   const eye=eyes.getPoint(rail),target=targets.getPoint(rail),portrait=width<750&&height>width;
   if(portrait)eye.sub(target).multiplyScalar(1.18).add(target);
   if(reduced)pointer.set(0,0);else pointer.lerp(aim,.04);
   eye.x+=pointer.x*.16;eye.y+=pointer.y*.12;
   uniforms.uEye.value.copy(eye);uniforms.uTarget.value.copy(target);uniforms.uFov.value=T.MathUtils.lerp(a.fov||45,b.fov||45,smooth(u));
   uniforms.uOffset.value.set(portrait?0:.28,portrait?.32:0);uniforms.uProgress.value=p;uniforms.uTime.value=reduced?0:time;
   renderer.render(scene,camera);
   const chapter=Math.min(3,Math.round(p*3));
   canvas.dataset.pose=JSON.stringify([p,...eye.toArray(),...target.toArray(),uniforms.uFov.value]);
   canvas.dataset.drawCalls=String(renderer.info.render.calls);
   if(window.__BASALT_SCENE_AUDIT__){canvas.dataset.elemental=JSON.stringify({kind,chapter,progress:p,stage:film.stages[chapter],eye:eye.toArray(),target:target.toArray(),resolution:[canvas.width,canvas.height]});}
   return[];
  },
  dispose(){if(disposed)return;disposed=true;window.removeEventListener('pointermove',onPointer);geometry.dispose();material.dispose();renderer.dispose();}
 };
}
