/* Product-specific cinematic worlds. Each builder owns its setting, physical
 * action, camera language and light. Only CRM retains the aerial letter story. */
import {THREE as T,RoomEnvironment,EffectComposer,RenderPass,SSAOPass,UnrealBloomPass,OutputPass,ShaderPass,FXAAShader} from './three-runtime.js';
import {createFlightKit,V} from './flight-kit.js';
import {experienceEditorial} from './experience-editorial.js';
import {experienceOperations} from './experience-operations.js';
import {experienceIntelligence} from './experience-intelligence.js';

const films={...experienceEditorial,...experienceOperations,...experienceIntelligence};
const noise=`
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.54+noise(p*2.04)*.27+noise(p*4.13)*.13+noise(p*8.07)*.06;}
`;

function atmosphere(scene,kind,cloudLayers=true){
 const storm=kind==='shield',skyTop=new T.Color(storm?'#253c51':kind==='crystal'?'#5a697b':'#568391');
 const skyLow=new T.Color(storm?'#bea78e':'#e3c694');
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:skyTop},low:{value:skyLow}},vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 world;uniform vec3 top;uniform vec3 low;${noise}
void main(){vec3 d=normalize(world-cameraPosition);float h=smoothstep(-.22,.7,d.y);vec3 col=mix(low,top,h);float s=max(dot(d,normalize(vec3(-.75,.26,-.55))),0.);col+=vec3(1.,.67,.29)*(pow(s,64.)*.32+pow(s,1300.)*3.);float c=fbm(vec3(d.xz*7.,d.y*3.+5.));float cover=smoothstep(.46,.72,c)*(1.-smoothstep(.1,.65,d.y));col=mix(col,vec3(.89,.86,.76),cover*.58);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const sky=new T.Mesh(new T.SphereGeometry(600,32,16),skyMaterial);sky.frustumCulled=false;scene.add(sky);
 const uniforms={uTime:{value:0},uStorm:{value:storm?1:0},uOpacity:{value:.82}};
 const sea=new T.ShaderMaterial({uniforms,transparent:true,side:T.DoubleSide,depthWrite:false,vertexShader:`uniform float uTime;varying vec3 world;${noise}void main(){vec3 p=position;float h=fbm(vec3(p.xy*.027,1.));p.z+=(h-.5)*8.;world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec3 world;uniform float uTime;uniform float uStorm;uniform float uOpacity;${noise}
void main(){vec3 p=world*.035+vec3(uTime*.002,0.,uTime*.001);float n=fbm(p),detail=fbm(p*3.1);float density=smoothstep(.26,.68,n*.75+detail*.25);vec3 shadow=mix(vec3(.29,.39,.48),vec3(.19,.26,.34),uStorm);vec3 lit=vec3(.9,.72,.52);vec3 col=mix(shadow,lit,smoothstep(.28,.76,n));float farFade=1.-smoothstep(220.,300.,length(world.xz-vec2(0.,-55.)));gl_FragColor=vec4(col,uOpacity*density*farFade);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
 for(let i=0;i<(cloudLayers?5:0);i++){
  const cloud=new T.Mesh(new T.PlaneGeometry(620,620,70,70),sea);cloud.rotation.x=-Math.PI/2;cloud.position.set(i*9,-20-i*3.2,-70+i*13);cloud.renderOrder=1-i;cloud.frustumCulled=false;scene.add(cloud);
 }
 return {hide(){sky.visible=false;uniforms.uOpacity.value=.42;scene.children.filter(o=>o.material===sea).forEach((o,i)=>{o.position.y=-94-i*9;o.visible=i<3;});},update(time,eye){uniforms.uTime.value=time;sky.position.copy(eye);}};
}

export function createExperienceRenderer(canvas,kind,accent){
 if(!films[kind])return null;let renderer;
 try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch{return null;}
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();
 const camera=new T.PerspectiveCamera(44,1,.12,1200),root=new T.Group();scene.add(root);
 const w=createFlightKit(root,new T.Color(accent));
 const film=films[kind](w),mood=film.environment||{},outdoor=Boolean(mood.outdoor),usesSkyPanorama=kind==='network'&&outdoor;
 scene.background=new T.Color(mood.background||'#171b1a');
 scene.fog=new T.Fog(mood.fog||mood.background||'#171b1a',mood.fogNear||(outdoor?65:35),mood.fogFar||(outdoor?310:145));
 const air=outdoor?atmosphere(scene,kind,usesSkyPanorama):{update(){}};
 scene.add(new T.HemisphereLight(mood.fill||'#b4cbd2',mood.bounce||'#473c2e',mood.fillIntensity??.9));
 const sun=new T.DirectionalLight(mood.key||'#ffd4a0',mood.keyIntensity??3.05);sun.position.set(...(mood.keyPosition||[-55,85,38]));sun.target.position.set(0,8,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=46;sun.shadow.camera.bottom=-32;sun.shadow.camera.near=10;sun.shadow.camera.far=210;sun.shadow.bias=-.00035;sun.shadow.normalBias=.045;scene.add(sun,sun.target);
 const rim=new T.DirectionalLight(mood.rim||'#b4d8e3',mood.rimIntensity??.85);rim.position.set(...(mood.rimPosition||[25,35,-45]));scene.add(rim);
 const environment=new RoomEnvironment();const pmrem=new T.PMREMGenerator(renderer);const envTarget=pmrem.fromScene(environment,.04);scene.environment=envTarget.texture;scene.environmentIntensity=.38;environment.dispose();pmrem.dispose();
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const occlusion=new SSAOPass(scene,camera,1,1,12);occlusion.kernelRadius=1.2;occlusion.minDistance=.001;occlusion.maxDistance=.065;composer.addPass(occlusion);
 const bloom=new UnrealBloomPass(new T.Vector2(1,1),.19,.6,1.65);composer.addPass(bloom);
 const aa=new ShaderPass(FXAAShader);composer.addPass(aa);composer.addPass(new OutputPass());
 let disposed=false,width=0,height=0,pixelRatio=1,skyTexture=null;
 canvas.dataset.environment=usesSkyPanorama?'loading':'ready';
 if(usesSkyPanorama)new T.TextureLoader().load('/basalt-flight/aerial-world-v1.png',texture=>{
  if(disposed){texture.dispose();return;}skyTexture=texture;texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;
  scene.background=texture;scene.backgroundIntensity=kind==='shield'?.62:.82;scene.backgroundRotation.y=.4;
  scene.environment=texture;scene.environmentIntensity=.55;scene.environmentRotation.y=.4;air.hide();canvas.dataset.environment='ready';
  window.dispatchEvent(new Event('basalt-marketing-motion'));
 },undefined,()=>{if(!disposed)canvas.dataset.environment='procedural';});
 canvas.dataset.engine='basalt-world-cinema';canvas.dataset.accent=accent;
 const materials=new Set(Object.values(w.materials));
 return {
  render(progress,time,reduced){
   if(disposed)return[];const bounds=canvas.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return[];
   if(width!==bounds.width||height!==bounds.height){
    width=bounds.width;height=bounds.height;const maxPixels=width<750?650000:1700000;
    pixelRatio=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(maxPixels/(width*height)));
    renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);composer.setPixelRatio(pixelRatio);composer.setSize(width,height);aa.uniforms.resolution.value.set(1/(width*pixelRatio),1/(height*pixelRatio));
    camera.aspect=width/height;
   }
   const p=T.MathUtils.clamp(progress,0,1),t=reduced?0:time;
   film.update(p,t);const rail=window.__BASALT_SCENE_AUDIT__&&Number.isFinite(window.__BASALT_REVIEW_RAIL__)?T.MathUtils.clamp(window.__BASALT_REVIEW_RAIL__,0,1):p;
   const shot=film.camera(rail),eye=shot.eye.clone(),target=shot.target.clone();
   // The aerial route crosses several distant landmarks. Move the directional
   // shadow volume with the subject without changing the sun's world direction.
   if(mood.followSun){sun.target.position.copy(target);sun.position.copy(target).add(V(...(mood.keyPosition||[-55,85,38])));}
   const portrait=width<750&&height>width;
   if(portrait&&shot.portraitEye)eye.copy(shot.portraitEye);
   if(portrait&&shot.portraitTarget)target.copy(shot.portraitTarget);
   if(portrait){eye.sub(target).multiplyScalar(mood.portraitDistance??1.3).add(target);}
   camera.position.copy(eye);camera.fov=(shot.fov||44)+(portrait?9:0);camera.up.set(0,1,0);camera.lookAt(target);camera.rotateZ(shot.roll||0);
   // A lens shift leaves the full world visible behind the editorial copy.
   // Vertical composition lifts the hero above mobile text without cropping it.
   camera.setViewOffset(width,height,portrait?0:-width*.18,portrait?height*.2:height*.025,width,height);
   camera.updateProjectionMatrix();occlusion.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);occlusion.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);air.update(t,eye);
   renderer.info.autoReset=false;renderer.info.reset();composer.render();
   canvas.dataset.pose=JSON.stringify([p,...eye.toArray(),...target.toArray(),camera.fov]);
   canvas.dataset.drawCalls=String(renderer.info.render.calls);
   if(window.__BASALT_SCENE_AUDIT__)canvas.dataset.experience=JSON.stringify({kind,chapter:Math.min(3,Math.round(p*3)),progress:p,stage:film.stages[Math.min(3,Math.round(p*3))],title:film.title,eye:eye.toArray(),target:target.toArray(),resolution:[canvas.width,canvas.height],triangles:renderer.info.render.triangles,...w.narrative});
   return[];
  },
  dispose(releaseContext=true){
   if(disposed)return;disposed=true;const geometries=new Set(),textures=new Set();
   scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
   for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
   for(const g of geometries)g.dispose();for(const t of textures)t.dispose();skyTexture?.dispose();envTarget.dispose();
   // The bundled pass disposers omit these three GPU resources.
   occlusion.ssaoMaterial.dispose();occlusion.noiseTexture.dispose();bloom.materialHighPassFilter.dispose();
   for(const pass of composer.passes)pass.dispose?.();composer.dispose();sun.shadow.dispose();renderer.dispose();
   if(releaseContext&&!renderer.getContext().isContextLost())renderer.forceContextLoss();
  }
 };
}
