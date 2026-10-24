import {T,v,range,mix,ground,state} from './kinetic-kit.js';

const TAU=Math.PI*2;

/** A cutaway waterworks: understand the mechanism, connect the missing operation,
 * then watch the resulting current open and irrigate living terraces. */
export function buildERP(w,c){
    const {root,group,mesh,box}=w;
    ground(w,c,-2.18);
    const works=group();works.name='waterworks-assembly';
    const main=group(works);main.position.set(-1.15,.2,0);
    const patina=new T.MeshPhysicalMaterial({color:'#6daca0',metalness:.55,roughness:.31,clearcoat:.3});
    const glass=new T.MeshPhysicalMaterial({color:'#94d2bf',metalness:.08,roughness:.08,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false});
    const water=new T.MeshPhysicalMaterial({color:'#70dbcb',emissive:'#4caeaa',emissiveIntensity:.42,metalness:.12,roughness:.12,transparent:true,opacity:.86});
    const fertile=new T.MeshStandardMaterial({color:'#254b3b',roughness:.92});
    const rotor=group(main);rotor.name='twelve-vane-impeller';

    // Swept vanes occupy disjoint angular sectors. Their tangential width stays
    // below the 30-degree pitch, including the bevel, so closeups never z-fight.
    const blade=new T.Shape();
    for(let edge=0;edge<2;edge++)for(let step=0;step<=24;step++){
        const u=edge?1-step/24:step/24,r=.285+u*.975,a=-.39*u+(edge?.095:-.095);
        const x=Math.sin(a)*r,y=Math.cos(a)*r;
        if(!edge&&!step)blade.moveTo(x,y);else blade.lineTo(x,y);
    }
    blade.closePath();
    const vaneGeometry=new T.ExtrudeGeometry(blade,{depth:.105,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:3,curveSegments:18});
    for(let i=0;i<12;i++){
        const vane=mesh(vaneGeometry,i%3?c.brass:patina,rotor);vane.rotation.z=i/12*TAU;vane.rotation.y=.08;
    }
    const axle=c.cylinder(.11,.11,3.15,c.iron,main,v(0,0,-.18));axle.rotation.x=Math.PI/2;
    const hub=c.cylinder(.32,.27,.4,c.copper,rotor,v(0,0,.09));hub.rotation.x=Math.PI/2;
    const cap=c.cylinder(.19,.24,.12,c.brass,rotor,v(0,0,.34));cap.rotation.x=Math.PI/2;
    const badge=mesh(new T.IcosahedronGeometry(.09,0),patina,rotor,v(0,0,.415));badge.scale.z=.28;

    // Two annular casings slide on visible guide rods. No shell floats unsupported.
    const front=group(main),back=group(main);front.name='front-casing';back.name='rear-casing';
    function rim(parent,radius,depth,material){
        const profile=new T.Shape();profile.absarc(0,0,radius,0,TAU,false);
        const hole=new T.Path();hole.absarc(0,0,radius-.105,0,TAU,true);profile.holes.push(hole);
        return mesh(new T.ExtrudeGeometry(profile,{depth,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,curveSegments:64}),material,parent,v(0,0,-depth/2));
    }
    for(const shell of [front,back]){
        rim(shell,1.5,.11,c.copper);rim(shell,1.36,.045,c.brass);
        const sleeve=mesh(new T.CylinderGeometry(1.48,1.48,.32,72,1,true),glass,shell,v(0,0,shell===front?-.15:.15));sleeve.rotation.x=Math.PI/2;
        for(let i=0;i<12;i++){
            const a=i/12*TAU,bolt=c.cylinder(.032,.032,.15,c.brass,shell,v(Math.cos(a)*1.445,Math.sin(a)*1.445,.04),8);bolt.rotation.x=Math.PI/2;
        }
    }
    mesh(new T.CircleGeometry(1.3,64),patina,back,v(0,0,-.04));
    for(const angle of [Math.PI*.25,Math.PI*.75,Math.PI*1.25,Math.PI*1.75]){
        const x=Math.cos(angle)*1.46,y=Math.sin(angle)*1.46;
        const rail=c.cylinder(.027,.027,3.55,c.iron,main,v(x,y,-.02));rail.rotation.x=Math.PI/2;
        for(const z of [-1.78,1.75]){const stop=c.cylinder(.06,.06,.075,c.brass,main,v(x,y,z));stop.rotation.x=Math.PI/2;}
    }
    // Two yokes carry the body and its sliding cases above the uninterrupted floor.
    for(const z of [-.65,.7]){
        for(const x of [-1.08,1.08]){
            c.beam(v(x,-2.38,z),v(x,-1.08,z),.13,.16,c.stone,main);
            box(.45,.11,.38,c.iron,main,v(x,-2.325,z));
            c.beam(v(x,-1.55,z),v(x*.73,-1.1,z),.075,.08,c.brass,main);
        }
        c.beam(v(-1.08,-1.45,z),v(1.08,-1.45,z),.12,.15,c.iron,main);
    }

    // A source vessel, a turbine and a distribution manifold form one connected path.
    const source=group(works);source.position.set(-3.5,.15,-.2);source.name='source-reservoir';
    const vessel=mesh(new T.CylinderGeometry(.46,.46,1.8,64,1,true),glass,source,v(0,.22));
    const sourceWater=c.cylinder(.425,.425,1.68,water,source,v(0,.22),64);
    for(const y of [-.69,1.13]){
        c.cylinder(.49,.49,.08,c.copper,source,v(0,y),64);
        const band=w.ring(.47,.025,c.brass,source);band.rotation.x=Math.PI/2;band.position.y=y;
    }
    for(const x of [-.32,.32])for(const z of [-.32,.32]){
        c.beam(v(x,-2.33,z),v(x,-.72,z),.065,.075,c.iron,source);
        c.beam(v(x,-.7,z),v(x,1.14,z),.028,.028,c.brass,source);
    }
    vessel.name='teal-glass-reservoir';
    const routes=[];
    function conduit(points,parent=works){
        const curve=new T.CatmullRomCurve3(points,false,'centripetal');
        const outer=mesh(new T.TubeGeometry(curve,72,.135,12,false),glass,parent);
        const inner=mesh(new T.TubeGeometry(curve,72,.091,10,false),water,parent);inner.geometry.setDrawRange(0,0);
        // The glass channels are held by machined flange pairs at their actual ends.
        for(const end of [0,1]){
            const center=curve.getPoint(end),direction=curve.getTangent(end);
            const flange=c.cylinder(.195,.195,.065,c.copper,parent,center);flange.quaternion.setFromUnitVectors(v(0,1,0),direction);
            const liner=c.cylinder(.138,.138,.079,patina,parent,center);liner.quaternion.copy(flange.quaternion);
        }
        routes.push(inner);return {outer,inner,curve};
    }
    conduit([v(-3.5,-.57,-.2),v(-3.5,-.94,-.2),v(-2.95,-.94,-.2),v(-2.68,-.45,-.05),v(-2.55,.2,0)]);
    conduit([v(.25,.2,0),v(.5,.2,0)]);
    conduit([v(1.32,.2,0),v(2.15,.2,0),v(2.6,-.15,0),v(2.6,-.59,.2),v(2.95,-.59,.2)]);

    // This keyed section is visibly missing until the third beat. It is carried by
    // a single linear guide, then turns and seats between the two open flanges.
    const key=group(works);key.name='missing-valve-connection';
    const valve=c.cylinder(.14,.14,.82,patina,key,v(),48);valve.rotation.z=Math.PI/2;
    for(const x of [-.41,.41]){const flange=c.cylinder(.2,.2,.07,c.brass,key,v(x),48);flange.rotation.z=Math.PI/2;}
    c.cylinder(.16,.16,.23,c.copper,key,v(0,.14));
    const valveWheel=group(key);valveWheel.position.set(0,.32,0);valveWheel.rotation.x=-Math.PI/2;
    w.ring(.21,.026,c.brass,valveWheel);
    for(let i=0;i<3;i++){const spoke=box(.4,.025,.025,c.brass,valveWheel);spoke.rotation.z=i*Math.PI/3;}
    const valveWater=c.cylinder(.09,.09,.84,water,key);valveWater.rotation.z=Math.PI/2;valveWater.visible=false;
    const carriage=group(works);carriage.position.set(.91,2.42,-.41);
    c.beam(v(-.25,0),v(.25,0),.15,.13,c.iron,carriage);
    for(const x of [.53,1.29]){
        c.beam(v(x,-2.18,-.48),v(x,2.48,-.48),.058,.08,c.iron,works);
        box(.24,.08,.28,c.copper,works,v(x,-2.14,-.48));
    }
    const elevator=group(works);elevator.name='valve-guide-carriage';
    box(1.04,.09,.12,c.copper,elevator,v(0,0,-.43));
    c.beam(v(0,0,-.43),v(0,0,-.16),.055,.055,c.brass,elevator);
    const grip=c.cylinder(.17,.17,.075,c.iron,elevator,v(0,0,-.14));grip.rotation.x=Math.PI/2;
    const stem=c.cylinder(.018,.018,1,c.brass,works);
    // Small pressure dial moves only after the circuit can actually carry water.
    const gauge=group(works);gauge.position.set(1.88,.64,0);
    c.beam(v(1.88,.2,0),v(1.88,.58,0),.055,.055,c.copper,works);
    const dial=c.cylinder(.23,.23,.065,c.copper,gauge);dial.rotation.x=Math.PI/2;
    mesh(new T.CircleGeometry(.205,48),c.paper,gauge,v(0,0,.04));
    for(let i=0;i<15;i++){const a=-2.35+i/14*4.7,mark=box(.008,.025,.005,c.iron,gauge,v(Math.sin(a)*.165,Math.cos(a)*.165,.046));mark.rotation.z=-a;}
    const needle=group(gauge);needle.position.z=.055;box(.011,.16,.008,c.iron,needle,v(0,.058));

    const beds=[];
    const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.13,.07,-.12,.25,0,.35);leafShape.bezierCurveTo(.12,.25,.13,.07,0,0);
    const leafGeometry=new T.ShapeGeometry(leafShape,18);
    for(let i=0;i<4;i++){
        const terrace=group(works);terrace.name=`irrigated-terrace-${i}`;terrace.position.set(3.55,-.68-i*.34,.2+i*.68);
        const bed=group(terrace);bed.rotation.x=-1.3;
        box(1.85,.095,.71,c.stone,bed,v(0,-.02,.36));
        box(1.71,.02,.59,fertile,bed,v(0,.042,.36));
        for(const x of [-.9,.9])box(.035,.09,.72,c.brass,bed,v(x,.04,.36));
        box(1.81,.09,.035,c.brass,bed,v(0,.04,.71));
        const hinge=c.cylinder(.055,.055,2.04,c.copper,terrace,v());hinge.rotation.z=Math.PI/2;
        for(const x of [-.75,.75]){
            c.beam(v(x,0,0),v(x,-1.5+i*.34,0),.07,.07,c.iron,terrace);
            const brace=c.beam(v(x,-.32,0),v(x,-.01,.58),.035,.035,c.brass,bed);brace.name='terrace-cantilever';
        }
        const wet=box(1.63,.008,.055,water,bed,v(0,.062,.22));
        const sprouts=group(bed);
        for(let j=0;j<5;j++){
            const stalk=group(sprouts);stalk.position.set((j-2)*.3,.06,.42+(j%2)*.11);
            c.beam(v(),v(0,.19,0),.012,.012,c.green,stalk);
            for(const side of [-1,1]){const leaf=mesh(leafGeometry,side<0?c.green:c.greenLight,stalk,v(0,.08,0));leaf.rotation.set(-.3,side*.7,-side*.7);leaf.scale.setScalar(.75+(j%3)*.1);}
        }
        beds.push({terrace,bed,sprouts,wet});
        if(i){
            // Short descending feeds stay attached to consecutive hinge manifolds.
            conduit([v(2.77,-.68-(i-1)*.34,.2+(i-1)*.68),v(2.77,-.68-i*.34,.2+i*.68)],works);
        }
    }
    // The first bed receives the distribution line; each hinge carries the next.
    conduit([v(2.95,-.59,.2),v(2.77,-.68,.2)],works);
    for(const bed of beds){
        const branch=c.cylinder(.042,.042,1.65,c.copper,bed.terrace,v(0,.01,0));branch.rotation.z=Math.PI/2;
    }
    const subjectGroups=[front,back,rotor,key,elevator,sourceWater,...beds.map(x=>x.bed),...beds.map(x=>x.sprouts)];
    w.kineticSubjects=subjectGroups;
    w.motions.push(p=>{
        const explode=range(p,.02,.29)*(1-range(p,.58,.75));
        front.position.z=.43+explode*1.12;back.position.z=-.43-explode*.91;
        const align=range(p,.36,.56),seat=range(p,.55,.71),flow=range(p,.72,.97);
        key.position.set(.91,2.03-seat*1.83,0);key.rotation.z=(1-align)*Math.PI/2;
        elevator.position.set(.91,key.position.y,0);
        // The guide clamps to the central valve stem; a telescopic ram joins it to the crosshead.
        stem.position.set(.91,(2.42+key.position.y)/2,-.43);stem.scale.y=Math.max(.025,2.42-key.position.y);
        valveWheel.rotation.z=range(p,.69,.79)*Math.PI*.75;
        rotor.rotation.z=-range(p,.76,1)*Math.PI*7;
        sourceWater.scale.y=mix(.98,.72,flow);sourceWater.position.y=.22-(1-sourceWater.scale.y)*.84;
        for(let i=0;i<routes.length;i++){
            const start=i<2?.72:i===2?.79:.84+(i-3)*.017;
            const amount=range(p,start,Math.min(1,start+.11));
            routes[i].geometry.setDrawRange(0,Math.floor(routes[i].geometry.index.count*amount/6)*6);
        }
        valveWater.visible=p>.76;
        beds.forEach(({bed,sprouts,wet},i)=>{
            const unfold=range(p,.77+i*.025,.89+i*.025),growth=range(p,.85+i*.023,.93+i*.023);
            bed.rotation.x=-1.3*(1-unfold);sprouts.scale.setScalar(Math.max(.001,growth));wet.scale.x=Math.max(.001,growth);
        });
        needle.rotation.z=2.2-flow*3.6;
        const phase=p<.3?'cutaway':p<.55?'missing-connection':p<.76?'connect':'irrigate';
        state(w,p,{mechanism:'waterworks',phase,casingSeparation:explode,connection:seat,water:flow,rotorTurns:range(p,.76,1)*3.5,terraces:beds.map(({bed,sprouts})=>({open:1+bed.rotation.x/1.3,growth:sprouts.scale.x}))});
        w.caption={speaker:'WATERWORKS',text:p<.3?'See how the whole operation works.':p<.55?'One missing step holds the current back.':p<.76?'The right connection completes the system.':'Connected work makes room for growth.'};
    });
    return {shots:[
        {p:0,eye:[-.6,.72,4.15],look:[-1.05,.23,.1],fov:39},
        {p:.22,eye:[2.5,2.6,8],look:[-1.1,.3,0],fov:40},
        {p:.36,eye:[4.3,2.9,8.5],look:[.1,.3,0],fov:42},
        {p:.55,eye:[3.3,1.85,4.75],look:[.91,.9,0],fov:40},
        {p:.73,eye:[3.8,1.9,6.1],look:[.5,.2,0],fov:41},
        {p:.88,eye:[6.7,3.5,8.2],look:[2.2,-.5,.6],fov:39},
        {p:1,eye:[7.1,4.9,10.5],look:[.4,-.05,.5],fov:40},
    ]};
}
