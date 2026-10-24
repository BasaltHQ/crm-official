/* Shared stagecraft. Scroll owns blocking, props and camera; time only adds a living pause. */
import { THREE as T } from './three-runtime.js';
import { stage } from './narrative-acting.js';
export { T };
export const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export const range=(p,a,b)=>smooth((p-a)/(b-a));
export const key=(p,values)=>{const i=Math.min(2,Math.floor(T.MathUtils.clamp(p,0,1)*3)),u=smooth(p*3-i);return typeof values[0]==='number'?T.MathUtils.lerp(values[i],values[i+1],u):values[i].clone().lerp(values[i+1],u);};
export const frame=(p,x,z,yaw,action,focus=[0,1,0])=>({p,x,z,yaw,action,focus});
export function actor(w,c,position=v(),size=1,role='worker'){
    const h=c.person(w.root,position,c.cloth,size);h.g.userData.ground=position.y;h.g.userData.role=role;return h;
}
export function perform(w,h,track,p,t){return stage(h,track,p,w.reduced?0:t,w.reduced);}
export function hand(h,index,position,rotation=[0,0,0],curl=.35,point=0){
    h.g.updateMatrixWorld(true);
    const q=new T.Quaternion().setFromEuler(new T.Euler(...rotation,'YXZ'));
    h.handTo(index,h.g.localToWorld(position.clone()),h.g.getWorldQuaternion(new T.Quaternion()).multiply(q),curl,point);
}
export function reach(h,index,object,position,weight=1,curl=.5){
    h.g.updateMatrixWorld(true);object.updateWorldMatrix(true,true);
    const baseline=h.restHands[index];
    const target=baseline.position.clone().lerp(object.localToWorld(position.clone()),weight);
    // Palms face the task while elbows retain a downward bend.
    const rest=baseline.orientation.clone();
    const grip=object.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(-.35,(index?-1:1)*Math.PI/2,0)));
    h.handTo(index,target,rest.slerp(grip,weight),T.MathUtils.lerp(.28,curl,weight));
}
export function held(object){object.userData.heldProp=true;object.traverse(o=>{if(o.isMesh)o.userData.heldProp=true;});return object;}
export function placard(w,c,text,width=1,height=.3,parent=w.root){
    const g=w.group(parent),map=c.texture((ctx,cw,ch)=>{
        ctx.fillStyle='#222723';ctx.fillRect(0,0,cw,ch);ctx.strokeStyle='#a38b60';ctx.lineWidth=5;ctx.strokeRect(8,8,cw-16,ch-16);
        ctx.fillStyle='#f0dfba';ctx.textAlign='center';ctx.textBaseline='middle';
        const lines=String(text).split('\n');ctx.font=`600 ${Math.min(48,Math.floor(cw/(Math.max(...lines.map(l=>l.length))*.65)))}px Georgia`;
        lines.forEach((line,i)=>ctx.fillText(line,cw/2,ch/2+(i-(lines.length-1)/2)*48,cw-40));
    },768,Math.max(128,Math.round(768*height/width)));
    w.box(width+.035,height+.035,.035,c.brass,g);
    w.mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map,roughness:.9}),g,v(0,0,.02));return g;
}
export function architecture(w,c,{width=12,depth=14,height=5}={}){
    const g=w.group();g.name='inhabited-architecture';
    const floor=w.mesh(new T.PlaneGeometry(width+10,depth+12),new T.MeshStandardMaterial({color:'#514d40',roughness:1}),g,v(0,-.018));floor.rotation.x=-Math.PI/2;floor.castShadow=false;
    const parquet=w.kind==='shield'||w.kind==='pages';
    const paving={network:['#726d5b',.74,1.1],crystal:['#46444b',.82,1.2],modules:['#595e58',1.25,1.25],pages:['#79634d',.25,1.45],wave:['#81745b',.8,.8],shield:['#504338',.23,1.35]}[w.kind]||['#736b58',.8,1.1];
    const [tint,tileWidth,tileDepth]=paving;
    const tileGeo=new T.BoxGeometry(tileWidth-.012,.012,tileDepth-.012),tileMat=new T.MeshStandardMaterial({color:tint,roughness:parquet?.74:.94});
    tileMat.userData.basaltFinish=parquet?'timber':'stone';
    const nx=Math.ceil((width+6)/tileWidth),nz=Math.ceil((depth+6)/tileDepth),tiles=new T.InstancedMesh(tileGeo,tileMat,nx*nz),dummy=new T.Object3D();g.add(tiles);
    for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
        dummy.position.set((x-nx/2)*tileWidth,-.012,(z-nz/2+(x%2)*.5)*tileDepth);dummy.updateMatrix();tiles.setMatrixAt(x*nz+z,dummy.matrix);
        const value=.87+((x*7+z*13)%11)/110;tiles.setColorAt(x*nz+z,new T.Color().setRGB(value,value,value));
    }tiles.receiveShadow=true;
    // Distinct building types share materials, not the same room silhouette.
    if(w.kind==='crystal')return g;
    for(const x of [-width/2,width/2])for(const z of [-depth/2,-depth/6,depth/6]){
        c.solid(w.box(.26,height,.26,c.stone,g,v(x,height/2,z)),'hall-pillar');
        c.beam(v(x,height,z),v(x*.6,height+1,z),.14,.18,c.darkwood,g);
        c.drawing(new T.BoxGeometry(.29,height,.29,1,4,1),g,v(x,height/2,z));
        c.lantern(g,v(x*.95,height*.65,z),.7);
    }
    if(w.kind==='modules'){
        const glazing=new T.MeshStandardMaterial({color:'#adc4b1',transparent:true,opacity:.14,roughness:.4,side:T.DoubleSide});
        for(let i=0;i<12;i++){
            const x=(i-5.5)*width/12;
            w.mesh(new T.PlaneGeometry(width/12-.06,height*.55),glazing,g,v(x,height*.63,-depth/2));
            c.beam(v(x-width/24,height*.35,-depth/2),v(x-width/24,height*.91,-depth/2),.04,.055,c.iron,g);
        }
        for(const y of [height*.35,height*.63,height*.91])c.beam(v(-width/2,y,-depth/2),v(width/2,y,-depth/2),.055,.07,c.brass,g);
        for(let i=0;i<9;i++)c.beam(v(-width/2+i*width/8,height,-depth/2),v(-width/2+i*width/8,height+1.05,-depth/2+2),.07,.08,c.copper,g);
    }else if(w.kind==='pages'||w.kind==='wave'){
        for(const x of [-width*.29,0,width*.29]){
            c.arch(g,width*.25,height,v(x,0,-depth/2),false);
            const glass=w.mesh(new T.PlaneGeometry(width*.22,height*.7),new T.MeshStandardMaterial({color:'#829e86',transparent:true,opacity:.11,roughness:.5,side:T.DoubleSide}),g,v(x,height*.4,-depth/2));
            c.drawing(glass.geometry.clone(),g,glass.position);
        }
    }else if(w.kind==='shield')c.arch(g,width*.3,height,v(0,0,-depth/2),false);
    else for(const x of [-width*.29,0,width*.29])c.arch(g,width*.25,height,v(x,0,-depth/2),true);
    for(const z of [-depth/2,-depth/6,depth/6])c.beam(v(-width/2,height,z),v(width/2,height,z),.12,.18,c.darkwood,g);
    for(const x of [-width*.43,width*.43])c.plant(g,v(x,0,-depth*.35),1.5);
    return g;
}
export function finishStory(w,p,state){w.narrative={chapter:Math.min(3,Math.round(p*3)),owner:0,handoff:false,transfer:0,...state};}
export function cameraTrack(shots){
    const eyes=new T.CatmullRomCurve3(shots.map(s=>v(...s.eye)),false,'centripetal');
    return p=>{
        const i=Math.min(shots.length-2,Math.max(0,shots.findIndex((s,j)=>j<shots.length-1&&p<=shots[j+1].p))),a=shots[i],b=shots[i+1];
        const u=smooth((p-a.p)/(b.p-a.p));
        return {position:eyes.getPoint((i+u)/(shots.length-1)),target:v(...a.look).lerp(v(...b.look),u),fov:T.MathUtils.lerp(a.fov||42,b.fov||42,u)};
    };
}
