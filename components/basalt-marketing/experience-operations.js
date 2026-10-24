import { T, V, ease, phase, batchArchitecture } from './flight-kit.js';

const PI=Math.PI;
const mix=(a,b,p)=>a+(b-a)*p;

// Non-uniform Hermite tangents preserve camera velocity between authored shots.
// The dolly settles only at the beginning/end, not at every camera waypoint.
function operationCamera(shots){
  const fields=['eye','target'];
  const curves=Object.fromEntries(fields.map(key=>{
    const points=shots.map(s=>V(...s[key]));
    const tangents=points.map((point,i)=>i===0||i===points.length-1?V():points[i+1].clone().sub(points[i-1]).divideScalar(shots[i+1].p-shots[i-1].p));
    return[key,{points,tangents}];
  }));
  return progress=>{
    const p=T.MathUtils.clamp(progress,0,1);let i=0;while(i<shots.length-2&&p>shots[i+1].p)i++;
    const a=shots[i],b=shots[i+1],span=b.p-a.p,u=(p-a.p)/span,u2=u*u,u3=u2*u;
    const result={fov:mix(a.fov,b.fov,ease(u)),roll:mix(a.roll||0,b.roll||0,ease(u))};
    for(const key of fields){const {points,tangents}=curves[key];result[key]=points[i].clone().multiplyScalar(2*u3-3*u2+1).addScaledVector(tangents[i],(u3-2*u2+u)*span).addScaledVector(points[i+1],-2*u3+3*u2).addScaledVector(tangents[i+1],(u3-u2)*span);}
    return result;
  };
}

function batch(root,articulated=[]){
  const detached=articulated.map(node=>({node,parent:node.parent}));
  root.traverse(node=>{if(node.isInstancedMesh&&!detached.some(item=>item.node===node))detached.push({node,parent:node.parent});});
  detached.forEach(({node})=>node.removeFromParent());
  batchArchitecture(root);
  detached.forEach(({node,parent})=>parent.add(node));
}

function cylinder(w,parent,radius,height,material,position,segments=32,top=radius){
  return w.mesh(new T.CylinderGeometry(top,radius,height,segments),material,parent,position);
}

function curve(w,parent,points,radius,material,segments=48){
  return w.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,8,false),material,parent);
}

function arc(w,parent,radius,start,end,y,z,material,tube=.06){
  return curve(w,parent,Array.from({length:25},(_,i)=>{const a=mix(start,end,i/24);return V(Math.cos(a)*radius,y+Math.sin(a)*radius,z);}),tube,material,48);
}

function pointedArch(w,parent,width,height,depth,material,band=.55){
  const s=new T.Shape();
  s.moveTo(-width/2,0);s.lineTo(-width/2,height*.62);
  s.bezierCurveTo(-width/2,height*.82,-width*.18,height*.95,0,height);
  s.bezierCurveTo(width*.18,height*.95,width/2,height*.82,width/2,height*.62);
  s.lineTo(width/2,0);s.lineTo(width/2-band,0);s.lineTo(width/2-band,height*.62);
  s.bezierCurveTo(width/2-band,height*.8,width*.17,height*.9,0,height-band);
  s.bezierCurveTo(-width*.17,height*.9,-width/2+band,height*.8,-width/2+band,height*.62);
  s.lineTo(-width/2+band,0);s.closePath();
  return w.mesh(new T.ExtrudeGeometry(s,{depth,steps:1,curveSegments:20,bevelEnabled:true,bevelSegments:2,bevelSize:.055,bevelThickness:.055}),material,parent,V(0,0,-depth/2));
}

function archFill(w,parent,width,height,depth,material){
  const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(-width/2,height*.62);
  s.bezierCurveTo(-width/2,height*.82,-width*.18,height*.95,0,height);
  s.bezierCurveTo(width*.18,height*.95,width/2,height*.82,width/2,height*.62);s.lineTo(width/2,0);s.closePath();
  return w.mesh(new T.ExtrudeGeometry(s,{depth,steps:1,curveSegments:16,bevelEnabled:false}),material,parent,V(0,0,-depth/2));
}

function plaque(w,parent,title,subtitle,width=4){
  return w.leaf({parent,width,height:width*.33,text:title,subtitle});
}

function stoneColumn(w,parent,position,height,radius=.6){
  const g=w.group(parent);g.position.copy(position);
  cylinder(w,g,radius*1.35,.4,w.materials.stone,V(0,.2,0),16);
  cylinder(w,g,radius,height-.85,w.materials.stone,V(0,height/2,0),20,radius*.82);
  cylinder(w,g,radius*1.25,.26,w.materials.bronze,V(0,height-.45,0),16);
  cylinder(w,g,radius*1.45,.35,w.materials.stone,V(0,height-.16,0),16);
  for(let i=0;i<8;i++){
    const a=i/8*PI*2;
    w.beam(V(Math.cos(a)*radius*.91,.65,Math.sin(a)*radius*.91),V(Math.cos(a)*radius*.79,height-.7,Math.sin(a)*radius*.79),.028,w.materials.bronze,g);
  }
  return g;
}

function tree(w,parent,position,height=7,seed=0){
  const g=w.group(parent);g.position.copy(position);
  const bark=w.materials.bronze;
  const crownGeometry=new T.SphereGeometry(1,16,12),vertices=crownGeometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),n=1+.1*Math.sin(x*8+seed)*Math.cos(z*7-y*3)+.065*Math.sin(y*11+x*4);
    vertices.setXYZ(i,x*n,y*n,z*n);
  }crownGeometry.computeVertexNormals();
  cylinder(w,g,.22,height*.65,bark,V(0,height*.325,0),10,.1);
  for(let i=0;i<6;i++){
    const a=i/6*PI*2+seed,r=height*.2,tip=V(Math.cos(a)*r,height*(.62+(i%2)*.12),Math.sin(a)*r);
    w.beam(V(0,height*.42,0),tip,.07,bark,g);
    const crown=w.mesh(crownGeometry.clone(),w.materials.green,g,tip);
    crown.scale.set(height*.25,height*.21,height*.24);
  }
  const top=w.mesh(crownGeometry,w.materials.green,g,V(0,height*.85,0));top.scale.set(height*.25,height*.28,height*.25);
  cylinder(w,g,height*.24,.25,w.materials.stone,V(0,.12,0),32);
  return g;
}

function trellis(w,parent,x,y,z,width=3,height=7){
  const {bronze,green}=w.materials;
  for(const sign of [-1,1])w.beam(V(x+sign*width/2,y,z),V(x+sign*width/2,y+height,z),.025,bronze,parent);
  for(let j=0;j<5;j++)w.beam(V(x-width/2,y+j*height/4,z),V(x+width/2,y+j*height/4,z),.02,bronze,parent);
  const points=Array.from({length:16},(_,i)=>V(x+Math.sin(i*.6)*width*.37,y+i/15*height,z+.04));
  curve(w,parent,points,.035,bronze,30);
  const leaves=new T.InstancedMesh(new T.SphereGeometry(1,8,5),green,30),dummy=new T.Object3D();
  for(let i=0;i<30;i++){
    const u=i/29,side=i%2?1:-1;dummy.position.set(x+Math.sin(u*15*.6)*width*.37+side*.14,y+u*height,z+.08);
    dummy.rotation.set(.2,0,side*.6);dummy.scale.set(.14,.3,.04);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  }parent.add(leaves);
}

function surface(w,parent,sample,material,nu=24,nv=12){
  const positions=[],uv=[],indices=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
    const p=sample(i/nu,j/nv);positions.push(p.x,p.y,p.z);uv.push(i/nu,j/nv);
  }
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return w.mesh(g,material,parent);
}

function barrelRoof(w,parent,width,length,y,material){
  const sample=(u,v)=>V(Math.cos(u*PI)*width/2,y+Math.sin(u*PI)*width*.38,(v-.5)*length);
  surface(w,parent,sample,material,24,10);
  for(const v of [0,.25,.5,.75,1])curve(w,parent,Array.from({length:17},(_,i)=>sample(i/16,v)),.065,w.materials.bronze,30);
  for(const u of [.16,.33,.5,.67,.84])curve(w,parent,Array.from({length:8},(_,i)=>sample(u,i/7)),.035,w.materials.brass,12);
}

function pavilion(w,parent,data){
  const {stone,bronze,brass,glass}=w.materials,g=w.group(parent);g.position.set(data.x,0,data.z);
  const enamel=new T.MeshPhysicalMaterial({color:data.color,metalness:.25,roughness:.42,clearcoat:.5});
  const windows=new T.MeshStandardMaterial({color:'#777258',emissive:data.color,emissiveIntensity:.1,roughness:.6});
  const width=data.type==='hall'?12:8,depth=data.type==='hall'?8:7,height=data.height;
  w.box(width+1,.5,depth+1,stone,g,V(0,.25,0));
  w.box(width,height,depth,stone,g,V(0,height/2+.5,0));
  w.box(width+.4,.3,depth+.4,bronze,g,V(0,height+.6,0));
  for(const side of [-1,1]){
    w.box(.65,height+.7,depth+.45,stone,g,V(side*(width/2+.05),(height+.7)/2,.05));
    for(let i=0;i<3;i++){
      const x=(i-1)*width*.28,window=w.group(g);window.position.set(x,1.4,depth/2+.08);
      archFill(w,window,width*.21,height*.66,.06,windows);
      pointedArch(w,window,width*.23,height*.69,.35,bronze,.1);
      w.beam(V(0,.2,.24),V(0,height*.62,.24),.04,brass,window);
      w.beam(V(-width*.1,height*.35,.24),V(width*.1,height*.35,.24),.035,brass,window);
    }
    break;
  }
  if(data.type==='spire'){
    for(const x of [-2.6,2.6]){
      cylinder(w,g,1.8,3,stone,V(x,height+2,0),12);
      w.mesh(new T.ConeGeometry(2,6,12),enamel,g,V(x,height+6.5,0));
      cylinder(w,g,.06,2,brass,V(x,height+10,0),8);
    }
  }else if(data.type==='hall'){
    barrelRoof(w,g,width+.6,depth+.6,height+.5,glass);
  }else if(data.type==='fan'){
    for(let i=0;i<5;i++){
      const panel=w.group(g);panel.position.y=height+.7;panel.rotation.z=(i-2)*.12;
      w.box(1.5,.18,depth+.8,enamel,panel,V((i-2)*1.65,.4,0));
      w.box(.07,.28,depth+.9,brass,panel,V((i-2)*1.65,.6,0));
    }
  }else if(data.type==='bell'){
    for(const x of [-2.7,2.7])stoneColumn(w,g,V(x,height+.7,0),5,.38);
    const bell=cylinder(w,g,1.6,2.5,brass,V(0,height+3.5,0),32,.55);
    w.mesh(new T.ConeGeometry(4.3,3,4),enamel,g,V(0,height+7,0)).rotation.y=PI/4;
    w.beam(V(-3,height+5.5,0),V(3,height+5.5,0),.15,bronze,g);
  }else if(data.type==='fort'){
    for(const x of [-3.4,3.4])for(const z of [-2.8,2.8]){
      cylinder(w,g,1.2,height+2,stone,V(x,(height+2)/2,z),8);
      cylinder(w,g,1.4,.5,enamel,V(x,height+2,z),8);
    }
  }else{
    const roof=w.mesh(new T.ConeGeometry(width*.77,height*.36,4),enamel,g,V(0,height+height*.18+.6,0));roof.rotation.y=PI/4;
  }
  const label=plaque(w,g,data.name,'A PLACE FOR YOUR WORK',width*.64);label.position.set(0,height*.79,depth/2+.42);
  for(const x of [-width/2-1.3,width/2+1.3])tree(w,g,V(x,0,1),4.5,data.x);
  trellis(w,g,-width/2+.65,1,depth/2+.35,1.1,height*.65);
  return{g,windows,data};
}

function buildHQ(w){
  const {stone,bronze,brass,iron,glass,green}=w.materials;
  const fixed=w.group();fixed.name='hq-living-garden-city';
  const pale=stone.clone();pale.color.set('#827d65');
  const pathMaterial=new T.MeshStandardMaterial({color:'#b5a788',roughness:.92});
  const blue=new T.MeshPhysicalMaterial({color:'#2e90bc',metalness:.42,roughness:.24,clearcoat:1});
  const crownEnamel=blue.clone();crownEnamel.side=T.DoubleSide;
  const water=new T.MeshPhysicalMaterial({color:'#285965',metalness:.3,roughness:.22,transparent:true,opacity:.83});
  const blueLight=new T.MeshStandardMaterial({color:'#86cdf4',emissive:'#4faaff',emissiveIntensity:.4,roughness:.4});
  w.box(180,2,190,stone,fixed,V(0,-1.2,-38));
  w.box(120,.14,145,pale,fixed,V(0,-.12,-36));
  // A broad, continuous avenue grounds the entrance and distant city.
  w.box(11,.12,100,pathMaterial,fixed,V(0,0,-33));
  for(const x of [-5.7,5.7])w.box(.16,.13,100,bronze,fixed,V(x,.03,-33));
  for(let z=24;z>-82;z-=3.8)w.box(10.8,.035,.08,bronze,fixed,V(0,.09,z));

  const threshold=w.group(fixed);threshold.position.z=8;
  pointedArch(w,threshold,19,25,3.4,stone,1.8);
  const inner=pointedArch(w,threshold,16.2,23.3,.65,bronze,.27);inner.position.z=1.85;
  const line=pointedArch(w,threshold,15,22.4,.15,brass,.1);line.position.z=2.25;
  for(const x of [-12.5,12.5]){
    stoneColumn(w,threshold,V(x,0,0),27,1.65);
    w.box(7,29,5,stone,threshold,V(x+(x<0?-3:3),14.5,-2));
    trellis(w,threshold,x+(x<0?-2:2),2,1.2,3,17);
  }
  // Actual carved doors, with individually modelled inset panels and hinges.
  const doors=[];
  for(const side of [-1,1]){
    const door=w.group(threshold);door.position.set(side*7.5,.15,.7);door.name=`hq-entrance-door-${side}`;
    w.box(7.45,16.6,.9,iron,door,V(-side*3.725,8.3,0));
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
      const x=-side*(1.9+col*3.4),y=3+row*5.15;
      w.box(2.9,4.45,.16,stone,door,V(x,y,.52));
      w.box(2.6,4.15,.12,bronze,door,V(x,y,.62));
      w.box(2.35,3.9,.1,iron,door,V(x,y,.7));
      const relief=pointedArch(w,door,2.0,3.5,.12,brass,.075);relief.position.set(x,y-1.65,.81);
    }
    for(const y of [2,8.3,14.6])cylinder(w,door,.25,1.4,brass,V(0,y,.3),16);
    for(const x of [1,3.6,6.5])w.box(.06,15.8,.1,brass,door,V(-side*x,8.4,.8));
    const handle=w.mesh(new T.TorusGeometry(.45,.08,10,32),brass,door,V(-side*6.45,7.7,.95));handle.scale.y=1.45;
    doors.push({g:door,side});
  }
  const key=w.mesh(new T.CylinderGeometry(.8,1.1,.45,6),blue,threshold,V(0,19.4,2.5));key.rotation.x=PI/2;
  const keyHalo=w.mesh(new T.TorusGeometry(1.25,.06,10,48),brass,threshold,V(0,19.4,2.5));
  for(let i=0;i<6;i++){const a=i*PI/3;w.beam(V(Math.cos(a)*1.5,19.4+Math.sin(a)*1.5,2.4),V(Math.cos(a)*2.2,19.4+Math.sin(a)*2.2,2.4),.05,brass,threshold);}
  const fanShape=new T.Shape();fanShape.moveTo(-7.45,16.75);fanShape.bezierCurveTo(-6.3,19.5,-2.1,21.65,0,22.3);fanShape.bezierCurveTo(2.1,21.65,6.3,19.5,7.45,16.75);fanShape.closePath();
  const fanGlass=glass.clone();fanGlass.color.set('#477d98');fanGlass.opacity=.6;
  w.mesh(new T.ShapeGeometry(fanShape,24),fanGlass,threshold,V(0,0,1.9));
  w.beam(V(-7.45,16.75,2.0),V(7.45,16.75,2.0),.09,bronze,threshold);
  for(const x of [-6,-3,0,3,6])w.beam(V(x*.3,16.8,2),V(x,22.1-Math.abs(x)*.53,2),.055,brass,threshold);

  const central=w.group(fixed);central.position.z=-28;central.name='hq-central-workspace-portal';
  cylinder(w,central,8.4,.55,pale,V(0,.1,0),64);
  const moat=cylinder(w,central,10.9,.08,water,V(0,.025,0),96);
  cylinder(w,central,8.3,.13,pathMaterial,V(0,.4,0),64);
  for(const radius of [8.2,10.95]){
    const edge=w.mesh(new T.TorusGeometry(radius,.07,8,96),bronze,central,V(0,radius<9?.39:.18,0));edge.rotation.x=PI/2;
  }
  // The entrance avenue keeps one permanent crossing while district bridges deploy.
  w.box(4.8,.13,3.2,pathMaterial,central,V(0,.4,9.7));
  for(const x of [-1.8,1.8])w.box(.2,.22,3.6,iron,central,V(x,.23,9.8));
  for(const side of [-1,1]){
    w.box(.5,.4,.5,stone,central,V(side*2,.2,11.35));
    w.beam(V(side*2.4,1.45,8.25),V(side*2.4,1.45,11.15),.045,brass,central);
    for(const z of [8.3,9.7,11.1])w.beam(V(side*2.4,.46,z),V(side*2.4,1.45,z),.035,bronze,central);
  }
  for(let i=0;i<4;i++){const height=.4-i*.1;w.box(4.8,height,.42,pathMaterial,central,V(0,.06+height/2,11.51+i*.42));}
  cylinder(w,central,5.9,.65,stone,V(0,.6,0),48);
  cylinder(w,central,6.55,.2,pale,V(0,.57,0),64);
  cylinder(w,central,6.2,.18,pale,V(0,.75,0),64);
  for(let i=0;i<8;i++){
    const a=i/8*PI*2+PI/8;
    // The portal arch carries the front of the dome. Keep the entry bay clear.
    if(Math.sin(a)>.8)continue;
    stoneColumn(w,central,V(Math.cos(a)*5.2,.85,Math.sin(a)*5.2),10,.45);
  }
  // A hinged crown opens the conservatory after the districts connect. The cap
  // sits on a continuous ring; each quarter turns around its own rim bearing.
  const crownAngle=.34,crownRadius=6.1*Math.sin(crownAngle),crownY=10.9+6.1*Math.cos(crownAngle),crown=[];
  w.mesh(new T.SphereGeometry(6.1,32,16,0,PI*2,crownAngle,PI/2-crownAngle),glass,central,V(0,10.9,0));
  for(let i=0;i<12;i++){
    const a=i/12*PI*2;
    curve(w,central,Array.from({length:17},(_,j)=>{const b=mix(crownAngle,PI/2,j/16);return V(Math.cos(a)*6.1*Math.sin(b),10.9+6.1*Math.cos(b),Math.sin(a)*6.1*Math.sin(b));}),.045,brass,32);
  }
  const crownRing=w.mesh(new T.TorusGeometry(crownRadius,.11,10,64),brass,central,V(0,crownY,0));crownRing.rotation.x=PI/2;
  for(let i=0;i<4;i++){
    const phi=i*PI/2,mid=phi+PI/4,radial=V(-Math.cos(mid),0,Math.sin(mid)),hinge=radial.clone().multiplyScalar(crownRadius);hinge.y=crownY;
    const petal=w.group(central);petal.position.copy(hinge);petal.name=`hq-conservatory-crown-${i}`;
    const geometry=new T.SphereGeometry(6.1,12,6,phi+.018,PI/2-.036,0,crownAngle);
    geometry.translate(-hinge.x,10.9-hinge.y,-hinge.z);w.mesh(geometry,crownEnamel,petal);
    const tangent=V(-radial.z,0,radial.x);
    w.beam(hinge.clone().addScaledVector(tangent,-.4),hinge.clone().addScaledVector(tangent,.4),.14,brass,central);
    crown.push({g:petal,axis:tangent,index:i});
  }
  const portal=w.group(central);portal.position.set(0,.9,4.55);
  pointedArch(w,portal,7.2,10.8,1.1,stone,.65);
  const portalInner=pointedArch(w,portal,5.8,9.8,.15,brass,.13);portalInner.position.z=.65;
  const portalBack=archFill(w,portal,5.4,9.4,.1,blueLight);portalBack.position.z=-4;
  const rearFrame=pointedArch(w,portal,6.2,10,.45,stone,.4);rearFrame.position.z=-4.12;
  for(const x of [-3.05,3.05])w.box(.3,7.1,4.25,stone,portal,V(x,3.55,-1.9));
  const passage=w.group(portal);passage.position.z=-1.9;barrelRoof(w,passage,6.2,4.25,7.1,stone);
  for(const x of [-1.6,0,1.6])w.beam(V(x,.2,-3.85),V(x,7.7,-3.85),.055,bronze,portal);
  // Short hinged leaves sit below the curved transom and swing into an empty bay.
  // A shaped fan avoids extending an opaque panel behind the open doorway.
  const portalFan=new T.Shape();portalFan.moveTo(-2.65,6.3);portalFan.bezierCurveTo(-2.5,7.6,-.8,8.9,0,9.3);portalFan.bezierCurveTo(.8,8.9,2.5,7.6,2.65,6.3);portalFan.closePath();
  w.mesh(new T.ShapeGeometry(portalFan,20),blue,portal,V(0,0,.1));
  w.beam(V(-2.65,6.3,.2),V(2.65,6.3,.2),.065,brass,portal);
  const portalDoors=[];
  for(const side of [-1,1]){
    const panel=w.group(portal);panel.position.set(side*2.65,.04,.1);panel.name=`hq-portal-door-${side}`;
    w.box(2.61,6.18,.26,iron,panel,V(-side*1.305,3.09,0));
    w.box(2.32,5.86,.08,blue,panel,V(-side*1.305,3.09,.17));
    for(const x of [.45,1.3,2.15])w.box(.045,5.6,.05,brass,panel,V(-side*x,3.09,.23));
    for(const y of [.8,3.1,5.4])cylinder(w,panel,.11,.5,brass,V(0,y,0),12);
    const handle=w.mesh(new T.TorusGeometry(.17,.035,8,24),brass,panel,V(-side*2.25,3.0,.28));handle.scale.y=1.35;
    portalDoors.push({g:panel,side});
  }
  // Mount the sign in front of and wholly above the pointed arch. Independent
  // posts stand outside the glass dome rather than disappearing into its skin.
  const signHeight=13.25,signZ=6.5;
  for(const side of [-1,1]){
    const x=side*3.85;
    cylinder(w,central,.3,.22,stone,V(x,.575,5.75),16);
    w.beam(V(x,.68,5.75),V(x,14.7,5.75),.105,bronze,central);
    w.beam(V(x,14.7,5.75),V(x,14.7,signZ),.11,brass,central);
    w.beam(V(x,13.8,5.75),V(x,14.7,signZ),.055,bronze,central);
    w.beam(V(side*2.6,14.7,signZ),V(side*2.6,14.34,signZ),.055,brass,central);
  }
  w.beam(V(-3.85,14.7,signZ),V(3.85,14.7,signZ),.13,bronze,central);
  const portalSign=plaque(w,central,'ONE CONNECTED WORKSPACE','ENTER BASALT HQ',6.8);portalSign.position.set(0,signHeight,signZ);portalSign.name='hq-connected-workspace-sign';

  const districts=[
    {name:'CRM',x:-20,z:-9,height:9,color:'#49a6a3',type:'roof'},
    {name:'ONYX',x:20,z:-10,height:10,color:'#88709d',type:'spire'},
    {name:'ERP',x:-26,z:-30,height:8,color:'#3c9a8c',type:'hall'},
    {name:'CMS',x:24,z:-31,height:10,color:'#8b81a5',type:'fan'},
    {name:'ECHO',x:-16,z:-51,height:9,color:'#c79c4a',type:'bell'},
    {name:'VIGIL',x:16,z:-52,height:12,color:'#a45c64',type:'fort'},
    {name:'SURGE',x:0,z:-66,height:9,color:'#b87543',type:'roof'}
  ].map(data=>pavilion(w,fixed,data));
  const bridges=[];
  districts.forEach(({data},i)=>{
    const delta=V(data.x,0,data.z+28),length=delta.length(),direction=delta.clone().normalize();
    const road=w.group(fixed);road.position.set(0,.4,-28);road.quaternion.setFromUnitVectors(V(1,0,0),direction);
    w.box(length-11.35,.515,2.3,pathMaterial,road,V((length+11.35)/2,-.1925,0));
    for(const side of [-1,1])w.box(length-11.35,.06,.09,bronze,road,V((length+11.35)/2,.03,side*1.18));
    const bridge=w.group(road);bridge.position.x=8.1;bridge.name=`hq-district-bridge-${i}`;
    w.box(3.2,.13,2.6,bronze,bridge,V(1.6,0,0));
    for(let j=0;j<10;j++)w.box(.065,.025,2.45,brass,bridge,V(.16+j*.32,.078,0));
    const hinge=cylinder(w,road,.13,2.85,brass,V(8.1,0,0),16);hinge.rotation.x=PI/2;
    for(const side of [-1,1])w.box(.45,.515,.4,stone,road,V(11.4,-.1925,side*1.1));
    for(const side of [-1,1]){
      w.beam(V(.15,1.05,side*1.3),V(3.05,1.05,side*1.3),.045,brass,bridge);
      for(const x of [.2,1.6,3.0])w.beam(V(x,.08,side*1.3),V(x,1.05,side*1.3),.035,bronze,bridge);
    }
    bridges.push({g:bridge,index:i});
  });

  // District shutters open outward only after their crossing lands. Instancing
  // keeps the individual hinges readable without adding dozens of draw calls.
  const shutters=new T.InstancedMesh(new T.BoxGeometry(1,1,1),bronze,42),shutterFrames=new T.InstancedMesh(new T.BoxGeometry(1,1,1),brass,168);
  shutters.name='hq-connected-district-shutters';shutters.castShadow=shutters.receiveShadow=true;shutterFrames.castShadow=true;fixed.add(shutters,shutterFrames);
  const shutterAt=new T.Object3D(),shutterLeaf=new T.Object3D(),shutterMatrix=new T.Matrix4(),shutterFrame=new T.Object3D();
  districts.forEach(({data},i)=>{const color=new T.Color(data.color);for(let leaf=0;leaf<6;leaf++)shutters.setColorAt(i*6+leaf,color);});
  function updateShutters(p){
    let n=0;
    districts.forEach(({data},district)=>{
      const width=data.type==='hall'?12:8,depth=data.type==='hall'?8:7,leafWidth=width*.21*.47,height=data.height*.38;
      const open=phase(p,.49+district*.026,.66+district*.028);
      for(let i=0;i<3;i++)for(const side of [-1,1]){
        shutterAt.position.set(data.x+(i-1)*width*.28+side*width*.105,1.55,data.z+depth/2+.4);
        shutterAt.rotation.y=side*1.65*open;shutterAt.updateMatrix();
        shutterLeaf.position.set(-side*leafWidth/2,height/2,0);shutterLeaf.scale.set(leafWidth,height,.08);shutterLeaf.updateMatrix();
        shutterMatrix.multiplyMatrices(shutterAt.matrix,shutterLeaf.matrix);shutters.setMatrixAt(n,shutterMatrix);
        for(let edge=0;edge<4;edge++){
          shutterFrame.position.set(-side*leafWidth/2+(edge<2?(edge?1:-1)*(leafWidth/2-.035):0),height/2+(edge>=2?(edge===2?-1:1)*(height/2-.035):0),.055);
          shutterFrame.scale.set(edge<2?.05:leafWidth,.05+(edge<2?height-.05:0),.045);shutterFrame.updateMatrix();
          shutterMatrix.multiplyMatrices(shutterAt.matrix,shutterFrame.matrix);shutterFrames.setMatrixAt(n*4+edge,shutterMatrix);
        }n++;
      }
    });shutters.instanceMatrix.needsUpdate=true;shutterFrames.instanceMatrix.needsUpdate=true;
  }updateShutters(0);

  // Water emerges from fixed nozzles into the moat, between the bridge lanes.
  // The growing city has a visible ongoing process even while a chapter is held.
  const jets=[],droplets=new T.InstancedMesh(new T.SphereGeometry(.065,8,6),blueLight,20),dropAt=new T.Object3D();droplets.frustumCulled=false;central.add(droplets);
  for(const degrees of [27,110,207,320]){
    const a=degrees*PI/180,radial=V(Math.cos(a),0,Math.sin(a));
    const sample=u=>radial.clone().multiplyScalar(mix(10.6,8.9,u)).setY(mix(.36,.07,u)+Math.sin(u*PI)*2.1);
    cylinder(w,central,.18,.38,brass,radial.clone().multiplyScalar(10.6).setY(.21),16);
    const stream=curve(w,central,Array.from({length:33},(_,i)=>sample(i/32)),.027,water,64);stream.name=`hq-garden-water-${degrees}`;stream.castShadow=stream.receiveShadow=false;
    jets.push({stream,sample});
  }

  // Garden walls and colonnades continue far past the foreground city.
  for(const side of [-1,1]){
    const x=side*42;w.box(3,12,112,stone,fixed,V(x,6,-40));
    for(let j=0;j<10;j++){
      const z=3-j*10;stoneColumn(w,fixed,V(x-side*2,0,z),14,.7);
      const arch=pointedArch(w,fixed,8.8,13,.8,pale,.5);arch.position.set(x-side*2,0,z-5);arch.rotation.y=PI/2;
    }
    for(const z of [0,-17,-37,-60,-77])tree(w,fixed,V(side*33,0,z),9,z);
  }
  w.box(86,14,3,stone,fixed,V(0,7,-88));
  for(const x of [-28,-14,0,14,28]){
    const distant=pointedArch(w,fixed,10,18,1.3,pale,.7);distant.position.set(x,0,-85.8);
    cylinder(w,fixed,3.1,25,stone,V(x,12.5,-90),12);
    w.mesh(new T.ConeGeometry(3.7,8,12),bronze,fixed,V(x,29,-90));
  }
  for(const pos of [[-10,0,-12],[11,0,-14],[-14,0,-34],[14,0,-38],[-7,0,-49],[8,0,-55]])tree(w,fixed,V(...pos),6.5,pos[0]);
  const moving=[...doors.map(x=>x.g),...portalDoors.map(x=>x.g),...bridges.map(x=>x.g),...crown.map(x=>x.g),...jets.map(x=>x.stream)];
  moving.forEach(g=>batch(g));batch(fixed,moving);
  const stages=['A world waiting behind one door','Find the places your work belongs','Connect the work between them','Enter your shared workspace'];
  const camera=operationCamera([
    {p:0,eye:[5,8,29],target:[0,10,8],fov:48},
    {p:.18,eye:[4,8,24],target:[0,8,-3],fov:48},
    {p:.34,eye:[3,8,2],target:[0,7,-25],fov:49},
    {p:.54,eye:[6,12,-4],target:[0,6,-28],fov:48},
    {p:.72,eye:[12,23,-4],target:[0,5,-33],fov:53},
    {p:1,eye:[20,35,-1],target:[0,4,-38],fov:56}
  ]);
  return{title:'The Living Atlas',stages,camera,environment:{outdoor:true,background:'#b6b5a1',fog:'#a4afa4',key:'#ffe3b3',keyIntensity:3,keyPosition:[-35,70,25],fill:'#b2cbd1',fillIntensity:.8},update(p,t){
    doors.forEach(({g,side})=>{g.rotation.y=-side*1.39*phase(p,.045,.3);});
    bridges.forEach(({g,index})=>{g.rotation.z=(1-phase(p,.29+index*.026,.48+index*.026))*1.35;});
    districts.forEach(({windows},i)=>{windows.emissiveIntensity=.08+.42*phase(p,.27+i*.033,.44+i*.033);});
    updateShutters(p);
    crown.forEach(({g,axis,index})=>g.quaternion.setFromAxisAngle(axis,-1.1*phase(p,.63+index*.018,.84+index*.018)));
    const pressure=phase(p,.46,.7);let drop=0;
    jets.forEach(({stream,sample},index)=>{
      stream.geometry.setDrawRange(0,Math.floor(pressure*64)*48);
      for(let i=0;i<5;i++){
        const u=((i/5+p*.6+t*.22+index*.13)%1)*pressure;
        dropAt.position.copy(sample(u));dropAt.scale.setScalar(pressure);dropAt.updateMatrix();droplets.setMatrixAt(drop++,dropAt.matrix);
      }
    });droplets.instanceMatrix.needsUpdate=true;
    portalDoors.forEach(({g,side})=>{g.rotation.y=-side*1.42*phase(p,.73,.95);});
    blueLight.emissiveIntensity=.3+.55*phase(p,.68,.92);
    const chapter=Math.min(3,Math.round(p*3));
    w.narrative={chapter,subject:'One garden city with seven distinct work districts',action:stages[chapter],connectedDistricts:bridges.filter(({index})=>p>=.48+index*.026).length,portalOpen:p>=.95,mode:'grounded-garden-city',mechanics:{doorAngle:1.42*phase(p,.73,.95),portalRearClearance:1.26,bridgeDeck:.465,roadDeck:.465,bridgeLandingGap:.05,crownOpen:phase(p,.63,.84),gardenPressure:pressure,signBottom:signHeight-6.8*.33/2,archTop:11.755}};
  }};
}

function gear(w,parent,radius,teeth,material,depth=.35){
  const g=w.group(parent);
  const module=2*radius/teeth,rootRadius=radius-module,tipRadius=radius+module*.8;
  const profile=new T.Shape(),pitch=PI*2/teeth;
  for(let i=0;i<teeth;i++)for(const [offset,r] of [[-.5,rootRadius],[-.3,rootRadius],[-.23,radius],[-.14,tipRadius],[.14,tipRadius],[.23,radius],[.3,rootRadius]]){
    const a=(i+offset)*pitch,x=Math.cos(a)*r,y=Math.sin(a)*r;
    if(i===0&&offset===-.5)profile.moveTo(x,y);else profile.lineTo(x,y);
  }profile.closePath();
  const hole=new T.Path();hole.absarc(0,0,radius*.69,0,PI*2,true);profile.holes.push(hole);
  w.mesh(new T.ExtrudeGeometry(profile,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1,curveSegments:32}),material,g,V(0,0,-depth/2));
  const hub=cylinder(w,g,radius*.2,depth*1.5,material,V(),24);hub.rotation.x=PI/2;
  for(let i=0;i<8;i++){const a=i/8*PI*2;w.beam(V(0,0,0),V(Math.cos(a)*radius*.74,Math.sin(a)*radius*.74,0),radius*.045,material,g);}
  batch(g);return g;
}

function rollerBank(w,parent,positions,y=0,width=3.1){
  const cylinders=new T.InstancedMesh(new T.CylinderGeometry(.18,.18,width,16),w.materials.bronze,positions.length);
  const stripes=new T.InstancedMesh(new T.BoxGeometry(.025,.008,width-.12),w.materials.brass,positions.length);
  const axles=new T.InstancedMesh(new T.CylinderGeometry(.05,.05,width+.3,8),w.materials.iron,positions.length);
  cylinders.castShadow=stripes.castShadow=true;cylinders.receiveShadow=stripes.receiveShadow=true;
  parent.add(cylinders,stripes,axles);
  const at=new T.Object3D(),stripeAt=new T.Object3D();
  positions.forEach((x,i)=>{at.position.set(x,y,0);at.rotation.set(PI/2,0,0);at.updateMatrix();axles.setMatrixAt(i,at.matrix);});
  return travel=>{
    // A top contact moving along +X requires clockwise rotation about +Z.
    const angle=-travel/.18;
    positions.forEach((x,i)=>{
      at.position.set(x,y,0);at.rotation.set(PI/2,angle,0);at.updateMatrix();cylinders.setMatrixAt(i,at.matrix);
      stripeAt.position.set(x-Math.sin(angle)*.176,y+Math.cos(angle)*.176,0);stripeAt.rotation.set(0,0,angle);stripeAt.updateMatrix();stripes.setMatrixAt(i,stripeAt.matrix);
    });cylinders.instanceMatrix.needsUpdate=true;stripes.instanceMatrix.needsUpdate=true;
  };
}

function rail(w,parent,a,b,width=3.4,withRollers=true,omitFooting=()=>false){
  const g=w.group(parent),length=a.distanceTo(b);g.position.copy(a);g.quaternion.setFromUnitVectors(V(1,0,0),b.clone().sub(a).normalize());
  for(const side of [-1,1]){
    w.box(length,.23,.18,w.materials.iron,g,V(length/2,0,side*width/2));
    w.box(length,.055,.23,w.materials.brass,g,V(length/2,.14,side*width/2));
  }
  for(let x=0;x<=length;x+=2.1){
    w.box(.18,.16,width+.3,w.materials.bronze,g,V(x,-.275,0));
    if(omitFooting(x))continue;
    for(const side of [-1,1]){
      w.box(.18,1.81,.2,w.materials.iron,g,V(x,-1.02,side*width/2));
      w.box(.55,.14,.55,w.materials.stone,g,V(x,-1.99,side*width/2));
    }
  }
  if(withRollers){const positions=[];for(let x=.22;x<length;x+=.65)positions.push(x);g.userData.roll=rollerBank(w,g,positions,0,width-.3);g.userData.roll(0);}
  return g;
}

function buildERP(w){
  const {stone,bronze,brass,iron,glass}=w.materials;
  const fixed=w.group();fixed.name='erp-grand-waterworks';
  const pale=stone.clone();pale.color.set('#827c68');
  const tile=new T.MeshStandardMaterial({color:'#324d49',roughness:.73});
  const water=new T.MeshPhysicalMaterial({color:'#3d9b8b',metalness:.35,roughness:.19,transparent:true,opacity:.88});
  const enamel=new T.MeshPhysicalMaterial({color:'#1b817e',metalness:.28,roughness:.22,clearcoat:1});
  const marker=new T.MeshStandardMaterial({color:'#88d9c2',emissive:'#43b49d',emissiveIntensity:.25,roughness:.5});
  w.box(150,2,150,stone,fixed,V(0,-1.3,-18));
  w.box(90,.18,90,tile,fixed,V(0,-.2,-12));
  for(let x=-40;x<=40;x+=5)w.box(.045,.025,90,bronze,fixed,V(x,-.09,-12));
  for(let z=-55;z<=30;z+=5)w.box(90,.025,.045,bronze,fixed,V(0,-.09,z));

  const hall=w.group(fixed);hall.position.set(0,0,-12);
  for(const side of [-1,1]){
    w.box(2.1,7,72,pale,hall,V(side*27,3.5,-5));
    for(let j=0;j<7;j++){
      const z=24-j*10;stoneColumn(w,hall,V(side*25,0,z),20,1.0);
      const arch=pointedArch(w,hall,9,17,1,stone,.7);arch.position.set(side*25,4,z-5);arch.rotation.y=PI/2;
      trellis(w,hall,side*24,1,z,2,6);
    }
  }
  // The roof is a single conservatory structure, carried by visible stone columns.
  barrelRoof(w,hall,52,72,20,glass);
  for(const z of [-35,-23,-11,1,13,25]){
    curve(w,hall,Array.from({length:25},(_,i)=>{const a=i/24*PI;return V(Math.cos(a)*26,20+Math.sin(a)*19.76,z);}),.21,bronze,48);
  }
  w.box(56,16,2.2,stone,hall,V(0,8,-42));
  for(const x of [-18,-6,6,18]){
    const rear=pointedArch(w,hall,9,20,1.1,pale,.7);rear.position.set(x,0,-40.6);
    archFill(w,hall,6.8,15,.1,glass).position.set(x,1.1,-40);
  }
  // An aqueduct provides the wheel's physical energy source.
  const aqueduct=w.group(fixed);aqueduct.position.set(-13,0,-8);
  w.box(35,1.2,3.6,pale,aqueduct,V(-8,13.3,0));
  for(const z of [-1.75,1.75])w.box(35,.75,.3,bronze,aqueduct,V(-8,14.3,z));
  w.box(35,.05,2.9,water,aqueduct,V(-8,14.32,0));
  for(const x of [-23,-15,-7,1,9]){
    const arch=pointedArch(w,aqueduct,7.5,13,.9,stone,.55);arch.position.set(x,0,0);
  }
  const chute=w.group(fixed);chute.position.set(-12.8,9.4,-4.3);chute.rotation.z=-.12;
  w.box(2.2,6.4,.16,water,chute,V());
  for(const x of [-1.2,1.2])w.box(.15,6.8,.32,bronze,chute,V(x,0,-.08));
  w.box(3.4,.38,48,stone,fixed,V(-13.1,.05,3));
  w.box(2.8,.05,48,water,fixed,V(-13.1,.27,3));
  for(const x of [-14.9,-11.3])w.box(.35,.7,48,pale,fixed,V(x,.3,3));
  const flow=new T.InstancedMesh(new T.BoxGeometry(2.7,.018,.13),marker,12),flowAt=new T.Object3D();flow.frustumCulled=false;fixed.add(flow);

  const wheel=w.group(fixed);wheel.position.set(-8.2,6.15,-4.2);wheel.name='water-driven-main-wheel';
  for(const z of [-.65,.65]){
    const ring=w.mesh(new T.TorusGeometry(5.6,.22,12,64),bronze,wheel,V(0,0,z));
    w.mesh(new T.TorusGeometry(4.65,.1,8,64),brass,wheel,V(0,0,z));
    for(let i=0;i<12;i++){const a=i/12*PI*2;w.beam(V(0,0,z),V(Math.cos(a)*5.6,Math.sin(a)*5.6,z),.12,bronze,wheel);}
  }
  for(let i=0;i<24;i++){
    const a=i/24*PI*2,paddle=w.box(1.15,.25,1.6,pale,wheel,V(Math.cos(a)*5.45,Math.sin(a)*5.45,0));paddle.rotation.z=a+PI/2;
  }
  const axle=cylinder(w,fixed,.3,6.75,brass,V(-8.2,6.15,-4.025),24);axle.rotation.x=PI/2;
  for(const z of [-7,-2.1]){
    stoneColumn(w,fixed,V(-8.2,0,z),5.55,.5);
    w.mesh(new T.TorusGeometry(.45,.15,12,32),bronze,fixed,V(-8.2,6.15,z));
  }
  const drive=gear(w,fixed,2.2,24,brass,.5);drive.position.set(-8.2,6.15,-.95);
  const second=gear(w,fixed,1.1,12,bronze,.4);second.position.set(-4.9,6.15,-.95);
  const transmission=cylinder(w,fixed,.14,4.6,brass,V(-4.9,6.15,1.3),16);transmission.rotation.x=PI/2;
  for(const z of [0,3.0]){
    w.beam(V(-4.9,0,z),V(-4.9,5.85,z),.17,iron,fixed);
    w.mesh(new T.TorusGeometry(.22,.08,8,24),bronze,fixed,V(-4.9,6.15,z));
  }
  // The belt and its supports sit outside the entire cargo swept volume.
  const pulleys=[];
  for(const y of [1.95,6.15]){
    const pulley=w.group(fixed);pulley.position.set(-4.9,y,3.6);
    w.mesh(new T.TorusGeometry(.42,.055,8,32),brass,pulley);
    for(let i=0;i<4;i++){const a=i*PI/2;w.beam(V(),V(Math.cos(a)*.42,Math.sin(a)*.42,0),.035,bronze,pulley);}
    pulleys.push(pulley);
  }
  const belt=[];
  for(let i=0;i<=12;i++){const a=i/12*PI;belt.push(V(-4.9+Math.cos(a)*.44,6.15+Math.sin(a)*.44,3.6));}
  for(let i=0;i<=12;i++){const a=PI+i/12*PI;belt.push(V(-4.9+Math.cos(a)*.44,1.95+Math.sin(a)*.44,3.6));}
  belt.push(belt[0].clone());curve(w,fixed,belt,.034,iron,64);
  const rollerAxle=cylinder(w,fixed,.09,3,brass,V(-4.9,1.95,4.5),16);rollerAxle.rotation.x=PI/2;
  const clutch=cylinder(w,fixed,.25,.26,brass,V(-4.9,1.95,3.86),20);clutch.rotation.x=PI/2;

  // The fixed approaches stay outside the rotating track's 3.68-unit envelope.
  const incoming=rail(w,fixed,V(-19,1.95,6),V(-3.9,1.95,6),3.4,true,x=>x>3.65&&x<8.05);
  rail(w,fixed,V(3.9,1.95,6),V(18,1.95,6));
  const destination=V(10,0,-8),theta=Math.atan2(14,10),direction=V(Math.cos(theta),0,-Math.sin(theta));
  const outgoing=rail(w,fixed,V(0,1.95,6).addScaledVector(direction,3.9),V(10,1.95,-8).addScaledVector(direction,2.5));
  cylinder(w,fixed,4.1,.55,stone,V(0,.3,6),48);
  cylinder(w,fixed,3.78,.3,bronze,V(0,1.5,6),64);
  const switchTrack=w.group(fixed);switchTrack.position.set(0,1.95,6);switchTrack.name='configured-route-turntable';
  cylinder(w,switchTrack,3.64,.1,iron,V(0,-.25,0),64);
  for(const x of [-2.7,-1.5,-.3,.9,2.1])w.box(.16,.09,3.6,bronze,switchTrack,V(x,-.155,0));
  for(const side of [-1,1]){
    w.box(6.5,.22,.18,iron,switchTrack,V(0,0,side*1.7));
    w.box(6.5,.05,.23,brass,switchTrack,V(0,.14,side*1.7));
  }
  const turnRoll=rollerBank(w,switchTrack,Array.from({length:11},(_,i)=>-3+i*.6));turnRoll(0);
  // The pallet is captured before the track turns and released only after the
  // new rail is aligned. Bearings and piston rods stay inside the swept disk.
  const turnClamps=[];
  for(const side of [-1,1]){
    for(const x of [-1,1])w.beam(V(x,-.2,side*2.7),V(x,.35,side*2.7),.075,iron,switchTrack);
    w.box(2.5,.18,.28,bronze,switchTrack,V(0,.35,side*2.7));
    const clamp=w.box(2.7,.2,.16,brass,switchTrack,V(0,.35,side*2.15));clamp.name=`erp-turntable-load-clamp-${side}`;
    const rods=[];
    for(const x of [-1,1]){
      const rod=cylinder(w,switchTrack,.065,1,iron,V(x,.35,side*2.425),12);rod.rotation.x=PI/2;rods.push(rod);
    }
    turnClamps.push({g:clamp,side,rods});
  }
  for(const a of [0,theta]){
    const line=w.box(3.2,.04,.08,marker,fixed,V(Math.cos(a)*2,1.68,6-Math.sin(a)*2));line.rotation.y=a;
  }
  const switchLever=w.group(fixed);switchLever.position.set(3.6,.3,8.8);
  w.beam(V(0,0,0),V(0,2.1,0),.14,bronze,switchLever);w.box(1.1,.18,.18,iron,switchLever,V(0,2.1,0));
  const routePlate=plaque(w,fixed,'FIT THE WORK','A ROUTE FOR FIELD / 07',3.8);routePlate.position.set(4.2,3.4,9.6);

  const gateRoot=w.group(fixed);gateRoot.position.set(-6,0,6);gateRoot.rotation.y=PI/2;
  pointedArch(w,gateRoot,5.2,8.3,.7,stone,.5);
  const gate=w.group(gateRoot);gate.position.z=-.75;gate.name='resource-release-gate';
  for(const x of [-1.8,-.9,0,.9,1.8])w.box(.1,4.8,.12,bronze,gate,V(x,4.55,0));
  for(const y of [2.2,4.5,6.9])w.box(4,.12,.16,brass,gate,V(0,y,0));
  const gateCounterweight=w.box(.9,1.8,.8,iron,gateRoot,V(3.15,6,-.75));
  for(const x of [-2.35,2.35])w.beam(V(x,0,-.75),V(x,12.65,-.75),.11,brass,gateRoot);
  w.beam(V(-2.35,12.65,-.75),V(3.65,12.65,-.75),.14,bronze,gateRoot);
  for(const x of [.9,3.15])w.mesh(new T.TorusGeometry(.22,.045,8,24),brass,gateRoot,V(x,12.25,-.75));
  w.beam(V(.9,12.47,-.75),V(3.15,12.47,-.75),.026,iron,gateRoot);
  const gateCable=cylinder(w,gateRoot,.026,1,iron,V(.68,9.5,-.75),8);
  const weightCable=cylinder(w,gateRoot,.026,1,iron,V(3.37,9.5,-.75),8);

  const cargo=w.group();cargo.name='field-07-resource';
  w.box(3.2,.26,2.8,iron,cargo,V());
  for(const x of [-1.1,1.1])w.box(.24,.52,1.7,bronze,cargo,V(x,.33,0));
  const body=cylinder(w,cargo,1.03,1.85,pale,V(0,1.35,0),48);body.rotation.x=PI/2;
  for(const z of [-.95,.95]){
    const ring=w.mesh(new T.TorusGeometry(1.01,.12,12,48),brass,cargo,V(0,1.35,z));
    for(let i=0;i<8;i++){const a=i/8*PI*2;const bolt=cylinder(w,cargo,.07,.1,iron,V(Math.cos(a)*1.01,1.35+Math.sin(a)*1.01,z+.05),6);bolt.rotation.x=PI/2;}
  }
  const face=cylinder(w,cargo,.86,.08,enamel,V(0,1.35,1.02),48);face.rotation.x=PI/2;
  const glassFace=cylinder(w,cargo,.59,.035,glass,V(0,1.35,1.08),48);glassFace.rotation.x=PI/2;
  const hub=cylinder(w,cargo,.16,.15,brass,V(0,1.35,1.09),24);hub.rotation.x=PI/2;
  for(let i=0;i<6;i++){const a=i/6*PI*2;w.beam(V(0,1.35,1.12),V(Math.cos(a)*.52,1.35+Math.sin(a)*.52,1.12),.025,brass,cargo);}
  curve(w,cargo,[V(1,1.35,0),V(1.8,1.35,0),V(1.95,1.7,0),V(1.95,2.5,0)],.2,bronze,24);
  cylinder(w,cargo,.29,.15,brass,V(1.95,2.5,0),24);
  const cargoLabel=plaque(w,cargo,'FIELD / 07','WATER FOR THE NEXT SEASON',2.1);cargoLabel.position.set(0,.4,1.48);

  const receiver=w.group(fixed);receiver.position.copy(destination);receiver.rotation.y=theta;receiver.name='resource-workshop-cradle';
  w.box(6.5,.6,6,pale,receiver,V(0,.3,0));
  for(const x of [-2,2])for(const z of [-1.8,1.8])w.box(.35,1.6,.35,iron,receiver,V(x,1.3,z));
  w.box(5.5,.25,3.5,bronze,receiver,V(0,1.48,0));
  for(const side of [-1,1])w.box(5.5,.2,.22,iron,receiver,V(0,1.73,side*1.7));
  const clamps=[];
  for(const side of [-1,1]){
    const clamp=w.box(2.7,.34,.16,brass,receiver,V(0,2.3,side*1.9));clamps.push({g:clamp,side});
  }
  const ready=cylinder(w,receiver,.23,.1,marker,V(-2.5,2.2,2.25),24);
  const destinationLabel=plaque(w,receiver,'THE NEXT OPERATION','RECEIVED / FIELD 07',4.3);destinationLabel.position.set(0,5,-2.7);
  for(const x of [-2.7,2.7])w.beam(V(x,.1,-2.9),V(x,7,-2.9),.16,bronze,receiver);
  w.beam(V(-2.7,7,-2.9),V(2.7,7,-2.9),.16,bronze,receiver);
  // Pipes leave the receiving workshop and serve the surrounding growing beds.
  for(const side of [-1,1]){
    curve(w,fixed,[V(10,1,-8),V(16,1,-8),V(18,1,-8+side*5),V(18,2,-8+side*11)],.18,bronze,40);
    w.box(6,.8,8,stone,fixed,V(20,.4,-8+side*13));
    for(const x of [18.5,21.5])for(const z of [-2,2])tree(w,fixed,V(x,.8,-8+side*13+z),4,side+x);
  }
  const turnMoving=turnClamps.flatMap(c=>[c.g,...c.rods]);
  const animated=[wheel,drive,second,...pulleys,clutch,switchTrack,switchLever,gate,gateCounterweight,gateCable,weightCable,ready,...clamps.map(c=>c.g)];
  batch(cargo);[wheel,...pulleys,switchLever,gate].forEach(g=>batch(g));batch(switchTrack,turnMoving);batch(fixed,animated);
  const stages=['One resource with a purpose','Release it when the work is ready','Shape the route to fit','Arrive ready for the next operation'];
  const camera=operationCamera([
    {p:0,eye:[-10,6,18],target:[-15,3.6,5.8],fov:47},
    {p:.23,eye:[-1,7.2,22],target:[-10.1,3.6,6],fov:47},
    {p:.42,eye:[7,7.7,23],target:[-6.9,3.6,6],fov:48},
    {p:.62,eye:[12,10,21],target:[0,3.6,5],fov:48},
    {p:.79,eye:[19,10,13],target:[6,3.5,-2],fov:49},
    {p:1,eye:[22,15,16],target:[6,4,-5],fov:51}
  ]);
  return{title:'The Grand Waterworks',stages,camera,environment:{outdoor:false,background:'#273f3b',fog:'#53665b',key:'#ffe3ac',keyIntensity:3.2,keyPosition:[-25,55,28],fill:'#b3d8cd',fillIntensity:.75},update(p,t){
    const arrive=phase(p,0,.2),release=phase(p,.2,.32),approach=phase(p,.32,.57),turn=phase(p,.61,.74),delivery=phase(p,.76,.95);
    const incomingTravel=5.9*arrive+10.1*approach,outgoingTravel=Math.hypot(10,14)*delivery;
    cargo.position.set(-16+incomingTravel+10*delivery,2.26,6-14*delivery);
    cargo.rotation.y=theta*turn;
    switchTrack.rotation.y=theta*turn;switchLever.rotation.z=-.42*turn;
    const captured=phase(p,.57,.61)*(1-phase(p,.74,.76));
    turnClamps.forEach(({g,side,rods})=>{
      const z=mix(2.15,1.52,captured);g.position.z=side*z;
      rods.forEach(rod=>{rod.position.z=side*(2.7+z)/2;rod.scale.y=2.7-z;});
    });
    // The aqueduct continues supplying power while the feed clutch is open;
    // only conveyor displacement advances the resource itself.
    const motion=(incomingTravel+outgoingTravel*.45)/.36+release*1.2+turn*.9+phase(p,.95,1)*.3+t*.16;
    wheel.rotation.z=motion;drive.rotation.z=motion;second.rotation.z=-motion*2+PI/12;
    incoming.userData.roll(incomingTravel);outgoing.userData.roll(outgoingTravel);turnRoll(incomingTravel+outgoingTravel);
    pulleys.forEach(pulley=>{pulley.rotation.z=-motion*2;});
    const feedCoupled=1-phase(p,.18,.2)+phase(p,.32,.34)-phase(p,.55,.57);clutch.position.z=3.86+.3*(1-feedCoupled);
    const lift=4.4*release;gate.position.y=lift;gateCounterweight.position.y=6-lift;
    const cableBottom=6.95+lift,weightTop=6.9-lift;
    gateCable.position.y=(12.25+cableBottom)/2;gateCable.scale.y=12.25-cableBottom;
    weightCable.position.y=(12.25+weightTop)/2;weightCable.scale.y=12.25-weightTop;
    clamps.forEach(({g,side})=>{g.position.z=side*mix(1.9,1.5,phase(p,.955,1));});
    ready.scale.setScalar(.7+.3*phase(p,.95,1));marker.emissiveIntensity=.22+.22*phase(p,.9,1);
    for(let i=0;i<12;i++){flowAt.position.set(-13.1,.31,-19+((i*4+p*17+t*.55)%48));flowAt.updateMatrix();flow.setMatrixAt(i,flowAt.matrix);}flow.instanceMatrix.needsUpdate=true;
    const chapter=Math.min(3,Math.round(p*3));
    w.narrative={chapter,subject:'Field 07 regulator stays on one supported production route',action:stages[chapter],routeConfigured:turn>=.999,delivered:delivery>=.999,mode:'grounded-waterworks',mechanics:{incomingTravel,outgoingTravel,turn,captured,gateLift:lift,palletBottom:2.13,rollerTop:2.13,rotatingEnvelope:Math.hypot(3.25,1.815),fixedTrackStart:3.9,loadPosition:cargo.position.toArray()}};
  }};
}

export const experienceOperations={constellation:buildHQ,modules:buildERP};
