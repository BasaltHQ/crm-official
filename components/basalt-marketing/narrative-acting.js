/* Scroll is the director. Actors keep their task and destination when reading pauses.
 * Ambient time may move a pen, breath, or listening gesture; it never moves a person away. */
import { THREE as T } from './three-runtime.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const quat=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z,'YXZ'));
const mix=(a,b,t)=>T.MathUtils.lerp(a,b,t);
const actionWeight=(pose,...actions)=>(actions.includes(pose.a.action)?1-pose.blend:0)+(actions.includes(pose.b.action)?pose.blend:0);
const frame=(p,x,z,yaw,action,focus=[0,.15,.2])=>({p,x,z,yaw,action,focus});

const scripts={
    network:[
        [frame(0,.65,1.75,-2.95,'read'),frame(1/3,.5,1.75,-2.8,'review'),frame(2/3,.4,1.75,-2.8,'write'),frame(.85,.36,1.75,-Math.PI/2,'offer',[-.52,0,1.75]),frame(1,.36,1.75,-Math.PI/2,'explain',[-.52,0,1.75])],
        [frame(0,-1.9,1.85,1.1,'wait',[.65,0,1.75]),frame(1/3,-1.75,1.85,1.1,'observe',[.5,0,1.75]),frame(2/3,-1.1,1.85,1.1,'approach',[.4,0,1.75]),frame(.85,-.52,1.75,Math.PI/2,'receive',[.36,0,1.75]),frame(1,-.52,1.75,Math.PI/2,'read',[-.1,-.12,1.75])],
    ],
    crystal:[[frame(0,-1.65,1.8,2.6,'read'),frame(1/3,-.75,1.7,2.85,'write'),frame(2/3,-.45,1.75,2.9,'inspect',[0,1.4,-.5]),frame(1,-.85,1.72,2.55,'present',[1.45,.1,.4])]],
    constellation:[
        [frame(0,.9,4.25,-.6,'read',[1.6,-.6,1.5]),frame(1/3,.6,3.7,-1.1,'carry',[0,-.8,3.6]),frame(2/3,.15,3.6,-Math.PI/2,'offer',[-.14,-.8,3.6]),frame(1,.15,3.6,-Math.PI/2,'explain',[-.14,-.8,3.6])],
        [frame(0,-.95,3.9,1.2,'wait'),frame(1/3,-.55,3.7,1,'approach',[.15,-.8,3.6]),frame(2/3,-.14,3.6,Math.PI/2,'receive',[.15,-.8,3.6]),frame(1,-.14,3.6,Math.PI/2,'read',[0,-.8,3.6])],
    ],
    modules:[[frame(0,.15,1.9,Math.PI,'read',[-1,-.5,.3]),frame(1/3,-.4,1.85,Math.PI,'inspect',[.5,-.4,.3]),frame(2/3,.55,1.9,Math.PI,'point',[1.85,1.15,-.68]),frame(1,1.35,1.9,-2.9,'read',[2.5,-.35,1.05])]],
    pages:[[frame(0,.9,1.7,Math.PI,'write'),frame(1/3,.5,1.7,Math.PI,'review',[0,.6,-.2]),frame(2/3,1.05,1.7,-2.9,'compare',[1.15,.72,.06]),frame(1,.7,1.75,-2.65,'present',[.35,.83,.1])]],
    wave:[
        [frame(0,-1.35,2.25,1.7,'speak',[1.65,.1,2.75]),frame(1/3,-1.35,2.25,1.7,'explain',[1.65,.1,2.75]),frame(2/3,-1.15,2.2,Math.PI/2,'listen',[1.15,.1,2.2]),frame(1,-1.05,2.2,1.5,'speak',[1.05,.1,2.2])],
        [frame(0,1.65,2.75,-1.8,'listen',[-1.35,.1,2.25]),frame(1/3,1.65,2.75,-1.8,'listen',[-1.35,.1,2.25]),frame(2/3,1.15,2.2,-Math.PI/2,'speak',[-1.15,.1,2.2]),frame(1,1.05,2.2,-1.5,'listen',[-1.05,.1,2.2])],
    ],
    shield:[[frame(0,.05,1.82,Math.PI,'read'),frame(1/3,-.45,1.82,-2.7,'compare',[-.8,.4,-.3]),frame(2/3,.05,1.82,Math.PI,'write'),frame(1,.35,1.82,-2.9,'carry',[.5,.6,-.9])]],
};

export function stage(human,track,p,time,reduced){
    const index=Math.min(track.length-2,Math.max(0,track.findIndex((f,i)=>i<track.length-1&&p<=track[i+1].p)));
    const a=track[index],b=track[index+1],u=T.MathUtils.clamp((p-a.p)/(b.p-a.p),0,1),blend=smooth(u);
    const y=human.g.userData.ground,from=v(a.x,y,a.z),to=v(b.x,y,b.z),length=from.distanceTo(to),walking=length>.002;
    const heading=Math.atan2(to.x-from.x,to.z-from.z);
    let moving=false,turning=false,travel=0,yaw=a.yaw,turnFrom=a.yaw,turnTo=b.yaw,turnProgress=0;
    if(walking){
        if(u<.18){turning=true;turnTo=heading;turnProgress=u/.18;}
        else if(u<.78){moving=true;travel=T.MathUtils.clamp(smooth((u-.18)/.6),0,1);yaw=heading;}
        else{travel=1;turning=true;turnFrom=heading;turnProgress=(u-.78)/.22;}
    }else{turning=Math.abs(delta(a.yaw,b.yaw))>.03;turnProgress=u;travel=blend;}
    const routeStart=travel===1?to:from,routeEnd=to;
    if(!walking)yaw=a.yaw+delta(a.yaw,b.yaw)*blend;
    const action=u<.5?a.action:b.action;
    human.act({routeStart,routeEnd,travel,moving,turning:turning&&u>0&&u<1,turnFrom,turnTo,turnProgress,yaw:u===1?b.yaw:yaw,lookAt:v(...a.focus).lerp(v(...b.focus),blend),activity:moving?`to-${b.action}`:action,segment:index},time,reduced);
    human.g.userData.action=action;
    return {a,b,blend,action,index};
}

function localHand(human,index,position,rotation,curl=.35,point=false){
    human.g.updateMatrixWorld(true);
    const world=human.g.localToWorld(position.clone()),orientation=human.g.getWorldQuaternion(new T.Quaternion()).multiply(rotation);
    human.handTo(index,world,orientation,curl,point);
}

export function directNarrative(w,c,kind){
    const actors=w.people,tracks=scripts[kind];
    actors.forEach(h=>{h.g.userData.ground=h.g.position.y;});
    const titles={network:'The next conversation',crystal:'Your editorial direction',constellation:'A shared plan',modules:'The next shift',pages:'A story for your audience',shield:'The reviewed matter'};
    const handoff=kind==='network'||kind==='constellation';
    let document=null;
    if(kind!=='wave'){
        document=w.group();document.name='carried-work';
        const page=c.folio(titles[kind],'CONTEXT / REVIEW / CONTINUITY',document,.35,.42);page.rotation.x=Math.PI/2;page.scale.y=.18;
        const face=page.children.find(o=>o.isMesh&&o.material.map);
        if(face){const reverse=new T.Mesh(face.geometry.clone(),face.material);reverse.rotation.x=Math.PI/2;reverse.position.y=-.064;page.add(reverse);}
        document.traverse(o=>{if(o.isMesh)o.userData.heldProp=true;});
    }
    const pen=kind==='wave'?null:w.group(actors[0].joints[1].hand);
    if(pen){c.cylinder(.006,.009,.17,c.brass,pen,v(0,-.075),8);pen.position.set(.015,-.083,.018);pen.rotation.set(.48,0,.1);pen.traverse(o=>{if(o.isMesh)o.userData.heldProp=true;});}
    const rest=(h,i)=>h.g.localToWorld(v(i?.235:-.235,.93,.045));
    function carried(h,offset=v(0,1.25,.3)){
        h.g.updateMatrixWorld(true);return{position:h.g.localToWorld(offset),rotation:h.g.getWorldQuaternion(new T.Quaternion()).multiply(quat(-.1)),scale:h.g.scale.x};
    }
    function wristPoint(prop,side){return prop.localToWorld(v(side*.235,.025,.01));}
    function hold(h,hand,side,curl=.58,weight=1){
        const target=wristPoint(document,side);
        if(weight<1)target.lerp(rest(h,hand),1-weight);
        const gripOrientation=document.getWorldQuaternion(new T.Quaternion()).multiply(quat(0,-side*Math.PI/2));
        const orientation=h.g.getWorldQuaternion(new T.Quaternion()).multiply(quat(0,(hand?-1:1)*Math.PI/2)).slerp(gripOrientation,weight);
        h.handTo(hand,target,orientation,mix(.28,curl,weight));
    }
    function workingHand(h,pose,time,lower=0){
        const writing=actionWeight(pose,'write'),pointing=actionWeight(pose,'point','inspect');
        const target=wristPoint(document,1),orientation=document.getWorldQuaternion(new T.Quaternion()).multiply(quat(0,-Math.PI/2));
        const stroke=w.reduced?0:Math.sin(time*1.8)*.018;
        const writingWrist=h.g.getWorldQuaternion(new T.Quaternion()).multiply(quat(.42,-.2,-.4));
        // Solve from the nib on the page back to the wrist, so writing cannot hover beside it.
        const nib=document.localToWorld(v(.015+stroke,-.035,-.017));
        const penOffset=v(0,-.16,0).applyQuaternion(pen.quaternion).add(pen.position).multiplyScalar(h.g.scale.x).applyQuaternion(writingWrist);
        const writingTarget=nib.clone().sub(penOffset);
        const pointingTarget=h.g.localToWorld(v(.24,1.35,.34));
        const active=Math.max(writing,pointing);
        target.lerp(writingTarget,writing).lerp(pointingTarget,pointing).lerp(rest(h,1),lower);
        orientation.slerp(writingWrist,writing).slerp(h.g.getWorldQuaternion(new T.Quaternion()).multiply(quat(-.45,-.15,-.25)),pointing);
        orientation.slerp(h.g.getWorldQuaternion(new T.Quaternion()).multiply(quat(0,-Math.PI/2)),lower);
        h.handTo(1,target,orientation,mix(mix(.58,mix(.62,.42,pointing),active),.28,lower),pointing*(1-lower));
        if(writing>.999&&lower===0){w.workContact={point:nib,pen};}
    }
    w.motions.push((p,t)=>{
        const time=w.reduced?0:t;
        const poses=actors.map((h,i)=>stage(h,tracks[i],p,time,w.reduced));
        w.workContact=null;
        w.root.updateMatrixWorld(true);
        if(document){
            const source=actors[0],sourcePose=poses[0],normal=carried(source),write=actionWeight(sourcePose,'write');
            if(handoff){
                const receiver=actors[1],small=kind==='constellation',reachStart=small?.53:.72,sharedAt=small?.69:.86,releaseAt=small?.79:.91;
                const offer=smooth((p-reachStart)/(sharedAt-reachStart)),transfer=smooth((p-releaseAt)/(1-releaseAt));
                const receive=carried(receiver),shared=source.g.position.clone().lerp(receiver.g.position,.5);
                shared.y=source.g.position.y+source.g.scale.x*1.22;
                const presenting=normal.position.clone().lerp(shared,offer);
                document.position.copy(presenting).lerp(receive.position,transfer);
                document.quaternion.copy(normal.rotation);
                document.scale.setScalar(mix(normal.scale,receive.scale,transfer));document.updateMatrixWorld(true);
                const recipientGrip=smooth((p-(sharedAt-.04))/.06),senderGrip=1-smooth((p-releaseAt)/.045);
                hold(source,0,-1,.58,senderGrip);
                workingHand(source,sourcePose,time,smooth((p-(sharedAt-.1))/.08));
                hold(receiver,0,1,.58,recipientGrip);
                // The second hand supports the document after its recipient takes possession.
                hold(receiver,1,-1,.58,transfer);
                w.narrative={task:sourcePose.action,owner:transfer>.55?1:0,handoff:recipientGrip>0&&senderGrip>0,transfer};
            }else{
                const presenting=actionWeight(sourcePose,'present');
                const at=carried(source,v(0,mix(1.25,1.28,presenting),mix(.3,.37,presenting)));
                document.position.copy(at.position);document.quaternion.copy(at.rotation);document.scale.setScalar(at.scale);document.updateMatrixWorld(true);
                hold(source,0,-1);
                workingHand(source,sourcePose,time);
                w.narrative={task:sourcePose.action,owner:0,handoff:false,transfer:0};
            }
            if(pen){const amount=write*(handoff?1-smooth((p-.7)/.06):1);pen.visible=amount>.04;pen.scale.setScalar(Math.max(.001,amount));}
        }else{
            actors.forEach((h,i)=>{
                const speaking=actionWeight(poses[i],'speak','explain');
                const beat=w.reduced?0:(1-Math.cos(time*1.15+i))*.5;
                localHand(h,1,v(.23,.94,.06).lerp(v(.23,1.16+beat*.035,.25),speaking),quat(0,-Math.PI/2).slerp(quat(-.32,-.65,-.2),speaking),mix(.3,.24,speaking));
                localHand(h,0,v(-.23,.94,.06).lerp(v(-.22,1.03,.1),speaking),quat(0,Math.PI/2).slerp(quat(.05,Math.PI/2),speaking),mix(.3,.32,speaking));
                h.head.rotation.x+=w.reduced?0:Math.sin(time*.8+i)*.022*(1-speaking);
            });
            w.narrative={task:poses[0].action,owner:null,handoff:false,transfer:0};
        }
    });
}
