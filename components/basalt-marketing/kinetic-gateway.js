import {T,v,range,mix,ground,panel,state} from './kinetic-kit.js';

const PI=Math.PI;

export function buildHQ(w,c){
    ground(w,c,-1.45);
    const gate=w.group(),district=w.group();district.position.set(0,0,-7.5);
    const basalt=new T.MeshStandardMaterial({color:'#25363d',roughness:.48,metalness:.22});
    const enamel=new T.MeshPhysicalMaterial({color:'#456b7c',roughness:.28,clearcoat:.5,clearcoatRoughness:.3});
    const glass=new T.MeshPhysicalMaterial({color:'#96c3ba',transparent:true,opacity:.3,roughness:.15,metalness:.25,side:T.DoubleSide,depthWrite:false});
    const glow=new T.MeshStandardMaterial({color:'#bdd8cc',emissive:'#69b9d5',emissiveIntensity:1.2});
    const archShape=new T.Shape();
    archShape.moveTo(-2.9,-1.4);archShape.lineTo(-2.9,1.95);
    archShape.bezierCurveTo(-2.9,3.7,-1.15,4.9,0,5.2);archShape.bezierCurveTo(1.15,4.9,2.9,3.7,2.9,1.95);archShape.lineTo(2.9,-1.4);
    // Trace the open threshold as part of the contour. A hole crossing the
    // outer boundary produces a solid arch face when triangulated.
    archShape.lineTo(2.14,-1.4);archShape.lineTo(2.14,1.93);
    archShape.bezierCurveTo(2.14,3.2,.9,4.15,0,4.45);archShape.bezierCurveTo(-.9,4.15,-2.14,3.2,-2.14,1.93);archShape.lineTo(-2.14,-1.4);archShape.closePath();
    w.mesh(new T.ExtrudeGeometry(archShape,{depth:.48,bevelEnabled:true,bevelThickness:.045,bevelSize:.045,bevelSegments:3,curveSegments:40}),basalt,gate,v(0,0,-.24));
    for(const offset of [0,.16]){
        const points=[v(-2.45-offset,-1.35,.29),v(-2.45-offset,1.9,.29),v(-1.86-offset,3.37,.29),v(0,4.78+offset,.29),v(1.86+offset,3.37,.29),v(2.45+offset,1.9,.29),v(2.45+offset,-1.35,.29)];
        w.path(points,.016,c.brass,gate);
    }
    // Two leaves swing on visible hinge barrels. The camera passes through the
    // opening only after they have cleared the threshold.
    const doors=[];
    for(const side of [-1,1]){
        const hinge=w.group(gate);hinge.position.x=side*2.08;if(side===1)hinge.scale.x=-1;
        const shape=new T.Shape();shape.moveTo(0,-1.28);shape.lineTo(2.055,-1.28);shape.lineTo(2.055,4.24);shape.bezierCurveTo(1.18,3.85,.06,3.1,0,1.95);shape.closePath();
        w.mesh(new T.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:3,curveSegments:32}),enamel,hinge,v(0,0,-.07));
        for(const y of [-.85,.55,1.8])c.cylinder(.1,.1,.4,c.brass,gate,v(side*2.08,y),32);
        for(let line=0;line<5;line++){
            const x=.22+line*.37,top=1.9+line*.39;
            w.path([v(x,-1.12,.1),v(x,top*.55,.1),v(x+.15,top-.25,.1),v(Math.min(2.02,x+.34),top,.1)],.012,c.brass,hinge);
        }
        w.box(.022,5.1,.025,glow,hinge,v(2.04,1.25,.087));
        const handle=w.ring(.15,.024,c.brass,hinge);handle.position.set(1.75,1,.14);
        doors.push({hinge,side});
    }
    for(let step=0;step<4;step++)w.box(6.3-step*.13,.12,1.05,c.stone,w.root,v(0,-1.39+step*.06,1.6-step*.8));
    // A single promenade makes the relationship between the threshold and the
    // growing garden physical; the light travels along its inset brass rails.
    w.box(1.85,.13,7.3,basalt,w.root,v(0,-1.32,-3.4));
    for(const x of [-.82,.82])w.box(.025,.016,7.3,c.brass,w.root,v(x,-1.243,-3.4));
    const waylights=[];
    for(let i=0;i<18;i++){
        const material=glow.clone();material.emissiveIntensity=0;
        w.box(.045,.025,.2,material,w.root,v(i%2?.82:-.82,-1.23,-i*.37));waylights.push(material);
    }
    const basin=c.cylinder(1.2,1.46,.32,basalt,district,v(0,-1.23),72);
    basin.name='root-basin';
    const water=c.cylinder(1.1,1.1,.03,glass,district,v(0,-1.05),72);
    const crown=w.group(district);c.cylinder(.12,.21,4.65,c.brass,crown,v(0,1.1),48);
    const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.93,.95,-.88,2.8,0,4.05);leafShape.bezierCurveTo(.88,2.8,.93,.95,0,0);
    const leafGeometry=new T.ExtrudeGeometry(leafShape,{depth:.085,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,curveSegments:32});
    const apps=[['CRM','#52e6df','RELATIONSHIPS'],['ONYX','#c3a0ff','YOUR VOICE'],['ERP','#2bfff8','OPERATIONS'],['CMS','#b7a5ff','YOUR STORY'],['ECHO','#ffc029','CONVERSATION'],['VIGIL','#ff616c','REASONING'],['SURGE','#fa8b4b','COMMERCE'],['HQ','#58adff','TOGETHER']];
    const petals=[],ribs=[];
    apps.forEach(([name,color,purpose],i)=>{
        const angle=(i+.5)/8*PI*2,spoke=w.group(district);spoke.rotation.y=angle;
        const hinge=w.group(spoke);hinge.position.set(0,-1.04,.62);
        const mat=new T.MeshPhysicalMaterial({color:new T.Color(color).lerp(new T.Color('#b6b897'),.55),roughness:.35,metalness:.28,clearcoat:.2});
        const leaf=w.mesh(leafGeometry,mat,hinge);leaf.rotation.x=PI/2;
        const axle=c.cylinder(.1,.1,.7,c.brass,hinge,v(0,0,.15),32);axle.rotation.z=PI/2;
        w.path([v(0,.035,.15),v(0,.05,1.7),v(0,.035,3.96)],.022,c.brass,hinge);
        for(const side of [-1,1])for(const z of [.9,1.6,2.3])w.path([v(0,.035,z-.3),v(side*.25,.04,z),v(side*.49,.035,z+.3)],.008,c.brass,hinge);
        const display=panel(w,c,{width:1.15,height:1.65,parent:hinge,position:v(0,.92,2.75),material:basalt,draw:(ctx,cw,ch)=>{
            ctx.fillStyle='#1d3034';ctx.fillRect(0,0,cw,ch);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(30,30,cw-60,ch-60);
            ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 90px Georgia';ctx.fillText(name,cw/2,ch*.31);
            ctx.strokeStyle='#d9c49c';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(cw*.29,ch*.48);ctx.lineTo(cw*.71,ch*.48);ctx.lineTo(cw*.68,ch*.66);ctx.quadraticCurveTo(cw*.63,ch*.76,cw*.5,ch*.81);ctx.quadraticCurveTo(cw*.37,ch*.76,cw*.32,ch*.66);ctx.closePath();ctx.stroke();
            ctx.font='21px sans-serif';ctx.fillStyle='#e9ddc3';ctx.fillText(purpose,cw/2,ch*.91);
        }});
        display.rotation.y=PI;petals.push({hinge,display});
        const rib=w.group(crown);rib.position.y=3.05;rib.rotation.y=angle;
        const branch=w.group(rib);w.path([v(),v(0,.45,1.4),v(0,.23,3.05)],.035,c.brass,branch);
        const solar=new T.Shape();solar.moveTo(0,.15);solar.bezierCurveTo(-.7,.7,-.62,2.3,0,3.08);solar.bezierCurveTo(.62,2.3,.7,.7,0,.15);
        const membrane=w.mesh(new T.ShapeGeometry(solar,32),glass,branch,v(0,.025));membrane.rotation.x=PI/2;
        for(let j=0;j<6;j++)w.path([v(-.3,.04,.65+j*.28),v(0,.12,.78+j*.28),v(.3,.04,.65+j*.28)],.006,c.brass,branch);
        ribs.push(branch);
    });
    w.kineticSubjects=[...doors.map(d=>d.hinge),...petals.map(p=>p.hinge),...ribs];
    w.motions.push(p=>{
        const opening=range(p,.025,.35),unfurl=range(p,.32,.72),roof=range(p,.66,.98);
        doors.forEach(({hinge,side})=>{hinge.rotation.y=-side*opening*1.28;});
        petals.forEach(({hinge,display},i)=>{
            const spread=range(p,.32+i*.018,.6+i*.018);hinge.rotation.x=-1.12*(1-spread);
            display.rotation.x=mix(-.8,0,spread);
        });
        ribs.forEach((branch,i)=>{branch.rotation.x=mix(1.38,0,range(p,.66+i*.012,.86+i*.012));});
        waylights.forEach((material,i)=>{material.emissiveIntensity=range(p,.15+i*.018,.21+i*.018)*2;});
        water.material.opacity=.2+.28*roof;
        state(w,p,{gatewayOpen:opening,gardenOpen:unfurl,canopyOpen:roof});
        w.caption={speaker:'BASALT HQ',text:p<.3?'Begin with one useful opening.':p<.62?'Give every part of the business room to work.':p<.88?'Connect the paths between them.':'One ecosystem. Room for what comes next.'};
    });
    return {shots:[
        {p:0,eye:[1.15,1.9,8.3],look:[0,1.45,0],fov:42},
        {p:.25,eye:[3.7,2.45,7.3],look:[0,1.1,-.8],fov:46},
        {p:.5,eye:[.4,2.3,1.2],look:[0,.75,-6.8],fov:48},
        {p:.72,eye:[2.2,3.5,-1.8],look:[0,1,-7.5],fov:48},
        {p:1,eye:[8.8,7.8,3.5],look:[0,1,-5.5],fov:47},
    ]};
}
