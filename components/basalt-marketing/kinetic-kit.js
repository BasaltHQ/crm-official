/* Physical materials and construction for the kinetic films. No figures or room sets. */
import {THREE as T} from './three-runtime.js';
export {T};
export const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const mix=T.MathUtils.lerp;
export const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
export const range=(p,a,b)=>smooth((p-a)/(b-a));
export function state(w,p,values={}){w.narrative={chapter:Math.min(3,Math.round(p*3)),...values};}

export function cameraTrack(shots){
    const eyes=new T.CatmullRomCurve3(shots.map(s=>v(...s.eye)),false,'centripetal');
    return p=>{
        const i=Math.min(shots.length-2,Math.max(0,shots.findIndex((s,j)=>j<shots.length-1&&p<=shots[j+1].p))),a=shots[i],b=shots[i+1];
        const u=smooth((p-a.p)/(b.p-a.p));
        return {position:eyes.getPoint((i+u)/(shots.length-1)),target:v(...a.look).lerp(v(...b.look),u),fov:mix(a.fov||42,b.fov||42,u)};
    };
}

export function createKit(w){
    const {root,mesh,box,group}=w;
    const metal=(color,roughness=.3)=>new T.MeshStandardMaterial({color,metalness:.76,roughness});
    const brass=metal('#c6a36b'),copper=metal('#ac734f',.35),iron=metal('#25363b',.4);
    const paper=new T.MeshStandardMaterial({color:'#eadfc5',roughness:.8,side:T.DoubleSide});
    const stone=new T.MeshStandardMaterial({color:'#b3ad96',roughness:.9});
    const darkwood=new T.MeshStandardMaterial({color:'#26322f',roughness:.7});
    const wood=new T.MeshStandardMaterial({color:'#6c5c43',roughness:.65});
    const green=new T.MeshStandardMaterial({color:'#477b61',roughness:.66,side:T.DoubleSide});
    const greenLight=new T.MeshStandardMaterial({color:'#97ab74',roughness:.7,side:T.DoubleSide});
    const cloth=new T.MeshPhysicalMaterial({color:w.accent.clone().lerp(new T.Color('#ada387'),.3),roughness:.68,sheen:.35,side:T.DoubleSide});
    const terra=new T.MeshStandardMaterial({color:'#9c634b',roughness:.9});
    const amber=new T.MeshStandardMaterial({color:'#efcc87',emissive:'#ffc66b',emissiveIntensity:1.4});
    const texture=(draw,width=768,height=768)=>{
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        draw(canvas.getContext('2d'),width,height);
        const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
    };
    const cylinder=(r1,r2,height,material=brass,parent=root,position=v(),sides=48)=>mesh(new T.CylinderGeometry(r1,r2,height,sides),material,parent,position);
    const beam=(a,b,width=.05,depth=.05,material=brass,parent=root)=>{
        const result=box(width,a.distanceTo(b),depth,material,parent,a.clone().add(b).multiplyScalar(.5));
        result.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());return result;
    };
    const gear=(radius,parent=root,material=brass,teeth=32)=>{
        const result=group(parent),shape=new T.Shape();
        for(let i=0;i<teeth*4;i++){
            const a=i/(teeth*4)*Math.PI*2,r=radius*(i%4===1||i%4===2?1.085:1);
            if(i)shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);else shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        }
        shape.closePath();const hole=new T.Path();hole.absarc(0,0,radius*.73,0,Math.PI*2,true);shape.holes.push(hole);
        mesh(new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2}),material,result);
        const hub=cylinder(radius*.12,radius*.12,.16,material,result,v(0,0,.04));hub.rotation.x=Math.PI/2;
        for(let i=0;i<6;i++){const spoke=box(radius*1.5,.035,.065,material,result,v(0,0,.04));spoke.rotation.z=i*Math.PI/3;}
        return result;
    };
    return {texture,cylinder,beam,gear,paper,stone,darkwood,wood,brass,copper,iron,green,greenLight,cloth,terra,amber};
}

export function ground(w,c,y=-2){
    const floor=w.mesh(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:'#1c2525',roughness:.78,metalness:.12}),w.root,v(0,y));
    floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.name='kinetic-ground';return floor;
}

export function panel(w,c,{width=2,height=2.6,parent=w.root,position=v(),draw,frame=true,material=c.paper,depth=.06}={}){
    const result=w.group(parent);result.position.copy(position);
    w.box(width,height,depth,material,result);
    if(draw){
        const map=c.texture(draw,768,Math.max(384,Math.round(768*height/width)));
        w.mesh(new T.PlaneGeometry(width*.965,height*.965),new T.MeshStandardMaterial({map,roughness:.78,side:T.DoubleSide}),result,v(0,0,depth/2+.002));
    }
    if(frame){
        for(const x of [-width/2,width/2])w.box(.025,height+.025,depth+.016,c.brass,result,v(x));
        for(const y of [-height/2,height/2])w.box(width+.025,.025,depth+.016,c.brass,result,v(0,y));
    }
    return result;
}
