/* Basalt lantern-keepers: ceramic shield faces, warm optical shutters and
 * hand-finished brass. All dimensions are metres; every mesh belongs to body(). */
import { THREE as T } from './three-runtime.js';

const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;

export function createGuildFace({group,body,seam,head,variation=0}){
    const style=variation%4;
    const ceramic=new T.MeshPhysicalMaterial({color:['#eee0bd','#ebd6ad','#e5dfc5','#f0dfbd'][style],roughness:.29,metalness:.02,clearcoat:.24,clearcoatRoughness:.22});
    const casing=new T.MeshStandardMaterial({color:['#233c37','#293e43','#3b443d','#2d393c'][style],roughness:.48,metalness:.36});
    const panel=new T.MeshStandardMaterial({color:'#172d2b',roughness:.5,metalness:.32});
    const brass=new T.MeshStandardMaterial({color:'#a98c51',metalness:.77,roughness:.34});
    const brassEdge=new T.MeshStandardMaterial({color:'#d3b778',metalness:.67,roughness:.29});
    const dark=new T.MeshStandardMaterial({color:'#342d21',roughness:.64,metalness:.3});
    const amber=new T.MeshStandardMaterial({color:'#c98323',emissive:'#ffae32',emissiveIntensity:.75,roughness:.24,metalness:.14});
    const apertureEdge=new T.MeshStandardMaterial({color:'#c88736',emissive:'#b56a1d',emissiveIntensity:.25,roughness:.4,metalness:.4});
    function oval(parent,name,material,position,scale){const m=body(new T.SphereGeometry(1,16,10),material,parent,name,position);m.scale.copy(scale);return m;}
    const plate=new T.Shape();
    plate.moveTo(0,.218);
    plate.bezierCurveTo(.027,.219,.061,.216,.072,.199);
    plate.bezierCurveTo(.085,.181,.083,.145,.076,.117);
    plate.bezierCurveTo(.069,.089,.058,.058,.033,.044);
    plate.bezierCurveTo(.017,.035,-.017,.035,-.033,.044);
    plate.bezierCurveTo(-.058,.058,-.069,.089,-.076,.117);
    plate.bezierCurveTo(-.083,.145,-.085,.181,-.072,.199);
    plate.bezierCurveTo(-.061,.216,-.027,.219,0,.218);
    const faceZ=(x,y)=>.071+.015*Math.max(0,1-(x/.092)**2-((y-.137)/.147)**2);
    function ceramicSurface(source){
        const original=source.index?source.toNonIndexed():source,p=original.getAttribute('position'),n=original.getAttribute('normal'),positions=[],normals=[];
        function emit(a,b,c){
            for(const q of [a,b,c]){
                const [x,y,z,nx,ny,nz]=q,inside=1-(x/.092)**2-((y-.137)/.147)**2>0,dx=inside?-.03*x/.092**2:0,dy=inside?-.03*(y-.137)/.147**2:0;
                positions.push(x,y,z+faceZ(x,y));const normal=v(nx-nz*dx,ny-nz*dy,nz).normalize();normals.push(...normal.toArray());
            }
        }
        for(let i=0;i<p.count;i+=3){const vertex=j=>[p.getX(j),p.getY(j),p.getZ(j),n.getX(j),n.getY(j),n.getZ(j)];emit(vertex(i),vertex(i+1),vertex(i+2));}
        const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
        if(original!==source)original.dispose();source.dispose();return result;
    }
    // One continuous housing closes from the ceramic perimeter to the rear pole.
    // Its silhouette has no intersecting skull, hood, cap or floating face mask.
    const outline=plate.getPoints(20),hoodPositions=[],hoodIndices=[],hoodRows=32;
    for(let row=0;row<=hoodRows;row++)for(let i=0;i<outline.length;i++){
        const t=row/hoodRows,p=outline[i],angle=t*Math.PI/2,scale=Math.cos(angle)*(1+.12*Math.sin(angle*2)),x=p.x*1.035*scale,y=.123+(p.y-.123)*1.08*scale;
        hoodPositions.push(x,y,lerp(faceZ(p.x,p.y)-.0006,-.084,Math.sin(angle)));
        if(row&&i){const a=row*outline.length+i;hoodIndices.push(a-outline.length-1,a,a-1,a-outline.length-1,a-outline.length,a);}
    }
    const hood=new T.BufferGeometry();hood.setAttribute('position',new T.Float32BufferAttribute(hoodPositions,3));hood.setIndex(hoodIndices);hood.computeVertexNormals();body(hood,casing,head,'head');
    body(new T.CylinderGeometry(.026,.028,.039,40),casing,head,'head-neck-stem',v(0,.018,-.006));
    const eyeY=.139,eyeX=.032,width=.023,height=.018;
    function roundRect(path,x,y,w,h,r){
        path.moveTo(x-w+r,y-h);path.lineTo(x+w-r,y-h);path.quadraticCurveTo(x+w,y-h,x+w,y-h+r);
        path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        path.lineTo(x-w+r,y+h);path.quadraticCurveTo(x-w,y+h,x-w,y+h-r);
        path.lineTo(x-w,y-h+r);path.quadraticCurveTo(x-w,y-h,x-w+r,y-h);return path;
    }
    for(const side of [-1,1])plate.holes.push(roundRect(new T.Path(),side*eyeX,eyeY,width,height,.012));
    const ceramicGeo=ceramicSurface(new T.ExtrudeGeometry(plate,{depth:.0044,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.0016,bevelThickness:.0017,curveSegments:24}));
    body(ceramicGeo,ceramic,head,'ceramic-shield-face');
    const perimeter=plate.getPoints(28).map(p=>v(p.x,p.y,faceZ(p.x,p.y)+.0062));
    body(new T.TubeGeometry(new T.CatmullRomCurve3(perimeter.slice(0,-1),true),160,.0013,8,true),brassEdge,head,'faceplate-brass-perimeter');
    // Recessed optical chambers have real ceramic openings, so the lights never
    // sit on the surface like stickers. The bevel picks up the scene lighting.
    const eyes=[];
    for(const side of [-1,1]){
        const x=side*eyeX,eye=group(head),opening=roundRect(new T.Shape(),x,eyeY,width-.0004,height-.0004,.0115);
        const socket=new T.ShapeGeometry(opening,24),spos=socket.getAttribute('position');
        for(let i=0;i<spos.count;i++)spos.setZ(i,faceZ(spos.getX(i),spos.getY(i))+.0008);socket.computeVertexNormals();body(socket,dark,eye,'optical-chamber');
        const rim=opening.getPoints(24).map(p=>v(p.x,p.y,faceZ(p.x,p.y)+.0022));seam(eye,'amber-optical-bezel',apertureEdge,rim,.00085);
        const columns=32,rows=12,indices=[],positions=new Float32Array((columns+1)*(rows+1)*3),colors=new Float32Array(positions.length);
        for(let row=1;row<=rows;row++)for(let col=1;col<=columns;col++){const n=row*(columns+1)+col;indices.push(n-columns-2,n,n-1,n-columns-2,n-columns-1,n);}
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setIndex(indices);
        const lightMaterial=amber.clone();lightMaterial.vertexColors=true;body(geo,lightMaterial,eye,'lantern-eye');
        const shutterGeo=new T.BufferGeometry(),shutterPositions=new Float32Array((columns+1)*2*3),shutterIndices=[];
        for(let col=1;col<=columns;col++){const n=columns+1+col;shutterIndices.push(n-columns-2,n,n-1,n-columns-2,n-columns-1,n);}
        shutterGeo.setAttribute('position',new T.BufferAttribute(shutterPositions,3));shutterGeo.setIndex(shutterIndices);body(shutterGeo,brassEdge,eye,'optical-upper-shutter');
        function update(open,focus,friendly,attention){
            const p=geo.getAttribute('position'),c=geo.getAttribute('color'),sh=shutterGeo.getAttribute('position');let vertex=0;
            for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
                const u=lerp(-1,1,col/columns),curve=Math.pow(Math.max(0,1-Math.abs(u)**4),.25),xx=x+u*(width-.0028);
                const lean=side*u*(friendly?.0016:focus?-.00065:0),lower=-(height-.0038)*curve*open+(friendly?.0022*curve:0)+lean;
                const upper=(height-.0032)*curve*open-(focus?.0031*curve:0)+lean;
                const yy=eyeY+lerp(lower,Math.max(lower+.0004,upper),row/rows),glow=Math.max(0,1-((u-attention*.08)/1.2)**2-(row/rows-.52)**2*.8);
                p.setXYZ(vertex,xx,yy,faceZ(xx,yy)+.0018);c.setXYZ(vertex,1,.81+glow*.19,.48+glow*.52);vertex++;
            }
            for(let row=0;row<2;row++)for(let col=0;col<=columns;col++){
                const u=lerp(-1,1,col/columns),curve=Math.pow(Math.max(0,1-Math.abs(u)**4),.25),xx=x+u*(width-.0028),lean=side*u*(friendly?.0016:focus?-.00065:0);
                const yy=eyeY+(height-.0032)*curve*open-(focus?.0031*curve:0)+lean+(row?.0006:-.0006);
                sh.setXYZ(row*(columns+1)+col,xx,yy,faceZ(xx,yy)+.0026);
            }
            p.needsUpdate=true;c.needsUpdate=true;geo.computeVertexNormals();sh.needsUpdate=true;shutterGeo.computeVertexNormals();
            lightMaterial.emissiveIntensity=friendly?.85:focus?.62:.75;
        }
        eyes.push({update});
    }
    // Three offset strata are the guild signature, placed asymmetrically like
    // an artisan's hallmark, and echo the chest clasp without becoming a brow.
    for(let i=0;i<3;i++){
        const y=.197-i*.0055,x=-.028+i*.004;
        seam(head,'guild-stratum-inlay',brass,[v(x,y,faceZ(x,y)+.0066),v(x+.013,y,faceZ(x+.013,y)+.0066),v(x+.021,y+.004,faceZ(x+.021,y+.004)+.0066)],.0011);
    }
    // The side pivots are small, engineered joints, not human ears or face tubes.
    for(const side of [-1,1]){
        const hinge=group(head);hinge.position.set(side*.083,.133,-.004);hinge.rotation.z=-side*Math.PI/2;
        body(new T.CylinderGeometry(.019,.020,.008,40),brass,hinge,'temple-pivot');
        body(new T.CylinderGeometry(.014,.014,.0095,40),panel,hinge,'temple-bearing');
        body(new T.CylinderGeometry(.007,.007,.010,32),brassEdge,hinge,'temple-axle');
        for(let i=0;i<3;i++){
            const a=i/3*Math.PI*2+.2;oval(hinge,'pivot-rivet',brassEdge,v(Math.cos(a)*.016,.005,Math.sin(a)*.016),v(.0017,.001,.0017));
        }
    }
    let last='';
    function pose({time=0,reduced=false,activity='',walking=0,attention=0}={}){
        const focused=/read|write|review|stamp|inspect|grasp|collect|take/.test(activity),friendly=/offer|handoff|receive|accept|greet|listen|explain|thank/.test(activity);
        const cycle=reduced?2:(time+variation*.83)%6.2,blink=cycle<.2?Math.sin(cycle/.2*Math.PI)**1.2:0;
        const openness=clamp(1-blink-(walking>.5?.04:0),.025,1),look=clamp(attention,-1,1),state=[openness.toFixed(4),focused,friendly,look.toFixed(3)].join('|');
        if(state===last)return;last=state;eyes.forEach(eye=>eye.update(openness,focused,friendly,look));
    }
    pose({reduced:true});
    return {pose,eyes};
}
