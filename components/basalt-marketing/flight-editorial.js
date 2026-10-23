/* Three editorial flights: the subject changes because of the work being done.
 * Scroll owns every consequential state; time supplies only the breath of cloth. */
import {T,V,flightPath,batchArchitecture} from './flight-kit.js';
import {createCorrespondenceFlight,CRM_GEOGRAPHY} from './crm-flight-motion.js';

const PI=Math.PI,TAU=PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const span=(p,a,b)=>{const q=clamp((p-a)/(b-a));return q*q*(3-2*q);};
const mix=(a,b,q)=>a+(b-a)*q;
const rgb=w=>'#'+w.accent.getHexString();
const point=(a,b,q)=>a.clone().lerp(b,q);
const bezier=(a,b,c,d,q)=>new T.Vector3().addScaledVector(a,(1-q)**3).addScaledVector(b,3*q*(1-q)**2).addScaledVector(c,3*q*q*(1-q)).addScaledVector(d,q**3);

function printed(w,width,height,draw,parent=w.root){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768*height/width);
  const ctx=canvas.getContext('2d');draw(ctx,canvas.width,canvas.height);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const material=new T.MeshStandardMaterial({map:texture,roughness:.85,metalness:0,side:T.DoubleSide});
  const mesh=w.mesh(new T.PlaneGeometry(width,height,1,1),material,parent);mesh.receiveShadow=true;return mesh;
}
function paper(ctx,width,height,tint='#eee5d0'){
  ctx.fillStyle=tint;ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(50,39,20,.045)';
  for(let i=0;i<1200;i++)ctx.fillRect((i*127.73)%width,(i*78.13)%height,.7,2+(i%3));
}
function type(ctx,words,x,y,size=36,color='#27382e',font='Georgia'){
  ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(words,x,y);
}
function rule(ctx,x,y,width,color='#a68a55',thickness=2){ctx.fillStyle=color;ctx.fillRect(x,y,width,thickness);}
function stamp(ctx,x,y,r,tint){
  ctx.fillStyle=tint;ctx.beginPath();ctx.moveTo(x-r*.75,y-r);ctx.lineTo(x+r*.75,y-r);ctx.lineTo(x+r*.7,y+r*.25);ctx.quadraticCurveTo(x+r*.5,y+r*.8,x,y+r);ctx.quadraticCurveTo(x-r*.5,y+r*.8,x-r*.7,y+r*.25);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#eee5d0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-r*.35,y-r*.4);ctx.lineTo(x+r*.32,y);ctx.lineTo(x-r*.3,y+r*.4);ctx.stroke();
}
function lines(ctx,x,y,width,count=4){ctx.globalAlpha=.42;for(let i=0;i<count;i++)rule(ctx,x,y+i*17,width*(i===count-1?.63:1),'#31483b',2);ctx.globalAlpha=1;}
function illustration(ctx,x,y,width,height,tint){
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
  ctx.fillStyle='#d7cdb1';ctx.fillRect(x,y,width,height);
  ctx.fillStyle='#f2c17b';ctx.beginPath();ctx.arc(x+width*.74,y+height*.25,height*.21,0,TAU);ctx.fill();
  for(let layer=0;layer<4;layer++){
    ctx.fillStyle=[tint,'#748676','#486b5d','#283f38'][layer];ctx.beginPath();ctx.moveTo(x,y+height);
    for(let i=0;i<10;i++)ctx.lineTo(x+i*width/9,y+height*(.23+.16*layer)+Math.sin(i*1.1+layer*.8)*height*.1);
    ctx.lineTo(x+width,y+height);ctx.closePath();ctx.fill();
  }
  ctx.strokeStyle='#eddbaf';ctx.lineWidth=height*.025;ctx.beginPath();ctx.moveTo(x+width*.1,y+height);ctx.bezierCurveTo(x+width*.75,y+height*.85,x+width*.23,y+height*.58,x+width*.75,y+height*.4);ctx.stroke();ctx.restore();
}
function pin(w,parent,p,size=.06){return w.mesh(new T.SphereGeometry(size,12,8),w.materials.brass,parent,p);}
function arch(w,parent,width,height,depth=0,material=w.materials.bronze){
  const pts=[];for(let i=0;i<=40;i++){const t=i/40*PI;pts.push(V(Math.cos(t)*width*.5,Math.sin(t)*height,depth));}
  w.tube(pts,.09,material,parent);return pts;
}
function pennant(w,parent,text,width=3.6,position=V()){
  const g=w.group(parent);g.position.copy(position);
  w.beam(V(-width*.6,.8,0),V(width*.6,.8,0),.035,w.materials.brass,g);
  const sheet=printed(w,width,.75,(ctx,cw,ch)=>{paper(ctx,cw,ch,'#263d35');type(ctx,text,cw*.07,ch*.64,ch*.3,'#efe4c7','monospace');},g);
  sheet.position.y=.27;return g;
}
function anchoredBridge(w,x,y,z,width=7){
  const g=w.group();g.position.set(x,y,z);
  g.name='crm-supported-bridge';
  w.box(width,.28,30,w.materials.iron,g,V(0,-.25,-14));
  for(let i=0;i<16;i++)w.box(width,.07,1.65,w.materials.bronze,g,V(0,-.07,-i*1.86));
  for(const s of [-1,1]){
    w.beam(V(s*width*.48,0,0),V(s*width*.48,0,-28),.11,w.materials.brass,g);
    w.beam(V(s*width*.48,-.2,0),V(s*width*.48,-7,-28),.15,w.materials.iron,g);
    for(let i=0;i<8;i++){w.beam(V(s*width*.48,0,-i*4),V(s*width*.48,1.1,-i*4),.045,w.materials.brass,g);}
    w.beam(V(s*width*.48,1.1,0),V(s*width*.48,1.1,-28),.035,w.materials.brass,g);
  }
  batchArchitecture(g);
  return g;
}

function correspondenceSpire(w,name,position,radius){
  const g=w.group();g.name=name;g.position.copy(position);
  const rock=w.materials.stone.clone();rock.color.set('#505b52');
  for(let i=0;i<9;i++){
    const angle=i/9*TAU,height=126+(i%3)*14,r=i===0?0:radius*.58;
    const pillar=w.mesh(new T.CylinderGeometry(radius*.36, radius*.42,height,8,3),rock,g,V(Math.cos(angle)*r,-height/2-1,Math.sin(angle)*r));pillar.rotation.y=i*.47;
  }
  w.mesh(new T.CylinderGeometry(radius,radius*.93,1.15,48),rock,g,V(0,-.7,0));
  const edge=w.mesh(new T.TorusGeometry(radius-.15,.065,8,80),w.materials.brass,g,V(0,-.1,0));edge.rotation.x=PI/2;
  return g;
}

function contextLandmark(w){
  const [x,y,z]=CRM_GEOGRAPHY.context,g=correspondenceSpire(w,'crm-context-tower',V(x,y,z+5),15);
  for(let i=0;i<3;i++){
    const dx=(i-1)*9,h=i===1?12:8;
    w.box(6.4,h,9,w.materials.stone,g,V(dx,h/2,0));
    w.mesh(new T.ConeGeometry(5.2,4,4),w.materials.bronze,g,V(dx,h+2,0)).rotation.y=PI/4;
    w.box(4.6,h*.69,.13,w.materials.glass,g,V(dx,h*.52,4.57));
    for(const side of [-1,1])w.beam(V(dx+side*2.5,0,4.7),V(dx+side*2.5,h,4.7),.09,w.materials.brass,g);
    for(let level=1;level<h-1;level+=1.4)w.box(4.8,.11,.9,w.materials.bronze,g,V(dx,level,4.8));
  }
  pennant(w,g,'02 / THE CONTEXT TOWER',9,V(0,15,-.6));
  for(const side of [-1,1])w.beam(V(side*5.4,11.5,-.6),V(side*5.4,15.8,-.6),.07,w.materials.brass,g);
  batchArchitecture(g);
}

function reviewLandmark(w){
  const [x,y,z]=CRM_GEOGRAPHY.review,g=correspondenceSpire(w,'crm-review-promontory',V(x,y-1.4,z-26),15);
  for(let i=0;i<5;i++){
    const tree=w.group(g);tree.position.set(-11+(i%2)*3,.1,-7+i*3.3);
    w.mesh(new T.CylinderGeometry(.12,.2,4,8),w.materials.bronze,tree,V(0,2,0));
    w.mesh(new T.SphereGeometry(1.6,12,8),w.materials.green,tree,V(0,4.4,0)).scale.set(1,1.5,1);
  }
  batchArchitecture(g);
}

function replyLandmark(w){
  const [x,y,z]=CRM_GEOGRAPHY.reply,g=correspondenceSpire(w,'crm-reply-beacon',V(x,y,z),13);
  w.mesh(new T.CylinderGeometry(5.6,7,17,12),w.materials.stone,g,V(0,8.5,0));
  for(let i=0;i<12;i++){
    const angle=i*TAU/12,dx=Math.cos(angle)*5.55,dz=Math.sin(angle)*5.55;
    w.beam(V(dx,14,dz),V(dx,24,dz),.095,w.materials.brass,g);
  }
  w.mesh(new T.CylinderGeometry(5.4,5.4,7.4,48,1,true),w.materials.glass,g,V(0,20,0));
  w.mesh(new T.ConeGeometry(7.1,5.5,12),w.materials.bronze,g,V(0,26.65,0));
  w.mesh(new T.SphereGeometry(1.2,24,16),w.materials.glow,g,V(0,20,0));
  pennant(w,g,'04 / THE CONVERSATION CONTINUES',8,V(0,16,7.2));
  for(const side of [-1,1]){
    w.beam(V(side*4.8,12,5.8),V(side*4.8,16.8,7.2),.065,w.materials.brass,g);
    w.beam(V(side*1.45,11.7,16),V(side*1.45,3.5,6),.11,w.materials.iron,g);
  }
  w.box(3.4,.14,3,w.materials.bronze,g,V(0,11.7,16));
  batchArchitecture(g);
}

function buildCRM(w){
  const tint=rgb(w),craft=w.group();craft.name='the-letter-that-learned-to-fly';
  const wing=w.wing({parent:craft,span:9.2,chord:3.3});
  wing.userData.seal.position.set(0,.34,-1.96);
  // The halves keep their independent hinge transforms; only their rigid ribs merge.
  batchArchitecture(wing.userData.left);batchArchitecture(wing.userData.right);
  const letter=printed(w,2.45,3.2,(ctx,cw,ch)=>{
    paper(ctx,cw,ch);type(ctx,'ASTER STUDIO',cw*.1,ch*.11,cw*.052,tint,'monospace');rule(ctx,cw*.1,ch*.15,cw*.8);
    type(ctx,'Morgan Hale',cw*.1,ch*.26,cw*.10);type(ctx,'Can you send an',cw*.1,ch*.40,cw*.076);type(ctx,'onboarding outline?',cw*.1,ch*.49,cw*.076);
    lines(ctx,cw*.1,ch*.63,cw*.72,5);stamp(ctx,cw*.78,ch*.86,cw*.07,tint);
  },craft);letter.rotation.x=-PI/2;letter.position.set(0,.36,.2);
  const deck=anchoredBridge(w,...CRM_GEOGRAPHY.launch,6.2);
  pennant(w,deck,'01 / A QUESTION TAKES FLIGHT',5.1,V(0,.45,-1.3));
  const dispatch=w.leaf({parent:deck,width:1.8,height:2.3,text:'Aster Studio',subtitle:'One question. One person.'});dispatch.rotation.x=-PI/2;dispatch.position.set(-1.5,.15,-2.1);

  contextLandmark(w);reviewLandmark(w);replyLandmark(w);
  const [reviewX,reviewY,reviewZ]=CRM_GEOGRAPHY.review;
  const canopy=w.group();canopy.position.set(reviewX,reviewY,reviewZ);canopy.name='solar-review-canopy';
  const reviewBridge=anchoredBridge(w,reviewX,reviewY-.65,reviewZ-.5,8.2);
  // The glasshouse bears on a cantilevered terrace, with its feet fixed to the
  // perimeter and the central girders seated on the bridge's existing deck.
  w.box(18.8,.18,9.8,w.materials.iron,canopy,V(0,-.73,-1.5));
  for(const side of [-1,1]){
    w.beam(V(side*3.8,-.95,-6.4),V(side*3.8,-.95,3.4),.17,w.materials.iron,canopy);
    for(const z of [-6,-3,0,3]){
      w.beam(V(side*9,-.64,z),V(side*9,0,z),.11,w.materials.brass,canopy);
      w.beam(V(0,-.86,z),V(side*9.25,-.86,z),.13,w.materials.iron,canopy);
    }
  }
  for(const z of [-6,-3,0,3])arch(w,canopy,18,10,z,w.materials.brass);
  for(let i=0;i<=12;i++){
    const a=i/12*PI,x=Math.cos(a)*9,y=Math.sin(a)*10;
    w.beam(V(x,y,-6),V(x,y,3),.045,w.materials.bronze,canopy);
  }
  for(let j=0;j<3;j++)for(let i=0;i<12;i++){
    const a=i/12*PI,b=(i+1)/12*PI;
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([
      Math.cos(a)*8.94,Math.sin(a)*9.94,-6+j*3,Math.cos(b)*8.94,Math.sin(b)*9.94,-6+j*3,Math.cos(a)*8.94,Math.sin(a)*9.94,-3+j*3,
      Math.cos(b)*8.94,Math.sin(b)*9.94,-6+j*3,Math.cos(b)*8.94,Math.sin(b)*9.94,-3+j*3,Math.cos(a)*8.94,Math.sin(a)*9.94,-3+j*3,
    ],3));geo.computeVertexNormals();w.mesh(geo,w.materials.glass,canopy);
  }
  w.beam(V(-4,.35,0),V(4,.35,0),.09,w.materials.brass,canopy);
  for(const s of [-1,1])w.beam(V(s*3.6,-.6,0),V(s*3.6,.35,0),.075,w.materials.bronze,canopy);
  pennant(w,canopy,'DRAFT / FOR REVIEW',4.5,V(0,11.3,3.9));
  for(const side of [-1,1])w.beam(V(side*2.7,12.1,3.9),V(side*2.7,9.54,3),.035,w.materials.brass,canopy);
  batchArchitecture(canopy);
  const draft=printed(w,2.55,3.15,(ctx,cw,ch)=>{
    paper(ctx,cw,ch);type(ctx,'DRAFT / FOR REVIEW',cw*.09,ch*.1,cw*.05,tint,'monospace');rule(ctx,cw*.09,ch*.15,cw*.82);
    type(ctx,'A considered',cw*.09,ch*.28,cw*.115);type(ctx,'response.',cw*.09,ch*.39,cw*.115);
    type(ctx,'Here is the onboarding',cw*.09,ch*.54,cw*.065);type(ctx,'outline you requested.',cw*.09,ch*.62,cw*.065);lines(ctx,cw*.09,ch*.73,cw*.75,5);
  },craft);draft.rotation.x=-PI/2;draft.position.set(2.7,.64,.1);draft.material.transparent=true;draft.material.depthWrite=false;
  const reply=printed(w,2.4,2.8,(ctx,cw,ch)=>{
    paper(ctx,cw,ch);type(ctx,'MORGAN / THE REPLY',cw*.1,ch*.12,cw*.055,tint,'monospace');rule(ctx,cw*.1,ch*.17,cw*.8);
    type(ctx,'This answers',cw*.1,ch*.37,cw*.105);type(ctx,'my question.',cw*.1,ch*.49,cw*.105);type(ctx,'Thank you.',cw*.1,ch*.68,cw*.105);stamp(ctx,cw*.79,ch*.86,cw*.07,tint);
  });reply.rotation.x=-PI/2;reply.name='crm-customer-reply';reply.material.transparent=true;reply.material.depthWrite=false;

  const contexts=[['CONTACT','Morgan Hale'],['COMPANY','Aster Studio'],['CONVERSATION','The original question']].map(([name,label],i)=>{
    const g=w.group();g.name=`retained-${name.toLowerCase()}`;
    const page=printed(w,2.15,2.8,(ctx,cw,ch)=>{paper(ctx,cw,ch);type(ctx,name,cw*.09,ch*.12,cw*.06,tint,'monospace');rule(ctx,cw*.09,ch*.18,cw*.8);type(ctx,label,cw*.09,ch*.34,cw*.075);lines(ctx,cw*.09,ch*.48,cw*.77,6);stamp(ctx,cw*.79,ch*.86,cw*.067,tint);},g);
    page.rotation.x=-PI/2;
    const source=V(-29+i*9,i===1?35:31,73),slot=V([-3.3,-1.8,3.3][i],.48+(i*.025),i===1?2.05:1.6);
    const shelf=w.group();shelf.name=`crm-context-balcony-${i}`;shelf.position.copy(source);w.box(4,.14,3,w.materials.bronze,shelf,V(0,-.17,0));pennant(w,shelf,name,2.4,V(0,1.8,-.8));
    for(const side of [-1,1]){w.beam(V(side*1.8,-.25,0),V(side*1.8,-5,-10),.12,w.materials.iron,shelf);w.beam(V(side*1.8,-.25,-1.3),V(side*1.8,-.25,-10),.09,w.materials.bronze,shelf);}batchArchitecture(shelf);
    return {g,source,slot,index:i};
  });
  const flight=createCorrespondenceFlight(),camera=flight.camera;
  const stage=['A question takes flight','Understanding creates lift','A considered response','The conversation rises'];
  const position=V(),end=V();
  return {title:'The Letter That Learned to Fly',stages:stage,camera,update(p,t){
    const state=flight.pose(p);position.copy(state.position);
    craft.position.copy(position);
    craft.quaternion.copy(state.quaternion);
    const folded=.035+.22*(1-span(p,0,.09))+.12*Math.abs(state.bank)+Math.max(0,-state.tangent.y)*.08+Math.sin(t*1.1)*.006*(1-span(p,.49,.57)*(1-span(p,.69,.76)));
    wing.userData.left.rotation.z=-folded;wing.userData.right.rotation.z=folded;
    const review=span(p,.49,.57)*(1-span(p,.69,.76));
    draft.visible=review>0;draft.material.opacity=review;
    letter.position.x=-review*.5;
    craft.updateMatrixWorld(true);
    for(const item of contexts){
      const progress=span(p,.235+item.index*.012,.28+item.index*.015);end.copy(item.slot).applyMatrix4(craft.matrixWorld);
      item.g.position.copy(bezier(item.source,item.source.clone().add(V(-3,2,13)),end.clone().add(V(-5,3,9)),end,progress));
      item.g.quaternion.identity().slerp(craft.quaternion,progress);item.g.rotateZ(Math.sin(progress*PI)*(.2-item.index*.1));
      item.g.scale.setScalar(mix(.9,.59,progress));
    }
    const arrive=span(p,.78,.97);reply.material.opacity=span(p,.76,.8);reply.visible=p>.76;
    end.copy(V(-2.7,.65,-.1)).applyMatrix4(craft.matrixWorld);
    reply.position.copy(bezier(V(226,92,-64),V(222,105,-46),end.clone().add(V(-8,9,6)),end,arrive));
    reply.quaternion.identity().slerp(craft.quaternion,arrive).multiply(new T.Quaternion().setFromEuler(new T.Euler(-PI/2,0,0)));
    const chapter=Math.min(3,Math.round(p*3));
    w.narrative={chapter,subject:'Morgan Hale’s original question and retained correspondence',action:stage[chapter],contextLeavesJoined:contexts.filter((_,i)=>p>=.28+i*.015).length,reviewHold:p>=.57&&p<=.70,originalQuestionRetained:true,automaticSend:false,flightPosition:position.toArray(),flightQuaternion:craft.quaternion.toArray(),bank:state.bank,landmarks:CRM_GEOGRAPHY};
  }};
}

function makeSilkKite(w,parent,tint,label,scale=1){
  const g=w.group(parent);g.scale.setScalar(scale);const body=w.group(g);
  const corners=[V(0,3.3,0),V(3,0,0),V(0,-4.2,0),V(-3,0,0)],center=V(0,0,.48);
  const positions=[],uv=[];
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];positions.push(center.x,center.y,center.z,a.x,a.y,a.z,b.x,b.y,b.z);uv.push(.5,.56,(a.x+3)/6,(a.y+4.2)/7.5,(b.x+3)/6,(b.y+4.2)/7.5);}
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
  const ctx=canvas.getContext('2d');paper(ctx,768,1024,'#e0d6e8');
  ctx.fillStyle=tint;ctx.globalAlpha=.25;ctx.fillRect(0,0,768,360);ctx.globalAlpha=1;
  for(let i=0;i<24;i++){ctx.strokeStyle='rgba(75,47,80,.075)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(i*35,0);ctx.lineTo(i*35,1024);ctx.stroke();}
  stamp(ctx,384,330,64,tint);type(ctx,'ONE VOICE.',160,505,65,'#3d294c');type(ctx,label,160,580,31,'#3d294c','monospace');rule(ctx,160,620,440,'#93729f');lines(ctx,160,670,415,6);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const mat=new T.MeshPhysicalMaterial({map:texture,color:'#fff5ef',roughness:.71,metalness:.02,side:T.DoubleSide,sheen:.8,sheenColor:new T.Color(tint)});
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();w.mesh(geo,mat,body);
  w.beam(corners[0],corners[2],.032,w.materials.brass,body);w.beam(corners[1],corners[3],.032,w.materials.brass,body);
  for(let i=0;i<4;i++){w.beam(corners[i],corners[(i+1)%4],.019,w.materials.bronze,body);pin(w,body,corners[i],.055);}
  batchArchitecture(body);
  const ribbonGeometry=new T.BufferGeometry(),arr=new Float32Array(41*2*3),uvs=new Float32Array(41*2*2),indices=[];
  for(let i=0;i<=40;i++){for(let s=0;s<2;s++){uvs[(i*2+s)*2]=s;uvs[(i*2+s)*2+1]=i/40;}if(i<40){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  ribbonGeometry.setAttribute('position',new T.BufferAttribute(arr,3));ribbonGeometry.setAttribute('uv',new T.BufferAttribute(uvs,2));ribbonGeometry.setIndex(indices);
  const ribbon=w.mesh(ribbonGeometry,mat,g);
  return {root:g,flutter(time,progress){
    for(let i=0;i<=40;i++){const u=i/40,base=i*6;const sway=Math.sin(u*8-time*.6)*u*.22;
      for(let s=0;s<2;s++){arr[base+s*3]=(s?1:-1)*(.24-.13*u)+Math.sin(u*4+progress*2)*u*.8;arr[base+s*3+1]=-4.2-u*6.5;arr[base+s*3+2]=sway+u*u*.8;}}
    ribbonGeometry.attributes.position.needsUpdate=true;ribbonGeometry.computeVertexNormals();
  }};
}

function buildOnyx(w){
  const tint=rgb(w),hero=makeSilkKite(w,w.root,tint,'THE ORIGINAL IDEA');hero.root.name='one-voice-publishing-kite';
  const loom=w.group();loom.position.set(-3,8,7);loom.name='editorial-silk-loom';
  const deck=anchoredBridge(w,-3,4.2,8,8);
  for(const s of [-1,1]){
    w.beam(V(s*4,-3,0),V(s*4,6,0),.16,w.materials.iron,loom);
    w.beam(V(s*4,5,0),V(s*4,7,-4),.09,w.materials.brass,loom);
  }
  w.beam(V(-4,5,0),V(4,5,0),.18,w.materials.brass,loom);
  for(let i=0;i<15;i++)w.beam(V(-3.5+i*.5,-2,.15),V(-3.5+i*.5,5,.15),.007,w.materials.cloth,loom);
  pennant(w,loom,'THE VOICE IS YOURS',5.7,V(0,5.8,0));
  const source=w.leaf({parent:loom,width:2.8,height:3.5,text:'One clear idea.',subtitle:'BRAND VOICE / FOR REVIEW'});source.position.set(0,1,.2);
  batchArchitecture(loom);
  const destinations=[{x:-13,y:17,z:-20,name:'A CONVERSATION',label:'X / TWITTER'},{x:1,y:24,z:-24,name:'A PERSPECTIVE',label:'LINKEDIN'},{x:15,y:19,z:-21,name:'A MOMENT',label:'INSTAGRAM'}];
  const editions=destinations.map((d,i)=>{
    const portal=w.group();portal.position.set(d.x,d.y-2.8,d.z);arch(w,portal,7,7,0);
    for(const s of [-1,1]){w.beam(V(s*3.5,0,0),V(s*3.5,-4,-10),.12,w.materials.iron,portal);w.beam(V(s*3.5,0,0),V(s*3.5,0,-10),.07,w.materials.brass,portal);}
    pennant(w,portal,d.label,4.7,V(0,7.5,0));
    batchArchitecture(portal);
    const kite=makeSilkKite(w,w.root,tint,d.name,.66);kite.root.name=`edition-${i+1}`;return {kite,d,index:i};
  });
  const path=new T.CatmullRomCurve3([V(-3,8.7,7.8),V(-2,12,4),V(1,15,-2),V(2,18,-7),V(3,24,-15),V(3,30,-27)],false,'centripetal');
  const camera=flightPath([
    {p:0,eye:[9,15,24],target:[-3,9,7],fov:44,roll:-.035},
    {p:.24,eye:[13,19,21],target:[-1,13,2],fov:43,roll:.04},
    {p:.48,eye:[13,24,16],target:[2,17,-5],fov:44,roll:0},
    {p:.70,eye:[24,28,22],target:[2,20,-10],fov:51,roll:-.035},
    {p:.88,eye:[21,32,9],target:[1,23,-19],fov:49,roll:-.025},
    {p:1,eye:[20,39,4],target:[3,28,-24],fov:49,roll:0},
  ]);
  const stage=['Find the voice','Give the idea wings','Respect each audience','Choose the next flight'];
  return {title:'One Voice. Many Horizons.',stages:stage,camera,update(p,t){
    const launch=span(p,0,.48),finish=span(p,.76,1),spread=span(p,.48,.76);
    const pathProgress=p<.48?launch*.56:p<.76?.56:mix(.56,1,finish);
    hero.root.position.copy(path.getPoint(pathProgress));hero.root.rotation.set(-.42+finish*.13,.13+Math.sin(p*PI)*.23,Math.sin(p*PI*2)*.11);
    hero.flutter(t,p);
    const open=span(p,0,.19);hero.root.scale.set(1,.7+.3*open,1);
    for(const {kite,d,index} of editions){
      const a=hero.root.position.clone().add(V((index-1)*.18,-.3,-.2)),end=V(d.x,d.y+1,d.z+3);
      const q=span(p,.48+index*.018,.86+index*.018);
      kite.root.visible=p>.46;kite.root.position.copy(bezier(a,a.clone().add(V((index-1)*7,4,-2)),end.clone().add(V((1-index)*3,2,5)),end,q));
      kite.root.rotation.set(-.4,-.15+(index-1)*-.24,Math.sin(q*PI)*(index-1)*-.25);
      kite.root.scale.setScalar(.66*(.45+.55*span(p,.46,.6)));kite.flutter(t+index*.7,p);
    }
    const chapter=Math.min(3,Math.round(p*3));
    w.narrative={chapter,subject:'One printed voice with three audience-specific silk editions',action:stage[chapter],editions:spread>.1?3:0,sharedVoiceRetained:true,reviewHold:p>=.35&&p<=.48,automaticPublish:false};
  }};
}

function buildCMS(w){
  const tint=rgb(w),root=w.group();root.name='the-story-becomes-a-world';
  const start=anchoredBridge(w,-4,4.7,9,8);
  const book=w.group(root);book.position.set(-4,6.1,9);book.rotation.set(-PI/2,0,-.13);
  for(const s of [-1,1]){
    w.box(3.8,5.2,.13,w.materials.bronze,book,V(s*1.95,0,-.1));
    const page=printed(w,3.6,5,(ctx,cw,ch)=>{
      paper(ctx,cw,ch);type(ctx,s<0?'A STORY BEGINS':'WITH AN INTENTION',cw*.09,ch*.09,cw*.045,tint,'monospace');
      if(s<0){type(ctx,'Make room',cw*.09,ch*.25,cw*.13);type(ctx,'for wonder.',cw*.09,ch*.36,cw*.13);illustration(ctx,cw*.09,ch*.46,cw*.82,ch*.32,tint);}
      else{type(ctx,'Something',cw*.09,ch*.24,cw*.12);type(ctx,'worth sharing.',cw*.09,ch*.35,cw*.105);lines(ctx,cw*.09,ch*.47,cw*.79,7);stamp(ctx,cw*.5,ch*.8,cw*.12,tint);}
      rule(ctx,cw*.09,ch*.92,cw*.82);type(ctx,s<0?'01':'02',cw*.09,ch*.975,cw*.045,tint,'monospace');
    },book);page.position.set(s*1.95,0,.02);
  }
  w.beam(V(0,-2.65,0),V(0,2.65,0),.09,w.materials.brass,book);
  batchArchitecture(book);
  pennant(w,start,'A GOOD IDEA DESERVES A WORLD',6.2,V(0,1.1,-1));
  const route=new T.CatmullRomCurve3([V(-4,6.2,6.6),V(-4,8.2,1.5),V(2,12,-3),V(8,15.3,-7),V(6,18.3,-12),V(-2,21,-17),V(-6,24,-22),V(0,28,-30)],false,'centripetal');
  const rows=180,columns=8,vertices=new Float32Array((rows+1)*(columns+1)*3),uvs=new Float32Array((rows+1)*(columns+1)*2),indices=[];
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=4096;const ctx=canvas.getContext('2d');paper(ctx,1024,4096);
  const titles=[['Find the story.','A question worth asking.'],['Give it rhythm.','Let one section lead to another.'],['A wider world.','Keep the meaning in every format.'],['Ready to share.','Every ending is a new beginning.']];
  for(let i=0;i<4;i++){
    const y=(3-i)*1024;type(ctx,`BASALT / STORY ATLAS / 0${i+1}`,94,y+88,28,tint,'monospace');rule(ctx,94,y+120,836);
    type(ctx,titles[i][0],94,y+235,77);type(ctx,titles[i][1],94,y+300,31);
    illustration(ctx,94,y+365,836,380,tint);lines(ctx,94,y+815,790,6);stamp(ctx,884,y+925,34,tint);
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const mat=new T.MeshStandardMaterial({map:tex,color:'#fff5e8',side:T.DoubleSide,roughness:.88});
  const edgeLeft=[],edgeRight=[],centers=[],rights=[],widths=[];
  for(let i=0;i<=rows;i++){
    const u=i/rows,center=route.getPoint(u),tangent=route.getTangent(u),right=V().crossVectors(tangent,V(0,1,0)).normalize();
    const width=6.8-1.35*Math.sin(u*PI)**2;centers.push(center);rights.push(right);widths.push(width);
    edgeLeft.push(center.clone().addScaledVector(right,-width*.5));edgeRight.push(center.clone().addScaledVector(right,width*.5));
    for(let j=0;j<=columns;j++){
      const k=i*(columns+1)+j;uvs[k*2]=j/columns;uvs[k*2+1]=u;
      if(i<rows&&j<columns){const n=k+columns+1;indices.push(k,n,k+1,k+1,n,n+1);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setIndex(indices);
  const ribbon=w.mesh(geometry,mat,root);ribbon.name='continuous-illustrated-story-ribbon';ribbon.frustumCulled=false;
  // Fine structural cords make the sheet a crafted suspended folio, not a UI plane.
  w.tube(edgeLeft,.025,w.materials.brass,root);w.tube(edgeRight,.025,w.materials.brass,root);
  const gates=[{u:.36,label:'COMPOSITION',width:12,height:10},{u:.59,label:'EVERY SCREEN',width:9,height:12},{u:.85,label:'FINAL REVIEW',width:7.5,height:13}];
  for(const gate of gates){
    const center=route.getPoint(gate.u),tangent=route.getTangent(gate.u),g=w.group(root);g.position.copy(center);g.position.y-=.45;g.rotation.y=Math.atan2(-tangent.x,-tangent.z);
    arch(w,g,gate.width,gate.height,0,w.materials.brass);
    for(const s of [-1,1]){
      w.beam(V(s*gate.width*.5,0,0),V(s*gate.width*.5,-12,-13),.15,w.materials.iron,g);
      for(let i=0;i<5;i++)w.box(.45,.35,.6,w.materials.brass,g,V(s*gate.width*.5,i*.28,0));
    }
    pennant(w,g,gate.label,4.5,V(0,gate.height+.6,0));
    batchArchitecture(g);
  }
  const frontier=w.group(root);frontier.name='unfolding-linen-binding';
  const roll=w.mesh(new T.CylinderGeometry(.47,.47,6.7,36,1),w.materials.paper,frontier);roll.rotation.z=PI/2;
  for(const s of [-1,1]){
    const cap=w.mesh(new T.CylinderGeometry(.52,.52,.09,24),w.materials.brass,frontier,V(s*3.4,0,0));cap.rotation.z=PI/2;
  }
  batchArchitecture(frontier);
  const camera=flightPath([
    {p:0,eye:[8,15,23],target:[-3,6.4,7.3],fov:43,roll:-.03},
    {p:.22,eye:[13,19,18],target:[-1,10,1],fov:43,roll:.03},
    {p:.45,eye:[22,26,12],target:[7,15,-7],fov:44,roll:.045},
    {p:.69,eye:[13,31,7],target:[1,21,-17],fov:45,roll:-.035},
    {p:.85,eye:[7,35,-1],target:[-4,25,-23],fov:45,roll:-.02},
    {p:1,eye:[23,45,19],target:[1,20,-11],fov:53,roll:0},
  ]);
  const stage=['Find the story','Give the idea a rhythm','Keep the meaning in every format','Open the next chapter'];
  return {title:'The Story Becomes a World',stages:stage,camera,update(p,t){
    const unfolding=mix(.04,1,span(p,0,.88));
    for(let i=0;i<=rows;i++){
      const u=i/rows,center=centers[i],right=rights[i],width=widths[i];
      const nose=clamp((u-unfolding+.035)/.035);
      for(let j=0;j<=columns;j++){
        const side=j/columns-.5,k=(i*(columns+1)+j)*3,edge=Math.abs(side)*2;
        vertices[k]=center.x+right.x*side*width;
        vertices[k+1]=center.y+Math.pow(edge,2)*.20+Math.sin(u*35+t*.3)*.025*edge+nose*nose*.65;
        vertices[k+2]=center.z+right.z*side*width;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.setDrawRange(0,Math.floor(unfolding*rows)*columns*6);geometry.computeVertexNormals();
    const location=route.getPoint(unfolding),tangent=route.getTangent(unfolding);frontier.position.copy(location);frontier.position.y+=.39;frontier.rotation.set(0,Math.atan2(-tangent.x,-tangent.z),0);
    frontier.visible=p<.94;
    book.rotation.z=-.13+Math.sin(t*.2)*.002;
    const chapter=Math.min(3,Math.round(p*3));
    w.narrative={chapter,subject:'One continuous illustrated folio',action:stage[chapter],storyUnfolded:Number(unfolding.toFixed(3)),continuousContent:true,reviewHold:p>.7&&p<.85,automaticPublish:false};
  }};
}

export const flightEditorial={network:buildCRM,crystal:buildOnyx,pages:buildCMS};
