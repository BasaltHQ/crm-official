/* Check the actual CRM meshes throughout the flight, not just chapter stills.
 * A padded oriented box for each visible moving mesh is tested against nearby
 * static triangles, conservatively including the complete paper wings. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild');
const {chromium}=require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const dir=path.join(root,'components/basalt-marketing').replaceAll('\\','/');
 const source=`import {T,V,createFlightKit} from '${dir}/flight-kit.js';
 import {experienceEditorial} from '${dir}/experience-editorial.js';
 const scene=new T.Group(),w=createFlightKit(scene,new T.Color('#52e6df')),film=experienceEditorial.network(w);
 const moving=scene.children.filter(o=>o.name==='the-letter-that-learned-to-fly'||o.name==='crm-customer-reply'||o.name.startsWith('retained-'));
 const fixed=scene.children.filter(o=>!moving.includes(o));scene.updateMatrixWorld(true);
 const obstacles=[];for(const group of fixed)group.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh)return;
  mesh.geometry.computeBoundingBox();
  obstacles.push({mesh,label:group.name||'fixed architecture',worldBox:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)});
 });
 const bodies=[];for(const group of moving)group.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();bodies.push({mesh,label:group.name});}});
 const visible=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return !object.material.transparent||object.material.opacity>.001;};
 const a=V(),b=V(),c=V(),triangle=new T.Triangle(),matrix=new T.Matrix4(),inverse=new T.Matrix4();
 function overlaps(body,obstacle,margin){
  const box=body.geometry.boundingBox.clone().expandByScalar(margin),worldBox=box.clone().applyMatrix4(body.matrixWorld);
  if(!worldBox.intersectsBox(obstacle.worldBox))return false;
  inverse.copy(body.matrixWorld).invert();matrix.multiplyMatrices(inverse,obstacle.mesh.matrixWorld);
  const geometry=obstacle.mesh.geometry,positions=geometry.attributes.position,index=geometry.index,count=index?index.count:positions.count;
  for(let i=0;i<count;i+=3){
   a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);
   b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);
   c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);
   triangle.set(a,b,c);if(box.intersectsTriangle(triangle))return true;
  }
  return false;
 }
 window.audit=()=>{
  const failures=[],collisionGroups={},samples=2001;let previous=null,maxPositionStep=0,maxRotationStep=0,maxCameraStep=0,routeLength=0,cameraLength=0;
  for(let i=0;i<samples;i++){
   const p=i/(samples-1);film.update(p,0);scene.updateMatrixWorld(true);
   const craft=moving.find(o=>o.name==='the-letter-that-learned-to-fly'),shot=film.camera(p);
   if(previous){const distance=craft.position.distanceTo(previous.position),cameraDistance=shot.eye.distanceTo(previous.eye);routeLength+=distance;cameraLength+=cameraDistance;maxPositionStep=Math.max(maxPositionStep,distance);maxRotationStep=Math.max(maxRotationStep,craft.quaternion.angleTo(previous.quaternion));maxCameraStep=Math.max(maxCameraStep,cameraDistance);}
   previous={position:craft.position.clone(),quaternion:craft.quaternion.clone(),eye:shot.eye.clone()};
   for(const body of bodies){if(!visible(body.mesh))continue;for(const obstacle of obstacles){if(overlaps(body.mesh,obstacle,.075)){const key=body.label+' / '+obstacle.label,entry=collisionGroups[key]??={count:0,first:p,last:p};entry.count++;entry.last=p;if(failures.length<12)failures.push({p,body:body.label,obstacle:obstacle.label,position:body.mesh.getWorldPosition(V()).toArray()});break;}}}
  }
  const landmarks=w.narrative.landmarks,stops=['launch','context','review','reply'];
  const stationDistances=stops.slice(1).map((name,i)=>V(...landmarks[name]).distanceTo(V(...landmarks[stops[i]])));
  const joins=[.4,.48,.53,.66,.70,.73,.79,.87,.9].map(p=>{
   film.update(p-.000001,0);const before=film.camera(p-.000001),q=moving[0].quaternion.clone();film.update(p+.000001,0);const after=film.camera(p+.000001);
   return {p,cameraJump:before.eye.distanceTo(after.eye),rotationJump:q.angleTo(moving[0].quaternion)};
  });
  return {samples,margin:.075,movingMeshes:bodies.length,staticMeshes:obstacles.length,failures,collisionGroups,routeLength,cameraLength,stationDistances,maxPositionStep,maxRotationStep,maxCameraStep,joins};
 };`;
 const bundle=await esbuild.build({stdin:{contents:source,resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser'});
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);const result=await page.evaluate(()=>window.audit());
  fs.mkdirSync(path.join(root,'.basalt-previews'),{recursive:true});fs.writeFileSync(path.join(root,'.basalt-previews/flight-clearance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[],'Moving correspondence intersects architecture.');
  assert.ok(result.routeLength>450&&result.stationDistances.every(distance=>distance>110),'The four destinations must remain geographically separated.');
  // Compare per-sample travel with the entire journey, since the route spans
  // distant landmarks. Bound the peak at 4x/6x average flight/camera travel.
  assert.ok(result.maxPositionStep/result.routeLength<.002&&result.maxCameraStep/result.cameraLength<.003,'Flight/camera translation is discontinuous.');
  assert.ok(result.maxRotationStep<.05,'Flight orientation changes abruptly.');
  assert.ok(result.joins.every(x=>x.cameraJump<.01&&x.rotationJump<.01),'A chapter boundary jumps.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
