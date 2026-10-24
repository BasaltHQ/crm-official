/* Product-owned places. CRM alone takes flight; Onyx is optical/mechanical,
 * CMS is a physical book whose composition unfolds under the reader's control. */
import {T,V,flightPath,batchArchitecture,makeArchive} from './flight-kit.js';
import {flightEditorial} from './flight-editorial.js';

const PI=Math.PI,TAU=PI*2,clamp=x=>Math.max(0,Math.min(1,x));
// Zero velocity and acceleration at each mechanical beat, including reversals.
const between=(p,a,b)=>{const x=clamp((p-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
const lerp=(a,b,t)=>a+(b-a)*t;
const ink='#233b34',ivory='#e9dfc7';
function print(w,width,height,draw,parent=w.root){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*height/width);const c=canvas.getContext('2d');draw(c,canvas.width,canvas.height);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
 return w.mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map,roughness:.83,side:T.DoubleSide}),parent);
}
function stock(c,x,y,color=ivory){c.fillStyle=color;c.fillRect(0,0,x,y);c.fillStyle='rgba(39,40,26,.045)';for(let i=0;i<1200;i++)c.fillRect((i*137.71)%x,(i*81.27)%y,1,2+i%3);}
function text(c,s,x,y,size=48,color=ink,font='Georgia'){c.fillStyle=color;c.font=`${size}px ${font}`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(s,x,y);}
function lines(c,x,y,width,count=5){c.fillStyle='#35443b';c.globalAlpha=.42;for(let i=0;i<count;i++)c.fillRect(x,y+i*18,width*(i===count-1?.7:1),2.5);c.globalAlpha=1;}
function art(c,x,y,width,height,tint='#8b7ba1'){
 c.save();c.beginPath();c.rect(x,y,width,height);c.clip();c.fillStyle='#d7d4bd';c.fillRect(x,y,width,height);c.fillStyle='#efbe7c';c.beginPath();c.arc(x+width*.72,y+height*.28,height*.22,0,TAU);c.fill();
 for(let n=0;n<4;n++){c.fillStyle=[tint,'#81927d','#4c725e','#29463c'][n];c.beginPath();c.moveTo(x,y+height);for(let i=0;i<=12;i++)c.lineTo(x+i*width/12,y+height*(.3+n*.16)+Math.sin(i*.8+n)*height*.12);c.lineTo(x+width,y+height);c.fill();}
 c.strokeStyle='#ede0b4';c.lineWidth=height*.018;c.beginPath();c.moveTo(x+width*.2,y+height);c.bezierCurveTo(x+width*.7,y+height*.77,x+width*.2,y+height*.6,x+width*.7,y+height*.42);c.stroke();c.restore();
}
function ring(w,r,tube,material,parent,position=V()){return w.mesh(new T.TorusGeometry(r,tube,10,96),material,parent,position);}
function plaque(w,label,width,parent,position=V(),bg='#283a33'){
 const m=print(w,width,.55,(c,cw,ch)=>{stock(c,cw,ch,bg);text(c,label,cw*.06,ch*.67,ch*.43,'#e8dbba','monospace');},parent);m.position.copy(position);return m;
}
function panel(w,width,height,draw,parent,depth=.12){
 const g=w.group(parent);w.box(width+.15,height+.15,depth,w.materials.bronze,g);const p=print(w,width,height,draw,g);p.position.z=depth*.5+.012;
 for(const x of [-width*.5,width*.5])w.beam(V(x,-height*.5,depth*.5+.025),V(x,height*.5,depth*.5+.025),.035,w.materials.brass,g);
 for(const y of [-height*.5,height*.5])w.beam(V(-width*.5,y,depth*.5+.025),V(width*.5,y,depth*.5+.025),.035,w.materials.brass,g);
 batchArchitecture(g);return g;
}
function floor(w,material,radius=30,y=-.4){const g=w.group();const m=w.mesh(new T.CylinderGeometry(radius,radius,.45,96),material,g,V(0,y,0));for(const r of [radius*.33,radius*.69,radius*.91]){const rr=ring(w,r,.025,w.materials.bronze,g,V(0,y+.24,0));rr.rotation.x=PI/2;}batchArchitecture(g);return g;}
function gardenPlant(w,parent,x,z,height=6){
 const g=w.group(parent);g.position.set(x,0,z);w.mesh(new T.CylinderGeometry(1.45,.95,1.7,24),w.materials.stone,g,V(0,.6,0));
 const stem=w.materials.bronze;
 for(let i=0;i<3;i++){
  const angle=i*TAU/3,tip=V(Math.cos(angle)*.7,height-(i*.5),Math.sin(angle)*.7);w.tube([V(0,1.1,0),V(Math.cos(angle)*.4,height*.55,Math.sin(angle)*.4),tip],.045,stem,g);
  for(let j=0;j<7;j++){
   const q=j/7,a=angle+j*1.9,pos=tip.clone().multiplyScalar(.3+q*.65);pos.y+=.7;const leaf=w.mesh(new T.SphereGeometry(.75,12,8),w.materials.green,g,pos);
   leaf.scale.set(.36,.85,.09);leaf.rotation.set(.3+q*.4,a,-.7+q);leaf.position.x+=Math.cos(a)*.5;leaf.position.z+=Math.sin(a)*.5;
   w.beam(pos,leaf.position.clone().add(V(0,-.35,0)),.015,stem,g);
  }
 }
 batchArchitecture(g);return g;
}

function buildCRM(w){
 // The approved cliff belongs to the correspondence story, never to other apps.
 const archive=makeArchive(w,'network');archive.name='crm-cliff-of-correspondence';archive.position.set(-140,0,-15);
 const film=flightEditorial.network(w);
 film.environment={outdoor:true,background:'#7896a1',fog:'#b8b9a8',fogNear:90,fogFar:440,followSun:true,key:'#ffe5b6',keyIntensity:3.1,keyPosition:[-45,70,45],fill:'#b6d4d9',fillIntensity:1.05};
 return film;
}

function buildOnyx(w){
 const m=w.materials,deep=new T.MeshStandardMaterial({color:'#23212d',roughness:.63,metalness:.14}),stone=m.stone.clone();stone.color.set('#45414e');
 const plum=new T.MeshStandardMaterial({color:'#564360',roughness:.56,metalness:.28}),glass=m.glass.clone();glass.color.set('#a18dbb');glass.opacity=.14;
 floor(w,deep,29,-.6);
 const hall=w.group();hall.name='onyx-violet-observatory';
 // A single vaulted rotunda, with an actual open rear oculus rather than a facade.
 for(const [start,length] of [[PI*.5,PI*.38],[PI*1.12,PI*.38]]){
  const wall=w.mesh(new T.CylinderGeometry(25,25,27,48,1,true,start,length),stone,hall,V(0,12,0));wall.material.side=T.DoubleSide;
 }
 for(let i=0;i<9;i++){
  const angle=PI*.53+i*PI*.94/8,x=Math.sin(angle)*24.5,z=Math.cos(angle)*24.5;
  w.beam(V(x,0,z),V(x,25,z),.16,m.bronze,hall);
  const arc=[];for(let j=0;j<=24;j++){const a=j/24*PI/2;arc.push(V(Math.sin(angle)*Math.cos(a)*24.5,Math.sin(a)*27,Math.cos(angle)*Math.cos(a)*24.5));}w.tube(arc,.1,m.brass,hall);
 }
 const oculus=w.group(hall);oculus.position.set(0,12,-22.8);
 for(const r of [9.2,9.65,10.05])ring(w,r,r===9.65?.21:.07,m.brass,oculus);
 const window=w.mesh(new T.CircleGeometry(9.2,96),glass,oculus,V(0,0,-.08));window.castShadow=false;
 for(let i=0;i<12;i++){const a=i/12*TAU;w.beam(V(Math.cos(a)*2.4,Math.sin(a)*2.4,0),V(Math.cos(a)*9.2,Math.sin(a)*9.2,0),.035,m.bronze,oculus);}ring(w,2.4,.045,m.brass,oculus);
 for(let i=0;i<24;i++){const a=i/24*TAU;w.beam(V(Math.cos(a)*9.78,Math.sin(a)*9.78,0),V(Math.cos(a)*10.1,Math.sin(a)*10.1,0),.025,m.brass,oculus);}
 const base=w.group(hall);w.mesh(new T.CylinderGeometry(8,9,.7,72),stone,base,V(0,0,1));w.mesh(new T.CylinderGeometry(7.7,7.8,.22,72),plum,base,V(0,.47,1));
 for(const x of [-3.8,3.8]){
  w.beam(V(x,.6,-1.5),V(x,15,-1.5),.17,m.bronze,hall);w.beam(V(x,.6,-1.5),V(x*1.8,.5,-5.5),.12,m.brass,hall);
  for(let y=1;y<15;y+=.7)w.box(.35,.075,.34,m.brass,hall,V(x,y,-1.5));
 }
 w.beam(V(-3.8,15,-1.5),V(3.8,15,-1.5),.21,m.brass,hall);
 plaque(w,'THE OBSERVATORY OF VOICES',7.3,hall,V(0,1.05,8.4));
 batchArchitecture(hall);

 const optic=w.group();optic.name='mechanically-focused-voice';optic.position.set(0,8,0);
 const rigid=w.group(optic);for(const z of [-.45,.45]){ring(w,4.45,.23,m.brass,rigid,V(0,0,z));ring(w,4.05,.06,m.bronze,rigid,V(0,0,z));}
 for(let i=0;i<24;i++){const a=i/24*TAU;w.beam(V(Math.cos(a)*4.45,Math.sin(a)*4.45,-.45),V(Math.cos(a)*4.45,Math.sin(a)*4.45,.45),.045,m.bronze,rigid);}
 const lens=w.mesh(new T.SphereGeometry(3.85,48,24),glass,rigid);lens.scale.z=.045;lens.castShadow=false;
  w.mesh(new T.RingGeometry(2.1,4.03,96),plum,rigid,V(0,0,.49));
 for(const s of [-1,1])w.beam(V(s*3.8,0,-1.5),V(s*4.4,0,0),.13,m.brass,rigid);
 batchArchitecture(rigid);
 // The outer registration collar indexes one reviewed voice into three editions.
 // Its clear annular track stays outside the fixed lens and its brass supports.
 const registration=w.group(optic);registration.name='onyx-edition-registration';registration.position.z=.57;
 ring(w,4.96,.105,m.bronze,registration);ring(w,5.14,.035,m.brass,registration);
 for(let i=0;i<36;i++){
  const a=i/36*TAU,r=i%12===0?5.12:4.98;
  w.beam(V(Math.cos(a)*4.83,Math.sin(a)*4.83,.035),V(Math.cos(a)*r,Math.sin(a)*r,.035),i%12===0?.045:.018,m.brass,registration);
 }
 for(let i=0;i<3;i++){
  const a=i/3*TAU,pin=w.mesh(new T.CylinderGeometry(.12,.12,.055,24),plum,registration,V(Math.cos(a)*4.96,Math.sin(a)*4.96,.12));pin.rotation.x=PI/2;
 }
 const pointer=new T.Shape();pointer.moveTo(4.82,-.2);pointer.lineTo(5.45,0);pointer.lineTo(4.82,.2);pointer.closePath();
 w.mesh(new T.ExtrudeGeometry(pointer,{depth:.065,bevelEnabled:false}),m.brass,registration,V(0,0,.08));
 batchArchitecture(registration);
 const blades=[];
 for(let i=0;i<9;i++){
  const a=i/9*TAU,pivot=w.group(optic);pivot.position.set(Math.cos(a)*3.73,Math.sin(a)*3.73,.55+i*.018);pivot.rotation.z=a;
  const shape=new T.Shape();shape.moveTo(.13,.12);shape.bezierCurveTo(-.6,1.2,-1.8,1.7,-3.23,.66);shape.lineTo(-2.9,-.48);shape.bezierCurveTo(-1.5,-.1,-.6,-.35,.13,-.18);shape.closePath();
  w.mesh(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:2,curveSegments:16}),m.bronze,pivot);blades.push({pivot,a});
 }
 const source=panel(w,3.25,4.55,(c,cw,ch)=>{stock(c,cw,ch,'#cec4d5');text(c,'YOUR BRAND VOICE',cw*.1,ch*.11,cw*.052,'#594065','monospace');text(c,'One clear',cw*.1,ch*.3,cw*.15,'#35273f');text(c,'idea.',cw*.1,ch*.45,cw*.2,'#35273f');lines(c,cw*.1,ch*.59,cw*.77,8);text(c,'DRAFT / FOR REVIEW',cw*.1,ch*.92,cw*.045,'#594065','monospace');},optic,.08);
 source.name='etched-source-plate';
 for(const x of [-1.65,1.65])w.beam(V(x,-2.28,-.08),V(x,-2.65,-.08),.055,m.brass,source);
 w.beam(V(-1.86,-2.65,-.08),V(1.86,-2.65,-.08),.055,m.brass,source);batchArchitecture(source);
 const cradle=w.group(optic);
 for(const x of [-1.85,1.85])w.beam(V(x,-4.05,.45),V(x,-2.65,.86),.065,m.brass,cradle);batchArchitecture(cradle);
 const slide=w.group(optic);slide.position.z=.86;slide.name='onyx-telescopic-source-rails';
 for(const x of [-1.85,1.85])w.beam(V(x,-2.65,0),V(x,-2.65,6.14),.055,m.brass,slide);batchArchitecture(slide);
 const versions=[{x:-5.2,width:3.2,height:5.2,title:'A conversation',label:'PORTRAIT / SOCIAL'},{x:0,width:4.2,height:4.2,title:'A perspective',label:'SQUARE / SOCIAL'},{x:5.6,width:5.5,height:3.4,title:'A moment',label:'LANDSCAPE / SOCIAL'}].map((d,i)=>{
  const g=w.group();g.position.set(d.x,2.7,5.2);g.name=`onyx-format-${i}`;
  // Each edition has a telescopic pedestal and a real bottom pivot. The old
  // fixed-height poles passed through the cards while they rose from the deck.
  const support=w.group();support.position.set(d.x,0,5.6);
  w.mesh(new T.CylinderGeometry(.16,.19,.56,20),m.bronze,support,V(0,.92,0));
  w.box(1.25,.2,1.4,m.iron,support,V(0,.64,0));batchArchitecture(support);
  const piston=w.mesh(new T.CylinderGeometry(.095,.095,1,16),m.brass);piston.position.set(d.x,1,5.6);piston.name=`onyx-piston-${i}`;
  const carriage=w.group();carriage.position.set(d.x,1.05,5.6);carriage.name=`onyx-hinge-carriage-${i}`;
  w.beam(V(0,0,0),V(0,0,-.4),.075,m.brass,carriage);
  const axle=w.mesh(new T.CylinderGeometry(.095,.095,d.width+.3,20),m.bronze,carriage,V(0,0,-.4));axle.rotation.z=PI/2;
  batchArchitecture(carriage);
  const hinge=w.group(g);hinge.position.y=-d.height*.5;
  const leaf=panel(w,d.width,d.height,(c,cw,ch)=>{stock(c,cw,ch);text(c,'ONE VOICE',cw*.09,ch*.12,cw*.075,'#5d426f','monospace');art(c,cw*.09,ch*.19,cw*.82,ch*.4,'#9a83b2');text(c,d.title,cw*.09,ch*.72,cw*.09,'#392d42');lines(c,cw*.09,ch*.8,cw*.78,3);},hinge);leaf.position.y=d.height*.5;
  plaque(w,d.label,d.width-.18,hinge,V(0,.35,.14));
  return {g,hinge,piston,carriage,index:i,d};
 });
 const shutters=[];
 for(const s of [-1,1]){
  const hinge=w.group();hinge.position.set(s*9.2,12,-21.7);hinge.name=`onyx-oculus-shutter-${s}`;
  // Rounded shutters are vertical slices mounted on a physical outer hinge.
  const blade=w.mesh(new T.CylinderGeometry(9.15,9.15,.12,64,1,false,s===1?0:PI,PI),plum,hinge,V(-s*9.15,0,0));blade.rotation.x=PI/2;
  for(const y of [-6,-3,0,3,6])w.beam(V(-s*.2,y,.1),V(-s*8.1,y,.1),.045,m.brass,hinge);
  batchArchitecture(hinge);shutters.push({hinge,s});
 }
 const camera=flightPath([
  {p:0,eye:[12,11.5,24],target:[0,7.2,3.5],fov:40,roll:0},
  {p:.30,eye:[10,12,21],target:[0,8.1,1.5],fov:39,roll:0},
  {p:.38,eye:[10,12,21],target:[0,8.1,1.5],fov:39,roll:0},
  {p:.56,eye:[15,15,24],target:[0,9.1,2],fov:43,roll:0},
  {p:.78,eye:[12,12.5,25],target:[1,8,3.4],fov:43,roll:0},
  {p:1,eye:[8,15,29],target:[.5,8.4,0],fov:46,roll:0},
 ]);
 const stages=['Find the voice','Bring the idea into focus','Respect each audience','Choose what happens next'];
 return {title:'The Observatory of Voices',stages,camera,environment:{background:'#201a2a',fog:'#302737',key:'#ecd2b6',keyIntensity:3.2,keyPosition:[-17,25,16],fill:'#a394cc',fillIntensity:.9,portraitDistance:1.48},update(p,t){
  const focus=between(p,.015,.30),reveal=between(p,.36,.58),opening=between(p,.76,1);
  optic.position.y=8+reveal*4.1;source.position.set(0,0,lerp(6.5,.96,focus));slide.scale.z=(source.position.z+.5-.86)/6.14;
  const exposures=[0,1,2].map(i=>between(p,.46+i*.085,.60+i*.085)),exposure=exposures.reduce((sum,q)=>sum+Math.sin(q*PI),0);
  registration.rotation.z=-PI*.7+between(p,0,.30)*PI*.7+exposures.reduce((sum,q)=>sum+q,0)*TAU/3;
  for(const {pivot,a} of blades)pivot.rotation.z=a+lerp(.95,.28,focus)+reveal*.16-exposure*.13;
  for(const {g,hinge,piston,carriage,index,d} of versions){
   const lift=between(p,.43+index*.035,.62+index*.035),turn=between(p,.53+index*.035,.77+index*.035),height=lerp(1.05,6.7-d.height*.5,lift);
   g.position.y=height+d.height*.5;hinge.rotation.x=-(1-turn)*PI/2-between(p,.84,1)*(.1+index*.035);
   carriage.position.y=height;piston.position.y=(.87+height)*.5;piston.scale.y=height-.87;
  }
  // Open toward the room: swinging backward sliced through the fixed glazing.
  for(const {hinge,s} of shutters)hinge.rotation.y=s*between(p,.76+(s+1)*.018,.964+(s+1)*.018)*1.12;
  const chapter=Math.min(3,Math.round(p*3));w.narrative={chapter,subject:'One reviewed source plate and three physical audience editions',action:stages[chapter],environment:'violet brass observatory',irisFocus:Number(focus.toFixed(3)),editionRegistration:Number(exposures.reduce((sum,q)=>sum+q,0).toFixed(3)),audienceFormats:p>.53?['portrait','square','landscape']:[],reviewHold:p>=.30&&p<=.36,oculusOpen:Number(opening.toFixed(3)),automaticPublish:false};
 }};
}

function buildCMS(w){
 const m=w.materials,limestone=m.stone.clone();limestone.color.set('#b7ad8d');const binding=m.cloth.clone();binding.color.set('#57456b');
 const darkBinding=new T.MeshStandardMaterial({color:'#332c3f',roughness:.79}),gardenGlass=m.glass.clone();gardenGlass.color.set('#b8d4bd');gardenGlass.opacity=.12;
 floor(w,limestone,31,-.5);
 const garden=w.group();garden.name='cms-glass-garden-atrium';
 for(const z of [-19,-8,5]){
  const curve=[];for(let i=0;i<=48;i++){const a=i/48*PI;curve.push(V(Math.cos(a)*25,Math.sin(a)*24,z));}w.tube(curve,.13,m.bronze,garden);
 }
 for(let i=1;i<12;i++){const a=i/12*PI;w.beam(V(Math.cos(a)*25,Math.sin(a)*24,-19),V(Math.cos(a)*25,Math.sin(a)*24,5),.06,m.brass,garden);}
 for(let i=0;i<12;i++){
  const a=i/12*PI,b=(i+1)/12*PI;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([Math.cos(a)*24.9,Math.sin(a)*23.9,-19,Math.cos(b)*24.9,Math.sin(b)*23.9,-19,Math.cos(a)*24.9,Math.sin(a)*23.9,5,Math.cos(b)*24.9,Math.sin(b)*23.9,-19,Math.cos(b)*24.9,Math.sin(b)*23.9,5,Math.cos(a)*24.9,Math.sin(a)*23.9,5],3));geo.computeVertexNormals();const pane=w.mesh(geo,gardenGlass,garden);pane.castShadow=false;
 }
 for(const x of [-19,-10,0,10,19]){w.beam(V(x,0,-20),V(x,18,-20),.13,m.bronze,garden);w.box(.15,18,.14,m.brass,garden,V(x,9,-20));}
 for(const y of [0,6,12,18])w.beam(V(-24,y,-20),V(24,y,-20),.095,m.brass,garden);
 // A low stone garden boundary keeps the atrium rooted and quiet.
 for(const x of [-20,20])w.box(2,1.1,34,limestone,garden,V(x,.25,-4));
 for(const [x,z,h] of [[-17,-13,9],[16,-13,10],[-20,2,7],[19,5,6],[-10,-18,7],[9,-19,8]])gardenPlant(w,garden,x,z,h);
 batchArchitecture(garden);

 const book=w.group();book.position.set(1,-.3,1);book.name='the-impossible-book';
 const base=w.group(book);w.box(9,.42,13.2,darkBinding,base,V(4.4,.25,0));w.box(8.65,.14,12.9,binding,base,V(4.4,.5,0));
 w.box(8.3,.64,12.55,m.paper,base,V(4.35,.85,0));
 const pageEdge=m.paper.clone();pageEdge.color.set('#cbbb99');
 for(let i=0;i<15;i++)for(const z of [-6.284,6.284])w.box(8.3,.008,.012,pageEdge,base,V(4.35,.57+i*.039,z));
 for(const z of [-6.5,6.5])w.box(9,.07,.08,m.brass,base,V(4.4,.5,z));
 w.mesh(new T.CylinderGeometry(.4,.4,13.2,32),binding,base,V(0,.76,0)).rotation.x=PI/2;
 batchArchitecture(base);
 // The closed cover clears the layered paper mechanism. Its final angle rests
 // on the floor; the content on the inside belongs to this actual rigid cover.
 const cover=w.group(book);cover.position.set(0,1.75,0);cover.name='cms-book-cover';
 w.box(8.85,.29,13.1,binding,cover,V(4.4,0,0));
 for(const x of [.2,8.6])w.box(.035,.025,12.6,m.brass,cover,V(x,.16,0));for(const z of [-6.25,6.25])w.box(8.4,.025,.035,m.brass,cover,V(4.4,.16,z));
 const coverPrint=print(w,7.7,11.8,(c,cw,ch)=>{stock(c,cw,ch,'#554466');c.strokeStyle='#baa66f';c.lineWidth=3;c.strokeRect(cw*.065,ch*.055,cw*.87,ch*.89);text(c,'THE BASALT STORY ATLAS',cw*.14,ch*.18,cw*.045,'#ddc994','monospace');text(c,'Make room',cw*.14,ch*.39,cw*.135,'#eadcba');text(c,'for wonder.',cw*.14,ch*.49,cw*.135,'#eadcba');c.strokeStyle='#baa66f';c.lineWidth=2;c.beginPath();c.arc(cw*.5,ch*.72,cw*.14,0,TAU);c.stroke();text(c,'A LIVING COMPOSITION',cw*.17,ch*.9,cw*.04,'#ddc994','monospace');},cover);coverPrint.rotation.x=-PI/2;coverPrint.position.set(4.4,.158,0);
 const inner=print(w,8.45,12.65,(c,cw,ch)=>{stock(c,cw,ch);text(c,'BEGIN WITH A FEELING.',cw*.085,ch*.1,cw*.046,'#76577f','monospace');text(c,'Every good idea',cw*.085,ch*.22,cw*.09);text(c,'deserves a world.',cw*.085,ch*.31,cw*.09);art(c,cw*.085,ch*.39,cw*.83,ch*.37);lines(c,cw*.085,ch*.83,cw*.77,5);},cover);inner.rotation.x=PI/2;inner.position.set(4.4,-.159,0);inner.rotation.z=PI;
 batchArchitecture(cover);
 const rightPage=print(w,8.25,12.5,(c,cw,ch)=>{stock(c,cw,ch);text(c,'FROM INGREDIENTS TO EXPERIENCE',cw*.08,ch*.09,cw*.039,'#76577f','monospace');c.strokeStyle='#b6a383';c.lineWidth=1.5;for(const y of [.18,.49,.81]){c.beginPath();c.moveTo(cw*.08,ch*y);c.lineTo(cw*.92,ch*y);c.stroke();}text(c,'Your story. Your composition.',cw*.08,ch*.95,cw*.044);},book);rightPage.rotation.x=-PI/2;rightPage.position.set(4.35,1.19,0);
 // The composition is a real paper construction: window-cut walls, linen hinges,
 // creased roof leaves, and attached botanical folds. It is not a set of UI cards.
 const pavilion=w.group(book);pavilion.position.set(4.35,1.24,0);pavilion.name='cms-hinged-paper-pavilion';
 const foldInk=new T.MeshStandardMaterial({color:'#8f7b9a',roughness:.9,side:T.DoubleSide}),roofPaper=m.paper.clone();roofPaper.color.set('#c1adca');
 const cutArch=(shape,x,y,width,height)=>{const hole=new T.Path();hole.moveTo(x-width/2,y);hole.lineTo(x+width/2,y);hole.lineTo(x+width/2,y+height-width/2);hole.absarc(x,y+height-width/2,width/2,0,PI,false);hole.lineTo(x-width/2,y);shape.holes.push(hole);};
 const paperShape=(shape,parent)=>w.mesh(new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:1,curveSegments:24}),m.paper,parent);
 const sideWalls=[];
 for(const s of [-1,1]){
  const frame=w.group(pavilion);frame.position.set(s*3,0,0);frame.rotation.y=s*PI/2;
  const hinge=w.group(frame);hinge.name=`cms-side-wall-${s}`;
  const shape=new T.Shape();shape.moveTo(-1.1,0);shape.lineTo(1.1,0);shape.lineTo(1.1,2.8);shape.lineTo(-1.1,2.8);shape.closePath();
  for(const x of [-.55,.55])cutArch(shape,x,.4,.75,2.05);paperShape(shape,hinge);
  for(const y of [.14,2.66])w.box(2.2,.028,.02,foldInk,hinge,V(0,y,.07));
  for(const x of [-1.03,1.03])w.box(.035,2.7,.025,foldInk,hinge,V(x,1.38,.07));
  w.box(2.2,.08,.09,m.cloth,hinge,V(0,.015,0));batchArchitecture(hinge);sideWalls.push({hinge,s});
 }
 const gables=[],doors=[];
 const doorPaper=m.paper.clone();doorPaper.color.set('#7f9787');
 for(const s of [-1,1]){
  const frame=w.group(pavilion);frame.position.set(0,.09,s*1.18);frame.rotation.y=s<0?PI:0;
  const hinge=w.group(frame);hinge.name=`cms-gable-${s}`;
  const shape=new T.Shape();shape.moveTo(-3,0);shape.lineTo(3,0);shape.lineTo(3,2.8);shape.lineTo(0,4.8);shape.lineTo(-3,2.8);shape.closePath();
  cutArch(shape,0,0,1.55,2.5);for(const x of [-2.05,2.05])cutArch(shape,x,.5,.9,1.85);
  const rose=new T.Path();rose.absarc(0,3.45,.42,0,TAU,true);shape.holes.push(rose);paperShape(shape,hinge);
  const edge=[V(-3,0,.08),V(-3,2.8,.08),V(0,4.8,.08),V(3,2.8,.08),V(3,0,.08)];for(let i=0;i<edge.length-1;i++)w.beam(edge[i],edge[i+1],.022,foldInk,hinge);
  ring(w,.46,.022,foldInk,hinge,V(0,3.45,.08));w.box(6,.07,.09,m.cloth,hinge,V(0,.018,0));batchArchitecture(hinge);gables.push({hinge,s});
  if(s===1)for(const side of [-1,1]){
   const door=w.group(hinge);door.name=`cms-pavilion-door-${side}`;door.position.set(side*.72,.08,.076);
   const leaf=w.group(door);leaf.scale.x=-side;
   const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(.68,0);shape.lineTo(.68,2.325);shape.absarc(.68,1.645,.68,PI/2,PI,false);shape.closePath();
   w.mesh(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,curveSegments:24}),doorPaper,leaf);
   w.beam(V(.08,.12,.032),V(.08,1.65,.032),.012,m.brass,leaf);
   w.beam(V(.58,.12,.032),V(.58,2.13,.032),.012,m.brass,leaf);
   w.mesh(new T.TorusGeometry(.035,.008,6,20),m.brass,leaf,V(.56,.98,.032));
   batchArchitecture(leaf);doors.push({hinge:door,side});
  }
 }
 const roofs=[];
 for(const s of [-1,1]){
  const hinge=w.group(pavilion),sheet=w.group(hinge),length=Math.hypot(2.935,2);hinge.name=`cms-roof-${s}`;sheet.position.x=s*length*.5;
  w.box(length,.06,2.23,roofPaper,sheet);
  for(const z of [-.92,-.46,0,.46,.92])w.box(length,.018,.022,foldInk,sheet,V(0,.04,z));
  for(const x of [-length*.5,length*.5])w.box(.035,.02,2.23,m.paper,sheet,V(x,.05,0));
  // A narrow linen hinge moves with the top edge of the wall beneath it.
  w.box(.13,.09,2.2,m.cloth,hinge);batchArchitecture(sheet);
  const mount=w.group(pavilion);mount.name=`cms-roof-hinge-link-${s}`;
  for(const z of [-.94,.94])w.beam(V(0,0,z),V(0,.14,z),.035,m.cloth,mount);batchArchitecture(mount);
  roofs.push({hinge,mount,s,length});
 }
 const path=print(w,1.8,2.9,(c,cw,ch)=>{stock(c,cw,ch);c.strokeStyle='#a998b2';c.lineWidth=3;for(let i=0;i<6;i++){c.beginPath();c.moveTo(cw*.12,i*ch/6);c.lineTo(cw*.88,i*ch/6);c.stroke();}},pavilion);path.rotation.x=-PI/2;path.position.set(0,-.025,3.1);
 const botanicals=[];
 const leafPaper=m.paper.clone();leafPaper.color.set('#688978');
 for(const [index,d] of [[-6.3,-1.9,3.1],[-2.1,-1.8,3.3],[8.0,4.4,2.2]].entries()){
  const frame=w.group(d[0]<0?cover:book);frame.position.set(Math.abs(d[0]),d[0]<0?-.22:1.27,d[1]);frame.rotation.z=d[0]<0?PI:0;
  const hinge=w.group(frame);hinge.name=`cms-botanical-${index}`;
  w.box(.085,d[2],.05,leafPaper,hinge,V(0,d[2]*.5,0));
  for(let j=0;j<6;j++){
   const side=j%2?-1:1,leaf=w.group(hinge);leaf.position.set(0,.65+j*d[2]/7,0);leaf.rotation.z=side*-.55;
   const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute([0,0,0,side*.49,.3,0,side*.32,.95,.02,0,0,0,side*.32,.95,.02,-side*.1,.44,.035],3));geom.computeVertexNormals();w.mesh(geom,leafPaper,leaf);w.beam(V(0,0,.012),V(side*.32,.95,.025),.012,foldInk,leaf);
  }
  batchArchitecture(hinge);botanicals.push({hinge,index});
 }
 const formats=[{x:-6.6,width:2.6,height:1.65,label:'DESKTOP'},{x:-4.2,width:1.65,height:2.15,label:'TABLET'},{x:-2.3,width:1.05,height:2.2,label:'MOBILE'}].map((d,i)=>{
  const frame=w.group(cover);frame.position.set(-d.x,-.25,4.4);frame.rotation.z=PI;
  const hinge=w.group(frame);hinge.name=`cms-${d.label.toLowerCase()}-review`;
  const leaf=panel(w,d.width,d.height,(c,cw,ch)=>{stock(c,cw,ch);text(c,'A PLACE FOR THE POSSIBLE.',cw*.085,ch*.13,cw*.06);art(c,cw*.085,ch*.22,cw*.83,ch*.4,'#b69bc4');lines(c,cw*.085,ch*.7,cw*.76,3);text(c,d.label,cw*.085,ch*.92,cw*.055,'#76577f','monospace');},hinge,.085);leaf.position.y=d.height*.5;
  const joint=w.mesh(new T.CylinderGeometry(.09,.09,d.width+.25,20),m.brass,hinge);joint.rotation.z=PI/2;
  batchArchitecture(hinge);return {hinge,index:i};
 });
 const camera=flightPath([
  {p:0,eye:[17,17,24],target:[5,1.4,1],fov:38,roll:0},
  {p:.28,eye:[14,19,22],target:[1,2,1],fov:43,roll:-.015},
  {p:.52,eye:[14,11,19],target:[3,3.3,0],fov:40,roll:0},
  {p:.72,eye:[11,10,21],target:[1.3,3.1,1],fov:42,roll:0},
  {p:1,eye:[9,14,23],target:[1.5,3,0],fov:42,roll:0},
 ]);
 const stages=['Find the story','Give the composition a rhythm','Keep the meaning in every format','Review the whole experience'];
 return {title:'The Impossible Book',stages,camera,environment:{background:'#b9bfab',fog:'#b9bfab',key:'#ffe3b0',keyIntensity:3.0,keyPosition:[-22,29,14],fill:'#b9d9c4',fillIntensity:1.1,portraitDistance:1.78},update(p,t){
  const opening=between(p,0,.28),formatsUp=between(p,.60,.84),finish=between(p,.86,1),welcome=between(p,.82,1);
  cover.rotation.z=opening*(PI+.18);
  // The two short walls fold into separate halves of the page. Gables fold
  // outward, and roof leaves unfold upward only after their supporting walls.
  // Every sheet stays present, layered under the cover from the first frame.
  const walls=between(p,.28,.49),roof=between(p,.37,.65);
  for(const {hinge} of sideWalls)hinge.rotation.x=-(1-walls)*PI/2;
  for(const {hinge,s} of gables)hinge.rotation.x=(1-between(p,s<0?.34:.38,s<0?.57:.64))*PI/2;
  for(const {hinge,mount,s} of roofs){const fold=between(p,s<0?.37:.40,s<0?.60:.65);mount.position.set(s*(3-2.8*Math.cos(walls*PI/2)),2.8*Math.sin(walls*PI/2),0);hinge.position.copy(mount.position).add(V(0,.14,0));hinge.rotation.z=s*fold*(PI-Math.atan2(2,2.935));}
  for(const {hinge,index} of botanicals)hinge.rotation.x=-(1-between(p,.36+index*.07,.62+index*.05))*PI/2;
  for(const {hinge,index} of formats){const q=between(p,.60+index*.06,.72+index*.06),settle=between(p,.86+index*.04,.94+index*.03);hinge.rotation.x=-PI/2+q*(1-settle)*(PI/2-.05);}
  for(const {hinge,side} of doors)hinge.rotation.y=side*between(p,.82+(side+1)*.025,.95+(side+1)*.025)*1.42;
  const chapter=Math.min(3,Math.round(p*3));w.narrative={chapter,subject:'A clothbound story atlas unfolds into a hinged paper pavilion and botanical garden',action:stages[chapter],environment:'warm glass garden atrium',coverOpen:Number(opening.toFixed(3)),pavilionUnfolded:Number(roof.toFixed(3)),contentAttached:true,formatReview:formatsUp>.5&&finish<.5,readerWelcome:Number(welcome.toFixed(3)),automaticPublish:false};
 }};
}

export const experienceEditorial={network:buildCRM,crystal:buildOnyx,pages:buildCMS};
