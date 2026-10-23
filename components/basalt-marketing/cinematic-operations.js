import {T,v,range,frame,actor,perform,reach,held,placard,architecture,finishStory} from './cinematic-kit.js';

export function buildERP(w,c){
    const {root,group,box,mesh}=w;
    architecture(w,c,{width:14,depth:13,height:5.1});
    const water=mesh(new T.PlaneGeometry(2.2,17),new T.MeshPhysicalMaterial({color:'#527b78',metalness:.25,roughness:.32,transparent:true,opacity:.75}),root,v(-6.2,-.025,-1));water.rotation.x=-Math.PI/2;
    for(const x of [-7.35,-5.05])c.beam(v(x,.04,-8),v(x,.04,7),.14,.17,c.stone);
    c.plant(root,v(5.1,0,-2.3),1.6);c.plant(root,v(-4.9,0,-3.8),1.4);
    const sign=placard(w,c,'THE IRRIGATION WORKS',3.9,.46);sign.position.set(0,4.5,-3.4);
    // The workshop's power has a source: a supported waterwheel drives a shaft,
    // while a copper supply manifold runs along the rear wall to the test bay.
    const mill=group();mill.position.set(-6.2,1.18,-2.6);mill.rotation.y=Math.PI/2;
    const wheel=c.gear(1.05,mill,c.darkwood,22);wheel.name='canal-power-wheel';
    const paddles=new T.InstancedMesh(new T.BoxGeometry(.16,.22,.63),c.wood,22),paddle=new T.Object3D();wheel.add(paddles);
    for(let i=0;i<22;i++){const a=i/22*Math.PI*2;paddle.position.set(Math.cos(a)*1.06,Math.sin(a)*1.06,.035);paddle.rotation.z=a;paddle.updateMatrix();paddles.setMatrixAt(i,paddle.matrix);}
    const wheelAxle=c.cylinder(.07,.07,2.1,c.brass,mill,v(0,0,.72));wheelAxle.rotation.x=Math.PI/2;
    for(const z of [-.56,.82]){c.beam(v(0,-1.15,z),v(0,0,z),.15,.19,c.stone,mill);const collar=c.cylinder(.13,.13,.2,c.iron,mill,v(0,0,z));collar.rotation.x=Math.PI/2;}
    w.path([v(-5.1,1.25,-2.6),v(-4.6,1.25,-3.8),v(-4.6,3.35,-5.3),v(-2.5,3.35,-5.3),v(3.6,3.35,-5.3)],.075,c.copper);
    for(const x of [-4.5,-2.5,0,2.5]){
        const clamp=c.cylinder(.104,.104,.08,c.brass,root,v(x,3.35,-5.3));clamp.rotation.z=Math.PI/2;
        c.beam(v(x,3.35,-5.3),v(x,3.35,-6.45),.035,.045,c.iron);
    }
    // Repeated roof members read as one engineered structure, not separate props.
    for(const z of [-5,-2,1]){
        for(const x of [-5.5,5.5]){c.beam(v(x,4.25,z),v(0,5.95,z),.09,.13,c.iron);c.beam(v(x,4.25,z),v(-x,4.25,z),.07,.1,c.copper);}
        for(const x of [-3.8,-1.9,0,1.9,3.8])c.beam(v(x,4.25,z),v(x,5.95-Math.abs(x)*.31,z),.035,.035,c.brass);
    }
    const cabinet=group();cabinet.position.set(3.8,0,-4.4);
    box(2.25,1.08,.72,c.darkwood,cabinet,v(0,.54));box(2.38,.075,.83,c.wood,cabinet,v(0,1.11));
    const drawerHandles=new T.InstancedMesh(new T.BoxGeometry(.32,.025,.035),c.brass,9),handleAt=new T.Object3D();cabinet.add(drawerHandles);
    for(let i=0;i<9;i++){const x=(i%3-1)*.71,y=.23+Math.floor(i/3)*.3;box(.68,.27,.027,c.wood,cabinet,v(x,y,.378));handleAt.position.set(x,y,.412);handleAt.updateMatrix();drawerHandles.setMatrixAt(i,handleAt.matrix);}
    c.folio('FIELD ORDERS','WATER FOR THE NEXT SEASON',cabinet,.5,.7).position.set(-.65,1.2,0);c.lantern(cabinet,v(.75,1.4),.8);
    const rails=group();rails.name='continuous-production-rail';
    for(const z of [-.43,.43])c.beam(v(-4.7,1,z),v(4.7,1,z),.07,.09,c.darkwood,rails);
    for(const x of [-4.4,-2.7,2.2,4.3])for(const z of [-.36,.36])c.solid(box(.11,.96,.11,c.iron,rails,v(x,.48,z)),'mill-support');
    const rollers=[];
    for(let i=0;i<29;i++){
        const x=-4.4+i*.315;if(Math.abs(x)<.85)continue;
        const roller=c.cylinder(.075,.075,.79,c.brass,rails,v(x,1.02),10);roller.rotation.x=Math.PI/2;rollers.push(roller);
    }
    // The missing operation arrives on real overhead rails and is lowered into the gap.
    const gantry=group();gantry.name='module-gantry';
    for(const x of [-1.3,1.3])for(const z of [-3.15,-.9])c.solid(box(.16,4.3,.16,c.darkwood,gantry,v(x,2.15,z)),'gantry-post');
    for(const x of [-1.3,1.3])c.beam(v(x,3.15,-.9),v(x,4.25,.65),.085,.09,c.iron,gantry);
    for(const x of [-1.3,1.3])c.beam(v(x,4.25,-3.2),v(x,4.25,.65),.12,.16,c.brass,gantry);
    const trolley=group(gantry);c.beam(v(-1.35,4.2),v(1.35,4.2),.15,.14,c.copper,trolley);
    for(const x of [-1.3,1.3])for(const z of [-.18,.18]){const bearing=c.cylinder(.12,.12,.055,c.iron,trolley,v(x,4.31,z));bearing.rotation.z=Math.PI/2;}
    const winch=c.gear(.21,trolley);winch.position.set(0,4.2,.1);
    const cable=c.cylinder(.015,.015,1,c.iron,gantry);
    const module=group();module.name='custom-pressure-station';
    c.solid(box(1.6,.13,.82,c.wood,module,v(0,1.02)),'custom-station');
    for(const x of [-.68,.68])for(const z of [-.31,.31])c.solid(box(.09,.95,.09,c.iron,module,v(x,.475,z)),'module-foot');
    for(const x of [-.55,.55])c.beam(v(x,1.1,-.29),v(x,2.05,-.29),.07,.07,c.brass,module);
    c.beam(v(-.6,2.05,-.29),v(.6,2.05,-.29),.09,.08,c.copper,module);
    const gauge=group(module);gauge.position.set(.45,1.53,-.22);
    const gaugeBody=c.cylinder(.15,.15,.05,c.brass,gauge,v(),32);gaugeBody.rotation.x=Math.PI/2;
    const gaugeMap=c.texture((ctx,cw,ch)=>{
        ctx.fillStyle='#e6d5af';ctx.fillRect(0,0,cw,ch);ctx.translate(cw/2,ch/2);
        for(let i=0;i<=30;i++){const a=-Math.PI*.8+i/30*Math.PI*1.6;ctx.save();ctx.rotate(a);ctx.strokeStyle=i>23?'#4d8774':'#514b3b';ctx.lineWidth=i%5===0?5:2;ctx.beginPath();ctx.moveTo(0,-cw*.4);ctx.lineTo(0,-cw*(i%5===0?.31:.35));ctx.stroke();ctx.restore();}
        ctx.fillStyle='#514b3b';ctx.font='bold 26px Georgia';ctx.textAlign='center';ctx.fillText('BAR',0,ch*.23);ctx.font='18px Georgia';ctx.fillText('FIELD / 07',0,ch*.34);
    },384,384);
    mesh(new T.CircleGeometry(.132,32),new T.MeshStandardMaterial({map:gaugeMap,roughness:.8}),gauge,v(0,0,.028));
    const needle=group(gauge);needle.position.z=.036;box(.01,.107,.008,c.iron,needle,v(0,.038));
    const dialHub=c.cylinder(.016,.016,.02,c.brass,gauge,v(0,0,.043));dialHub.rotation.x=Math.PI/2;
    for(const x of [-.55,.55]){w.ring(.051,.012,c.iron,module).position.set(x,1.45,-.24);w.ring(.051,.012,c.iron,module).position.set(x,1.9,-.24);}
    w.path([v(.44,1.52,-.29),v(.26,1.5,-.4),v(.05,1.74,-.42),v(-.34,1.74,-.42),v(-.48,1.39,-.18)],.018,c.copper,module);
    const inspectionLamp=mesh(new T.SphereGeometry(.055,16,10),new T.MeshStandardMaterial({color:'#47493c',emissive:'#74ceab',emissiveIntensity:0}),module,v(-.48,1.97,-.22));
    const moduleSign=placard(w,c,'PRESSURE / TEST',.78,.17,module);moduleSign.position.set(0,.81,.44);
    // The cable terminates at this fixed lifting eye.
    const eye=w.ring(.095,.014,c.brass,module);eye.position.set(0,2.08,-.29);
    // One identifiable pump persists from unfinished casting to inspected dispatch.
    const pump=held(group());pump.name='irrigation-pump';
    box(.79,.1,.65,c.iron,pump,v(0,.05));
    for(const x of [-.27,.27])box(.1,.15,.48,c.copper,pump,v(x,.15));
    const casing=c.cylinder(.25,.25,.34,c.brass,pump,v(0,.39),16);casing.rotation.x=Math.PI/2;
    const rotor=c.gear(.19,pump,c.copper,12);rotor.position.set(0,.39,.2);
    const lid=group(pump);lid.position.set(0,.61,.21);
    const cover=c.cylinder(.245,.245,.055,c.copper,lid,v(0,-.22));cover.rotation.x=Math.PI/2;
    const outlet=c.cylinder(.07,.07,.43,c.brass,pump,v(.24,.59,-.03),12);outlet.rotation.z=-.42;
    c.beam(v(.33,.76,-.03),v(.5,.76,-.03),.12,.12,c.brass,pump);
    const pumpPlate=placard(w,c,'FIELD / 07',.33,.095,pump);pumpPlate.position.set(0,.075,.346);
    const check=held(placard(w,c,'INSPECTED',.51,.14,pump));check.position.set(0,.73,.05);
    const lever=held(group());lever.position.set(.35,1.04,1.02);
    c.cylinder(.024,.024,.27,c.brass,lever,v(0,.135),8);const handle=c.cylinder(.04,.04,.16,c.darkwood,lever,v(0,.27),10);handle.rotation.z=Math.PI/2;
    c.solid(box(.28,.98,.22,c.iron,root,v(.35,.49,.99)),'control-pedestal');
    const operator=actor(w,c,v(-3.5,0,1.45),1,'operator'),next=actor(w,c,v(4.1,0,1.45),1,'dispatch');
    const track=[frame(0,-3.5,1.45,Math.PI,'inspect',[-3.8,1.4,0]),frame(1/3,-1.4,1.45,Math.PI,'assess',[0,1.4,0]),frame(.47,.25,1.45,Math.PI,'operate',[0,2,-1]),frame(2/3,.25,1.45,Math.PI,'verify',[0,1.4,0]),frame(1,3.1,1.45,1.3,'handoff',[4.1,1.5,1.45])];
    const receiving=[frame(0,4.1,1.45,-1.3,'wait',[0,1.3,0]),frame(1/3,4.1,1.45,-1.3,'prepare',[0,1.3,0]),frame(2/3,4.1,1.45,-1.3,'observe',[0,1.3,0]),frame(1,4.1,1.45,-2.6,'inspect',[3.5,1.4,0])];
    w.motions.push((p,t)=>{
        perform(w,operator,track,p,t);perform(w,next,receiving,p,t);
        module.position.set(0,1.35*range(p,.35,.44)*(1-range(p,.57,2/3)),-2.7*(1-range(p,.45,.57)));
        trolley.position.z=module.position.z-.29;
        const bottom=module.position.y+2.08;cable.scale.y=4.2-bottom;cable.position.set(0,(4.2+bottom)/2,module.position.z-.29);winch.rotation.z=-range(p,.35,.67)*Math.PI*4;
        pump.position.set(-3.8+2.55*range(p,0,.29)+2.25*range(p,.63,.78)+2.5*range(p,.8,1),1.1,0);
        lid.rotation.x=-1.25*(1-range(p,.68,.77));rotor.rotation.z=range(p,.67,.8)*Math.PI*3;
        check.scale.setScalar(Math.max(.001,range(p,.78,.85)));needle.rotation.z=-.7+range(p,.67,.8)*1.3;
        lever.rotation.x=.08+range(p,.48,.58)*.55;
        inspectionLamp.material.emissiveIntensity=range(p,.7,.79)*2.6;
        wheel.rotation.z=-p*Math.PI*3.6;
        const grip=range(p,.46,.5)*(1-range(p,.67,.72));reach(operator,0,lever,v(0,.27,0),grip,.55);
        rollers.forEach((roller,i)=>{roller.rotation.y=p*9+i*.1;});
        const chapter=Math.min(3,Math.round(p*3));
        w.caption=[{speaker:'A real order',text:'One pump. A missing operation.'},{speaker:'The operator',text:'This workflow needs a pressure test.'},{speaker:'A better fit',text:'Lock the station. Check the result.'},{speaker:'The next shift',text:'Ready to dispatch, with the work recorded.'}][chapter];
        finishStory(w,p,{task:operator.g.userData.action,owner:p>.9?1:0,stage:chapter,pumpComplete:p>=.8});
    });
    return{cinematic:true,shots:[
        {p:0,eye:[-5.3,2.3,3.2],look:[-3.7,1.3,.1],fov:42},
        {p:.18,eye:[-4.7,1.85,3.7],look:[-2,1.25,0],fov:45},
        {p:1/3,eye:[-2.8,2.2,4.6],look:[-.9,1.4,.1],fov:45},
        {p:.5,eye:[2.2,4.3,5.3],look:[0,2,-.8],fov:46},
        {p:2/3,eye:[2.7,2.35,4.7],look:[.3,1.3,.15],fov:44},
        {p:.83,eye:[3.8,2.05,4.4],look:[2.2,1.3,.15],fov:41},
        {p:1,eye:[6.5,2.6,5],look:[3.55,1.25,.5],fov:43}
    ]};
}
