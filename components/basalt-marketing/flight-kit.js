/* Shared craftsmanship for the aerial stories. Geometry stays in world space;
 * scroll owns the action and time supplies only wind and breathing light. */
import {THREE as T} from './three-runtime.js';
export {T};
export const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const ease=n=>{const t=T.MathUtils.clamp(n,0,1);return t*t*t*(t*(t*6-15)+10);};
export const phase=(p,a,b)=>ease((p-a)/(b-a));
export function flightPath(shots){
 const eye=new T.CatmullRomCurve3(shots.map(s=>V(...s.eye)),false,'centripetal');
 const target=new T.CatmullRomCurve3(shots.map(s=>V(...s.target)),false,'centripetal');
 return p=>{p=T.MathUtils.clamp(p,0,1);let i=0;while(i<shots.length-2&&p>shots[i+1].p)i++;
  const a=shots[i],b=shots[i+1],u=ease((p-a.p)/(b.p-a.p)),q=(i+u)/(shots.length-1);
  return {eye:eye.getPoint(q),target:target.getPoint(q),fov:T.MathUtils.lerp(a.fov||45,b.fov||45,u),roll:T.MathUtils.lerp(a.roll||0,b.roll||0,u)};
 };
}
const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function surface(type){
 const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),rng=random(type==='paper'?824:517),data=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,noise=rng()-.5;
  const wave=Math.sin(x*.021+Math.sin(y*.034)*3)*Math.cos(y*.012)*.5+Math.sin(x*.12+y*.037)*.12;
  const value=type==='paper'?235+noise*13+wave*6:155+noise*48+wave*28;
  data.data[i]=value;data.data[i+1]=value-(type==='paper'?5:0);data.data[i+2]=value-(type==='paper'?17:0);data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);
 if(type==='stone'){
  ctx.strokeStyle='#292c2b35';ctx.lineWidth=1;
  for(let j=0;j<52;j++){ctx.beginPath();let x=rng()*size,y=rng()*size;ctx.moveTo(x,y);for(let k=0;k<7;k++){x+=rng()*34-17;y+=rng()*40;ctx.lineTo(x,y);}ctx.stroke();}
 }else{
  ctx.strokeStyle='#8b765014';ctx.lineWidth=.5;
  for(let j=0;j<700;j++){const x=rng()*size,y=rng()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rng()*12,y+rng()*3);ctx.stroke();}
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=8;return texture;
}

export function createFlightKit(root,accent){
 const paperMap=surface('paper'),stoneMap=surface('stone');stoneMap.repeat.set(2,3);
 const materials={
  brass:new T.MeshStandardMaterial({color:'#c3a065',metalness:.76,roughness:.31}),
  bronze:new T.MeshStandardMaterial({color:'#6f5435',metalness:.72,roughness:.43}),
  iron:new T.MeshStandardMaterial({color:'#263639',metalness:.66,roughness:.46}),
  paper:new T.MeshPhysicalMaterial({color:'#fff1d2',map:paperMap,bumpMap:paperMap,bumpScale:.012,roughness:.78,side:T.DoubleSide,sheen:.3,sheenColor:new T.Color('#fff0c9')}),
  stone:new T.MeshStandardMaterial({color:'#62635b',map:stoneMap,bumpMap:stoneMap,bumpScale:.18,roughness:.87}),
  glass:new T.MeshPhysicalMaterial({color:'#b0d5ce',metalness:.13,roughness:.2,transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false}),
  green:new T.MeshStandardMaterial({color:'#4f7151',roughness:.8,side:T.DoubleSide}),
  glow:new T.MeshStandardMaterial({color:'#ffe7b3',emissive:'#ffb858',emissiveIntensity:1.8,roughness:.5}),
  cloth:new T.MeshPhysicalMaterial({color:accent.clone().lerp(new T.Color('#8d9780'),.36),map:paperMap,roughness:.79,side:T.DoubleSide,sheen:.8,sheenRoughness:.8}),
 };
 const group=(parent=root)=>{const g=new T.Group();parent.add(g);return g;};
 const mesh=(geometry,material,parent=root,position=V())=>{const m=new T.Mesh(geometry,material);m.position.copy(position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(a,b,c,material=materials.brass,parent=root,position=V())=>mesh(new T.BoxGeometry(a,b,c),material,parent,position);
 const beam=(a,b,r=.04,material=materials.brass,parent=root)=>{
  const length=a.distanceTo(b);if(length<.00001)return group(parent);
  const m=mesh(new T.CylinderGeometry(r,r,length,10),material,parent,a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());return m;
 };
 const tube=(points,r=.04,material=materials.brass,parent=root)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(12,points.length*5),r,8,false),material,parent);
 const leaf=({parent=root,width=2,height=2.8,text='',subtitle='',accent:leafAccent}={})=>{
  const g=group(parent),canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768*height/width);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e9dfc7';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalAlpha=.25;ctx.drawImage(paperMap.image,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;
  ctx.strokeStyle='#ae9062';ctx.lineWidth=2;ctx.strokeRect(24,24,720,canvas.height-48);
  const wide=height/width<.65,h=canvas.height;
  ctx.fillStyle=leafAccent||'#315a55';ctx.font=`${wide?Math.max(13,h*.065):22}px Georgia`;ctx.textAlign='center';ctx.fillText('B A S A L T',384,wide?h*.2:82);
  ctx.strokeStyle='#ae906299';ctx.beginPath();ctx.moveTo(170,wide?h*.28:114);ctx.lineTo(598,wide?h*.28:114);ctx.stroke();
  ctx.fillStyle='#3c4138';ctx.font=`${wide?Math.min(36,h*.14):36}px Georgia`;
  const lines=String(text).split('\n');lines.forEach((line,i)=>ctx.fillText(line,384,h*(wide?.53:.39)+i*(wide?h*.16:48),650));
  ctx.fillStyle='#77715e';ctx.font=`${wide?Math.max(12,h*.072):21}px Arial`;String(subtitle).split('\n').forEach((line,i)=>ctx.fillText(line,384,h*(wide?.8:.68)+i*(wide?h*.11:31),640));
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  box(width,height,.026,materials.paper,g);
  mesh(new T.PlaneGeometry(width*.987,height*.987),new T.MeshStandardMaterial({map,roughness:.85,side:T.DoubleSide}),g,V(0,0,.015));
  return g;
 };
 const wing=({parent=root,span=8,chord=3,layer=0}={})=>{
  const craft=group(parent),half=span*.5,panels=[];
  for(const sign of [-1,1]){
   const side=group(craft);panels.push(side);const positions=[],uvs=[],indices=[],nx=24,nz=12;
   const point=(u,v)=>V(sign*(.13+u*half),.19*Math.sin(u*Math.PI)+.055*Math.sin(v*Math.PI)+layer*.035,-chord*.48+chord*.68*u*u+v*(chord*(1-.49*u)));
   for(let x=0;x<=nx;x++)for(let z=0;z<=nz;z++){const p=point(x/nx,z/nz);positions.push(...p.toArray());uvs.push(x/nx,z/nz);}
   for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){const a=x*(nz+1)+z,b=a+nz+1;indices.push(a,b,a+1,b,b+1,a+1);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,materials.paper,side);
   for(let i=0;i<=7;i++){const u=i/7;const points=Array.from({length:7},(_,j)=>{const p=point(u,j/6);p.y+=.025;return p;});tube(points,.018+(1-u)*.014,materials.brass,side);}
   for(const edge of [0,1])tube(Array.from({length:13},(_,i)=>point(i/12,edge).add(V(0,.024,0))),.032,materials.bronze,side);
   for(let i=1;i<5;i++)beam(point(i/5,0).add(V(0,.04,0)),point((i-1)/5,1).add(V(0,.04,0)),.009,materials.bronze,side);
  }
  beam(V(0,.07,-chord*.62),V(0,.07,chord*.75),.065,materials.brass,craft);
  const seal=mesh(new T.CylinderGeometry(.3,.34,.11,48),new T.MeshPhysicalMaterial({color:accent,metalness:.44,roughness:.24,clearcoat:1}),craft,V(0,.14,-chord*.16));
  const rim=mesh(new T.TorusGeometry(.3,.025,8,48),materials.brass,seal,V(0,.061,0));rim.rotation.x=Math.PI/2;
  // Restrained engraved mountain motif, modelled above the enamel surface.
  for(const x of [-.1,.1])beam(V(x-.08,.064,.07),V(x,.064,-.12),.012,materials.brass,seal);
  craft.userData.left=panels[0];craft.userData.right=panels[1];craft.userData.seal=seal;return craft;
 };
 return {root,accent,materials,group,mesh,box,beam,tube,leaf,wing,narrative:{}};
}

// Collapse only explicitly static architecture. Animated subjects keep their hierarchy.
export function batchArchitecture(root){
 root.updateMatrixWorld(true);const buckets=new Map(),inverse=root.matrixWorld.clone().invert();
 root.traverse(object=>{if(!object.isMesh||Array.isArray(object.material))return;const list=buckets.get(object.material)||[];list.push(object);buckets.set(object.material,list);});
 for(const [material,objects] of buckets){
  if(objects.length<2)continue;const arrays=[],normals=[],uvs=[];
  for(const object of objects){const geo=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone());geo.applyMatrix4(inverse.clone().multiply(object.matrixWorld));const n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');arrays.push(geo.getAttribute('position').array);normals.push(n?.array||new Float32Array(geo.getAttribute('position').count*3));uvs.push(uv?.array||new Float32Array(geo.getAttribute('position').count*2));geo.dispose();}
  const join=list=>{const out=new Float32Array(list.reduce((sum,a)=>sum+a.length,0));let i=0;for(const a of list){out.set(a,i);i+=a.length;}return out;};
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(join(arrays),3));geo.setAttribute('normal',new T.BufferAttribute(join(normals),3));geo.setAttribute('uv',new T.BufferAttribute(join(uvs),2));geo.computeBoundingSphere();
  for(const object of objects){object.removeFromParent();object.geometry.dispose();}
  const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);
 }
}

export function makeArchive(w,kind){
 const {materials:m}=w,g=w.group(),rng=random(3701),darkStone=m.stone.clone();darkStone.color.set('#353f3d');
 const paleStone=m.stone.clone();paleStone.color.set('#676658');
 const bronze=m.bronze,glass=m.glass,windowMat=m.glow.clone();windowMat.color.set('#735d35');windowMat.emissive.set('#9c662a');windowMat.emissiveIntensity=.22;
 const foliage=m.green,ink=new T.MeshStandardMaterial({color:'#172b2b',roughness:.87});
 const slab=(a,b,c,mat,x,y,z)=>w.box(a,b,c,mat,g,V(x,y,z));
 // A contiguous geological body, broken into long irregular columnar faces.
 for(let i=0;i<69;i++){
  const x=(i-34)*5.2,h=130+rng()*70,z=-47-Math.sin(i*.27)*10;
  const rock=new T.CylinderGeometry(3.8+rng(),4.9,h,12,20),positions=rock.getAttribute('position');
  for(let j=0;j<positions.count;j++){
   const px=positions.getX(j),py=positions.getY(j),pz=positions.getZ(j),ridge=1+.1*Math.sin(py*.15+i*2)+.055*Math.sin(py*.63+px*.72);
   positions.setXYZ(j,px*ridge+.3*Math.sin(py*.09+i),py,pz*ridge+.35*Math.cos(py*.13+i));
  }rock.computeVertexNormals();
  const mesh=w.mesh(rock,i%3?darkStone:m.stone,g,V(x,-52+h*.03,z));
  mesh.rotation.y=rng()*.28;
 }
 const shape=new T.Shape();shape.moveTo(-2.35,0);shape.lineTo(-2.35,5.7);shape.bezierCurveTo(-2.35,7.9,-.7,8.8,0,9.55);shape.bezierCurveTo(.7,8.8,2.35,7.9,2.35,5.7);shape.lineTo(2.35,0);shape.closePath();
 const hole=new T.Path();hole.moveTo(-1.92,.3);hole.lineTo(1.92,.3);hole.lineTo(1.92,5.7);hole.bezierCurveTo(1.92,7.7,.55,8.4,0,8.95);hole.bezierCurveTo(-.55,8.4,-1.92,7.7,-1.92,5.7);hole.closePath();shape.holes.push(hole);
 const arch=new T.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelSize:.08,bevelThickness:.07,bevelSegments:2,curveSegments:16});
 const rows={network:5,crystal:4,constellation:4,modules:3,pages:3,wave:3,shield:4}[kind],cols={network:13,crystal:11,constellation:13,modules:11,pages:9,wave:9,shield:9}[kind];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  if((col*3+row)%7===0)continue;
  const x=(col-(cols-1)/2)*9.2,y=-36+row*15.5,z=-29.5-Math.sin(col*.2)*4;
  slab(8.9,13,2.4,darkStone,x,y+5,z-2);
  slab(7.5,.48,3.7,paleStone,x,y-.1,z-.1);
  w.mesh(arch.clone(),paleStone,g,V(x,y,z));
  slab(3.8,6,.1,ink,x,y+3.3,z+.04);
  slab(2.9,5,.09,windowMat,x,y+3.7,z+.13);
  for(const dx of [-1.3,0,1.3])slab(.065,5.5,.1,bronze,x+dx,y+3.7,z+.26);
  for(const dy of [1.3,3,4.6,6.2])slab(3.15,.055,.13,bronze,x,y+dy,z+.28);
  // Individual library shelves remain visible through the bronze mullions.
  for(let s=0;s<5;s++)slab(3.1,.075,.3,bronze,x,y+.9+s*.93,z+.35);
  for(let s=0;s<4;s++)slab(.48,1.5,.7,paleStone,x+(s<2?-3.35:3.35),y+1.8+(s%2)*5.2,z+.3);
  if((row+col)%4===0){
   const banner=slab(1.05,4.5,.06,m.cloth,x+3.35,y+7.8,z+.7);banner.rotation.z=.035;
   w.beam(V(x+2.6,y+10.2,z+.7),V(x+4.1,y+10.2,z+.7),.05,bronze,g);
  }
  if(col%4===0){
   slab(.65,12.2,1.3,paleStone,x-4.1,y+5.5,z+.4);
   for(let j=0;j<5;j++)slab(.8,.14,1.45,paleStone,x-4.1,y+.7+j*2.4,z+.5);
   const rose=w.mesh(new T.TorusGeometry(.65,.08,8,24),bronze,g,V(x,y+11,z+.3));
   for(let a=0;a<6;a++)w.beam(V(x,y+11,z+.3),V(x+Math.sin(a*Math.PI/3)*.61,y+11+Math.cos(a*Math.PI/3)*.61,z+.3),.022,bronze,g);
  }
 }
 arch.dispose();
 // Long terraces tie the repeated bays to one inhabited cliff, not floating islands.
 for(let row=0;row<rows;row++){
  const y=-36+row*15.5;slab(164,.65,5.2,paleStone,0,y-.8,-28.6);
  slab(164,.18,.18,bronze,0,y+1.3,-25.9);
  for(let j=0;j<48;j++)slab(.075,1.5,.075,bronze,(j-23.5)*3.4,y+.5,-25.9);
 }
 // A distant aqueduct provides scale and separates the far silhouettes.
 for(let side=0;side<2;side++){
  const z=-78-side*65,y=-5+side*45;
  slab(400,1.4,5,paleStone,0,y,z);
  for(let j=0;j<17;j++){
   const x=(j-8)*24;slab(2.3,100,3.5,darkStone,x,y-50,z);
   const points=Array.from({length:18},(_,i)=>{const a=i/17*Math.PI;return V(x+12+10.8*Math.cos(a),y-12+11*Math.sin(a),z+2);});
   w.tube(points,.7,paleStone,g);
  }
 }
 // Distant silhouettes are deliberately sparse and tall.
 for(let i=0;i<24;i++){
  const x=(i-11.5)*17,z=-125-rng()*70,h=45+rng()*100;
  const tower=w.mesh(new T.CylinderGeometry(2+rng()*3,5,h,7),darkStone,g,V(x,-40+h/2,z));
  w.mesh(new T.ConeGeometry(4,12,7),bronze,g,V(x,-40+h+6,z));
  tower.rotation.y=.2;
 }
 // Climbing leaf clusters use an instanced curved leaf instead of many draw calls.
 const leafGeo=new T.SphereGeometry(.45,8,5);leafGeo.scale(.48,1,.13);
 const leaves=new T.InstancedMesh(leafGeo,foliage,cols*48),dummy=new T.Object3D();
 for(let strand=0;strand<cols;strand++){
  const x=(strand-(cols-1)/2)*9.2+3.15,z=-29.5-Math.sin(strand*.2)*4+.78,top=42-(strand%3)*15.5;
  const stem=[];for(let j=0;j<25;j++)stem.push(V(x+Math.sin(j*.29+strand)*.28,top-j*.75,z));w.tube(stem,.022,foliage,g);
  for(let j=0;j<48;j++){
   const side=j%2?1:-1,y=top-j*.37,sx=x+Math.sin(j*.145+strand)*.28;
   dummy.position.set(sx+side*.18,y,z+.08);dummy.rotation.set(.15,side*.24,side*.65);dummy.scale.setScalar(.6+rng()*.45);dummy.updateMatrix();leaves.setMatrixAt(strand*48+j,dummy.matrix);
  }
 }
 leaves.castShadow=true;g.add(leaves);
 // Do not flatten InstancedMesh data into a single leaf.
 leaves.removeFromParent();batchArchitecture(g);g.add(leaves);g.name='basalt-cliff-archive';return g;
}
