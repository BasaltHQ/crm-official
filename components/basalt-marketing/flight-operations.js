import { T, V, flightPath, batchArchitecture } from './flight-kit.js';

const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { const x = clamp(n); return x * x * (3 - 2 * x); };
const part = (p, a, b) => smooth((p - a) / (b - a));

function batchStatic(root) {
  // Instancing is already efficient and must retain every instance transform.
  const instances=[];
  root.traverse(node=>{if(node.isInstancedMesh)instances.push({node,parent:node.parent});});
  instances.forEach(({node})=>node.removeFromParent());
  batchArchitecture(root);
  instances.forEach(({node,parent})=>parent.add(node));
}

function batchBody(root, articulated) {
  const detached=articulated.map(node=>({node,parent:node.parent}));
  detached.forEach(({node})=>node.removeFromParent());
  batchStatic(root);
  detached.forEach(({node,parent})=>parent.add(node));
}

function collectArchitecture(w, before, articulated) {
  const fixed=w.group();fixed.name='batched-flight-architecture';
  const keep=new Set(articulated);
  [...w.root.children].forEach(node=>{
    if(node!==fixed&&!before.has(node)&&!keep.has(node))fixed.add(node);
  });
  return fixed;
}

function track(frames, p) {
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1][0]) i++;
  const a = frames[i], b = frames[i + 1];
  return V(...a[1]).lerp(V(...b[1]), part(p, a[0], b[0]));
}

// Curved, tensioned cloth has a visibly engineered silhouette, even in a still.
function membrane(w, parent, sample, material, nu = 24, nv = 12) {
  const positions = [], uv = [], indices = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const point = sample(i / nu, j / nv);
    positions.push(point.x, point.y, point.z); uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return w.mesh(geometry, material, parent);
}

function curve(w, parent, sample, radius, material, steps = 32) {
  return w.tube(Array.from({ length: steps + 1 }, (_, i) => sample(i / steps)), radius, material, parent);
}

function arch(w, parent, width, height, depth, material, thickness = .8) {
  const s = new T.Shape();
  s.moveTo(-width / 2, 0); s.lineTo(-width / 2, height * .6);
  s.bezierCurveTo(-width / 2, height * .8, -width * .18, height * .94, 0, height);
  s.bezierCurveTo(width * .18, height * .94, width / 2, height * .8, width / 2, height * .6);
  s.lineTo(width / 2, 0); s.lineTo(width / 2 - thickness, 0);
  s.lineTo(width / 2 - thickness, height * .6);
  s.bezierCurveTo(width / 2 - thickness, height * .78, width * .17, height * .9, 0, height - thickness);
  s.bezierCurveTo(-width * .17, height * .9, -width / 2 + thickness, height * .78, -width / 2 + thickness, height * .6);
  s.lineTo(-width / 2 + thickness, 0); s.closePath();
  const geometry = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .06, bevelThickness: .06, curveSegments: 20 });
  return w.mesh(geometry, material, parent, V(0, 0, -depth / 2));
}

function deck(w, parent, width, depth, y = 0) {
  const { bronze, brass, stone } = w.materials;
  w.box(width, .65, depth, stone, parent, V(0, y - .4, 0));
  w.box(width + .15, .1, depth + .15, bronze, parent, V(0, y, 0));
  for (const side of [-1, 1]) {
    w.beam(V(side * width / 2, y + .15, -depth / 2), V(side * width / 2, y + .15, depth / 2), .055, brass, parent);
    w.beam(V(side * width / 2, y + 1.15, -depth / 2), V(side * width / 2, y + 1.15, depth / 2), .045, brass, parent);
    for (let z = -depth / 2; z <= depth / 2 + .1; z += depth / 6) {
      w.beam(V(side * width / 2, y, z), V(side * width / 2, y + 1.15, z), .035, bronze, parent);
    }
  }
}

function garden(w, parent, position, width = 3, seed = 0) {
  const g = w.group(parent); g.position.copy(position);
  w.box(width, .55, 1, w.materials.bronze, g, V(0, .25, 0));
  const leaves = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), w.materials.green, 20);
  const obj = new T.Object3D();
  for (let i = 0; i < 20; i++) {
    const u = (Math.sin(i * 9.41 + seed) + 1) / 2;
    const z = Math.cos(i * 5.72 + seed) * .28;
    obj.position.set((u - .5) * width * .9, .65 + .8 * Math.abs(Math.cos(i * 4.7)), z);
    obj.rotation.set(.3, i * 1.1, .4 * Math.sin(i));
    obj.scale.set(.28, .65 + u * .25, .19); obj.updateMatrix(); leaves.setMatrixAt(i, obj.matrix);
  }
  g.add(leaves);
  return g;
}

function plaque(w, parent, text, subtitle, width = 3) {
  const g = w.leaf({ parent, width, height: width * .35, text, subtitle });
  return g;
}

function harborCraft(w) {
  const { bronze, brass, paper, iron, glow } = w.materials;
  const g = w.group(); g.name = 'hq-correspondence-courier';
  const contour = [[0,-2.7],[.26,-2.3],[.7,-1.6],[.9,-.4],[.75,1.2],[.35,2.2],[0,2.6]].map(([r,y])=>new T.Vector2(r,y));
  const hull = w.mesh(new T.LatheGeometry(contour, 32), bronze, g); hull.rotation.x = Math.PI / 2; hull.scale.y = .7;
  w.box(.75, .18, 2.5, iron, g, V(0, .15, 0));
  for (const x of [-.5,.5]) w.beam(V(x, .3, 1.4), V(x*.6, 2.4, -.3), .045, brass, g);
  w.beam(V(0,.2,-1.8),V(0,2.6,-.3),.055,brass,g);
  const sails = [];
  for (const side of [-1,1]) {
    const sail = w.group(g); sails.push(sail); sail.position.y = 1.9;
    const shape = (u,v) => V(side * (.2 + 4.2*u), Math.sin(u*Math.PI)*1.1 + Math.sin(v*Math.PI)*.22, (v-.48)*(3.6-1.9*u)-u*.9);
    membrane(w, sail, shape, paper);
    for (const u of [0,.23,.49,.75,1]) curve(w, sail, v=>shape(u,v), .025, brass,16);
    for (const v of [0,1]) curve(w,sail,u=>shape(u,v),.035,bronze);
    curve(w,sail,u=>shape(u,.5),.028,brass);
    w.beam(V(0,-1.6,.3),shape(.72,.5),.018,iron,sail);
  }
  const tail = w.group(g); tail.position.set(0,.8,2.1);
  membrane(w,tail,(u,v)=>V((u-.5)*2.5,Math.sin(u*Math.PI)*.2,(v-.5)*1.2),paper,12,5);
  w.beam(V(-1.25,0,0),V(1.25,0,0),.03,brass,tail);
  const enamel=new T.MeshPhysicalMaterial({color:w.accent,metalness:.5,roughness:.24,clearcoat:1});
  const seal = w.mesh(new T.CylinderGeometry(.23,.23,.1,32), enamel, g,V(0,.32,0));
  const parcel = plaque(w,g,'ONE WORKSPACE','THE NEXT STEP',1.2);parcel.rotation.x=-Math.PI/2;parcel.position.set(0,.3,.5);
  return {g,sails,seal};
}

function harborDistrict(w, position, title, accent = false) {
  const g=w.group();g.position.copy(position);
  deck(w,g,8,7);
  const a=arch(w,g,7.4,10,1,w.materials.stone,.68);a.position.z=-2.8;
  const inset=arch(w,g,6.5,9.3,.25,w.materials.bronze,.12);inset.position.set(0,.1,-2.15);
  for(const x of [-3,3]){
    w.box(1.3,18,1.5,w.materials.stone,g,V(x,-9,-2));
    w.beam(V(x,-5,-2),V(x,0,3),.15,w.materials.bronze,g);
    w.beam(V(x,-5,-2),V(x,-13,-28-position.z),.72,w.materials.stone,g);
    garden(w,g,V(x,.1,-1.5),1.4,x);
  }
  const banner=plaque(w,g,title,'BASALT HARBOUR',3.1);banner.position.set(0,7,-1.95);
  for(const x of [-2,2])w.mesh(new T.SphereGeometry(.17,12,8),accent?w.materials.glow:w.materials.paper,g,V(x,3,-2));
  return g;
}

function buildHQ(w) {
  const before=new Set(w.root.children);
  const { stone, bronze, brass, glass, iron, paper, glow }=w.materials;
  const stageNames=['A place to begin','Routes become relationships','A connected working world','Your next horizon'];
  const craft=harborCraft(w);
  harborDistrict(w,V(-10,0,7),'THE WORKSHOP',true);
  harborDistrict(w,V(11,10,-6),'THE EXCHANGE');
  harborDistrict(w,V(-12,19,-15),'THE ARCHIVE');

  // Bridges land on real platforms, with suspension cables meeting their towers.
  const bridges=[];
  for(const data of [
    {from:[-6,.15,7],to:[7,10.15,-6]},
    {from:[7,10.15,-7],to:[-8,19.15,-15]},
    {from:[-8,19.15,-16],to:[-7,17.15,-22]}
  ]){
    const b=w.group();b.position.set(...data.from);
    const span=V(...data.to).sub(V(...data.from)),length=span.length();
    const structure=w.group(b);structure.quaternion.setFromUnitVectors(V(1,0,0),span.normalize());
    w.box(length,.15,1.05,bronze,structure,V(length/2,0,0));
    for(const side of [-1,1]){
      const z=side*.55;
      curve(w,structure,u=>V(u*length,1.8-1.2*Math.sin(u*Math.PI),z),.038,brass);
      for(let i=0;i<=10;i++){const x=i/10*length;w.beam(V(x,0,z),V(x,1.8-1.2*Math.sin(i/10*Math.PI),z),.017,bronze,structure);}
      for(const x of [0,length])w.beam(V(x,0,z),V(x,2,z),.07,bronze,structure);
    }
    bridges.push({g:b,angle:0});
  }

  // Solar canopies make the harbour a living place rather than a collection of islands.
  for(const [x,y,z,scale] of [[-10,9,6,1],[11,19,-6,.9],[-12,28,-15,.85]]){
    const canopy=w.group();canopy.position.set(x,y,z);canopy.scale.setScalar(scale);
    const roof=(u,v)=>V((u-.5)*10,2*Math.sin(u*Math.PI),(v-.5)*9);
    membrane(w,canopy,roof,glass);
    for(const v of [0,.25,.5,.75,1])curve(w,canopy,u=>roof(u,v),.05,bronze);
    for(const u of [0,.25,.5,.75,1])curve(w,canopy,v=>roof(u,v),.035,brass);
    for(const side of [-1,1])w.beam(V(side*5,0,-4.5),V(side*4,-9,-3),.12,bronze,canopy);
  }

  const gateway=w.group();gateway.position.set(0,17,-24);gateway.name='hq-monumental-harbour-gateway';
  arch(w,gateway,17,23,2.6,stone,1.3);
  const inner=arch(w,gateway,14.6,21.8,.6,bronze,.2);inner.position.z=1.5;
  const rim=arch(w,gateway,13.5,21,.15,brass,.12);rim.position.z=1.9;
  deck(w,gateway,20,7,0);
  for(const x of [-9.2,9.2]){
    w.box(2,44,4,stone,gateway,V(x,-2,0));
    w.box(2.4,.3,4.4,bronze,gateway,V(x,16,0));
    garden(w,gateway,V(x,16.3,1.3),2.4,x);
  }
  const threshold=w.group(gateway);threshold.position.set(0,.2,1.5);
  w.box(13,.12,5,bronze,threshold,V(0,0,0));
  for(const x of [-5,-2.5,0,2.5,5])w.box(.08,.02,5,brass,threshold,V(x,.08,0));
  const destination=plaque(w,gateway,'THE NEXT HORIZON','YOUR BASALT WORKSPACE',7);destination.position.set(0,17.2,2.1);
  const doors=[];
  for(const side of [-1,1]){
    const door=w.group(gateway);door.position.set(side*6.6,.2,0);
    w.box(6.6,13,.32,iron,door,V(-side*3.3,6.5,0));
    w.box(5.8,12,.07,bronze,door,V(-side*3.3,6.5,.2));
    for(const x of [1.2,2.5,3.8,5.1])w.box(.07,11.3,.1,brass,door,V(-side*x,6.5,.27));
    const medallion=w.mesh(new T.CylinderGeometry(.6,.6,.15,6),glow,door,V(-side*5.4,6.5,.3));medallion.rotation.x=Math.PI/2;
    doors.push({g:door,side});
  }
  // A tangible warm interior is visible through the opening, not an emissive portal disc.
  const interior=w.group(gateway);interior.position.z=-9;
  arch(w,interior,13,20,1,paper,.65);
  w.box(13,.3,16,stone,interior,V(0,-.3,1));
  for(const x of [-4.8,4.8])for(let i=0;i<4;i++)w.box(.25,14,.3,bronze,interior,V(x,7,4-i*3));

  const route=[
    [0,[-10,2,10]],[.19,[-7,5,4]],[.34,[6,12,0]],[.5,[7,15,-7]],
    [.66,[-6,23,-12]],[.8,[-2,25,-15]],[1,[0,25,-20]]
  ];
  const camera=flightPath([
    {p:0,eye:[-2,5,21],target:[-10,3,8],fov:47,roll:0},
    {p:.19,eye:[-1,8,17],target:[-6,6,0],fov:49,roll:-.06},
    {p:.34,eye:[15,16,14],target:[5,13,-2],fov:47,roll:.055},
    {p:.5,eye:[17,19,8],target:[6,16,-8],fov:48,roll:.025},
    {p:.66,eye:[5,28,5],target:[-6,24,-12],fov:48,roll:-.06},
    {p:.8,eye:[9,29,2],target:[-1,27,-19],fov:49,roll:-.025},
    {p:1,eye:[10,32,1],target:[0,27,-21],fov:48,roll:0}
  ]);
  craft.sails.forEach(batchStatic);
  batchBody(craft.g,craft.sails);
  bridges.forEach(({g})=>batchStatic(g));
  doors.forEach(({g})=>batchStatic(g));
  const fixed=collectArchitecture(w,before,[craft.g,...bridges.map(({g})=>g)]);
  batchBody(fixed,doors.map(({g})=>g));
  return {
    title:'The harbour above the clouds',stages:stageNames,camera,
    update(p,t){
      craft.g.position.copy(track(route,p));
      const current=track(route,Math.max(0,p-.015)),next=track(route,Math.min(1,p+.015));
      const direction=next.sub(current);
      if(direction.lengthSq()>.0001)craft.g.rotation.y=Math.atan2(-direction.x,-direction.z);
      craft.g.rotation.z=.12*Math.sin(p*Math.PI*3)*Math.sin(p*Math.PI);
      craft.g.rotation.x=-.12*Math.sin(p*Math.PI);
      craft.sails.forEach((s,i)=>{s.rotation.z=(i===0?-1:1)*(.025*Math.sin(t*.65)+.12*part(p,.81,1));});
      bridges.forEach((b,i)=>{b.g.rotation.y=b.angle+(1-part(p,.17+i*.2,.32+i*.2))*.34;});
      doors.forEach(({g,side})=>{g.rotation.y=-side*1.36*part(p,.73,.96);});
      const chapter=Math.min(3,Math.floor(p*4));
      w.narrative={chapter,subject:'One workspace carried through the aerial harbour',action:stageNames[chapter]};
    }
  };
}

function freightSail(w){
  const {brass,bronze,iron,paper,glow}=w.materials;
  const g=w.group();g.name='erp-conservatory-resource-carrier';
  const spine=w.mesh(new T.CapsuleGeometry(.24,5,5,20),bronze,g,V(0,.6,0));spine.rotation.x=Math.PI/2;
  const wings=[];
  for(const side of [-1,1]){
    const wing=w.group(g);wing.position.set(side*.25,1.3,0);wings.push({g:wing,side});
    const sail=(u,v)=>V(side*u*4.8,1.2*Math.sin(u*Math.PI*.9)+.22*Math.sin(v*Math.PI),(v-.5)*(4.5-1.5*u)+u*.55);
    membrane(w,wing,sail,paper);
    for(const u of [0,.2,.4,.6,.8,1])curve(w,wing,v=>sail(u,v),.027,brass,20);
    for(const v of [0,.5,1])curve(w,wing,u=>sail(u,v),.035,bronze);
    w.beam(V(0,-.7,0),sail(.8,.5),.025,iron,wing);
  }
  w.box(2.3,.22,3.1,bronze,g,V(0,-.1,0));
  const winch=w.mesh(new T.CylinderGeometry(.4,.4,2.2,24),brass,g,V(0,.25,0));winch.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
    w.beam(V(side*1.1,-.2,-1.4),V(side*.7,.9,-2.1),.05,bronze,g);
    w.mesh(new T.SphereGeometry(.13,12,8),glow,g,V(side*.7,.9,-2.1));
  }
  return{g,wings,winch};
}

function buildERP(w){
  const before=new Set(w.root.children);
  const {stone,bronze,brass,glass,iron,paper,glow}=w.materials;
  const stageNames=['One needed resource','The right route opens','Work moves in sequence','Delivered where it matters'];
  const carrier=freightSail(w);
  const cargo=w.group();cargo.name='erp-same-resource-through-entire-journey';
  w.box(2.5,1.5,2.2,paper,cargo,V(0,0,0));
  for(const x of [-1.05,1.05]){
    w.box(.14,1.56,2.27,bronze,cargo,V(x,0,0));
    for(const z of [-1.05,1.05])w.mesh(new T.SphereGeometry(.085,12,8),brass,cargo,V(x,.77,z));
  }
  for(const z of [-1,1])w.box(2.55,.1,.12,brass,cargo,V(0,.8,z));
  const label=plaque(w,cargo,'FIELD / 07','THE RESOURCE THIS WORK NEEDS',1.95);label.position.set(0,.05,1.13);
  const cables=[];
  for(const x of [-.95,.95])for(const z of [-.9,.9]){
    const cable=w.mesh(new T.CylinderGeometry(.018,.018,1,8),iron,w.root);
    cables.push({mesh:cable,x,z});
  }

  // A single continuous suspended conservatory supplies strong near/far parallax.
  const conservatory=w.group();conservatory.position.set(0,0,-3);
  for(const z of [-21,-13,-5,3,11]){
    curve(w,conservatory,u=>{const a=u*Math.PI;return V(Math.cos(a)*18,6+Math.sin(a)*21,z);},.16,bronze,40);
    for(const x of [-18,18]){
      w.box(1.1,20,1.7,stone,conservatory,V(x,-4,z));
      w.beam(V(x,6,z),V(x*.72,-2,z),.18,bronze,conservatory);
    }
  }
  const roof=(u,v)=>{const a=u*Math.PI;return V(Math.cos(a)*18,6+Math.sin(a)*21,-21+v*32);};
  membrane(w,conservatory,roof,glass,36,20);
  for(const u of [.12,.27,.5,.73,.88])curve(w,conservatory,v=>roof(u,v),.045,brass,32);
  for(const side of [-1,1]){
    const balcony=w.group(conservatory);balcony.position.set(side*14,1,-4);deck(w,balcony,4,34);
    for(const z of [-18,-10,-2,6,12])garden(w,conservatory,V(side*13,1.2,z),3.3,z);
    for(const z of [-17,-5,7]){
      const window=arch(w,conservatory,4.5,8,.5,stone,.45);window.position.set(side*14,1,z);
    }
  }
  // These rails visibly meet their gantry; their load remains attached to the hoist.
  const railCurve=new T.CatmullRomCurve3([V(-12,14,12),V(-8,16,4),V(-1,16,-6),V(9,16,-12)]);
  for(const x of [-1.5,1.5])curve(w,w.root,u=>railCurve.getPoint(u).add(V(x,0,0)),.075,bronze,64);
  for(const z of [-12,4,12]){
    const x=z===-12?9:z===4?-8:-12;
    w.beam(V(x-3,15.9,z),V(x+3,15.9,z),.16,bronze,w.root);
    for(const side of [-1,1])w.beam(V(x+side*3,16,z),V(side*17,18,z),.065,brass,w.root);
  }

  const entry=w.group();entry.position.set(-6,1,1);
  arch(w,entry,17,19,1.3,stone,.75);
  const inside=arch(w,entry,15.5,18,.3,bronze,.15);inside.position.z=.8;
  const shutters=[];
  for(const side of [-1,1]){
    const hinge=w.group(entry);hinge.position.set(side*7.5,0,0);
    w.box(7.4,13,.1,glass,hinge,V(-side*3.7,6.5,0));
    for(const x of [0,2.4,4.8,7.4])w.beam(V(-side*x,0,0),V(-side*x,13,0),.045,brass,hinge);
    for(const y of [0,4.3,8.6,13])w.beam(V(0,y,0),V(-side*7.4,y,0),.045,brass,hinge);
    shutters.push({g:hinge,side});
  }
  const routeSign=plaque(w,entry,'THE RIGHT WORKSHOP','RESOURCES / PEOPLE / PROGRESS',5);routeSign.position.set(0,15,.9);

  const receiver=w.group();receiver.position.set(9,1.6,-12);receiver.name='erp-resource-destination';
  deck(w,receiver,9,8);
  const cradle=w.group(receiver);cradle.position.set(0,.3,0);
  w.box(3,.25,2.8,iron,cradle,V(0,0,0));
  for(const x of [-1.6,1.6])w.box(.15,.7,3,bronze,cradle,V(x,.3,0));
  const ready=w.mesh(new T.CylinderGeometry(.22,.22,.08,24),glow,receiver,V(2.5,.4,2));
  const workshop=arch(w,receiver,8,13,1,stone,.55);workshop.position.z=-3;
  const destination=plaque(w,receiver,'FIELD / 07','READY FOR THE NEXT OPERATION',4);destination.position.set(0,10,-2.4);
  garden(w,receiver,V(-3.5,.1,-2),1.6);garden(w,receiver,V(3.5,.1,-2),1.6,2);
  const wheel=w.group(receiver);wheel.position.set(3.3,2,-1.5);wheel.rotation.y=-.4;
  w.mesh(new T.TorusGeometry(1.4,.09,10,48),bronze,wheel);
  w.mesh(new T.CylinderGeometry(.25,.25,.4,24),brass,wheel).rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;w.beam(V(0,0,0),V(Math.cos(a)*1.4,Math.sin(a)*1.4,0),.045,brass,wheel);}
  w.beam(V(3.3,0,-1.8),V(3.3,2,-1.8),.13,bronze,receiver);
  w.beam(V(3.3,2,-1.8),V(3.3,2,-1.4),.09,iron,receiver);

  const route=[[0,[-12,7,12]],[.2,[-9,9,6]],[.37,[-5,10,-1]],[.57,[1,10,-8]],[.72,[9,10,-12]],[1,[9,10,-12]]];
  const camera=flightPath([
    {p:0,eye:[-2,11,26],target:[-12,7,10],fov:47,roll:0},
    {p:.2,eye:[1,13,21],target:[-9,10,3],fov:49,roll:-.05},
    {p:.37,eye:[1,14,14],target:[-5,10,-2],fov:48,roll:-.035},
    {p:.57,eye:[9,14,7],target:[1,10,-8],fov:48,roll:.03},
    {p:.72,eye:[13,14,4],target:[9,9,-12],fov:48,roll:0},
    {p:.87,eye:[14,10,7],target:[9,7.8,-12],fov:49,roll:0},
    {p:1,eye:[14,12,10],target:[9,7.8,-12],fov:49,roll:0}
  ]);
  carrier.wings.forEach(({g})=>batchStatic(g));
  batchBody(carrier.g,[...carrier.wings.map(({g})=>g),carrier.winch]);
  batchStatic(cargo);batchStatic(wheel);shutters.forEach(({g})=>batchStatic(g));
  const fixed=collectArchitecture(w,before,[carrier.g,cargo,...cables.map(({mesh})=>mesh)]);
  batchBody(fixed,[wheel,ready,...shutters.map(({g})=>g)]);
  return{
    title:'The conservatory of coordinated work',stages:stageNames,camera,
    update(p,t){
      carrier.g.position.copy(track(route,p));
      carrier.g.rotation.z=.06*Math.sin(p*Math.PI*2)*(1-part(p,.65,.74));
      carrier.g.rotation.y=-.35*(1-part(p,.6,.72));
      carrier.wings.forEach(({g,side})=>{g.rotation.z=side*(.015*Math.sin(t*.6)+part(p,.75,.96)*.85);});
      const lower=part(p,.75,.94);
      cargo.position.copy(carrier.g.position).add(V(0,-1.8-lower*5.425,0));
      // Endpoint-derived ropes remain taut and meet the load during the entire lowering.
      carrier.g.updateMatrixWorld(true);cargo.updateMatrixWorld(true);
      for(const cable of cables){
        const top=carrier.g.localToWorld(V(cable.x,-.15,cable.z));
        const bottom=cargo.localToWorld(V(cable.x,.82,cable.z));
        const delta=top.clone().sub(bottom);
        cable.mesh.position.copy(top).add(bottom).multiplyScalar(.5);
        cable.mesh.scale.y=delta.length();cable.mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
      }
      carrier.winch.rotation.x=lower*Math.PI*7;
      shutters.forEach(({g,side})=>{g.rotation.y=-side*1.38*part(p,.14,.32);});
      wheel.rotation.z=part(p,.94,1)*Math.PI*.7;
      ready.scale.setScalar(.65+.35*part(p,.94,1));
      const chapter=Math.min(3,Math.floor(p*4));
      w.narrative={chapter,subject:'Field 07 resource remains identifiable from dispatch to delivery',action:stageNames[chapter]};
    }
  };
}

export const flightOperations={constellation:buildHQ,modules:buildERP};
