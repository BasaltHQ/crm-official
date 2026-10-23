/* Basalt guild automata. Dimensions are metres; feet define the origin.
 * Ceramic lantern faces, woven workwear and a brass shield form the family silhouette. */
import { THREE as T } from './three-runtime.js';
import {createGuildFace} from './guild-face.js';
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smooth = x => { x=T.MathUtils.clamp(x,0,1);return x*x*x*(x*(x*6-15)+10); };
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const down = v(0,-1,0);

// Rings describe the actual silhouette, rather than stacking spheres and capsules.
function loft(rings, sides = 24, materialBoundary) {
    const points = [], indices = [], groups=[];
    function materialGroup(start,y){
        if(materialBoundary===undefined)return;
        const materialIndex=y>=materialBoundary?1:0,count=indices.length-start,previous=groups[groups.length-1];
        if(previous&&previous.materialIndex===materialIndex&&previous.start+previous.count===start)previous.count+=count;
        else groups.push({start,count,materialIndex});
    }
    // Interpolate the profile as well as the circumference. Clamped tangents keep
    // cuffs and fingertips within their authored dimensions and interaction bounds.
    const profile=[];
    for(let row=0;row<rings.length-1;row++){
        const a=rings[Math.max(0,row-1)],b=rings[row],c=rings[row+1],d=rings[Math.min(rings.length-1,row+2)];
        for(let step=0;step<3;step++){
            const t=step/3,values=[T.MathUtils.lerp(b[0],c[0],t)];
            for(let axis=1;axis<4;axis++){
                const p=a[axis]||0,q=b[axis]||0,r=c[axis]||0,s=d[axis]||0;
                values.push(T.MathUtils.clamp(.5*((2*q)+(-p+r)*t+(2*p-5*q+4*r-s)*t*t+(-p+3*q-3*r+s)*t*t*t),Math.min(q,r),Math.max(q,r)));
            }
            profile.push(values);
        }
    }
    profile.push(rings[rings.length-1]);
    profile.forEach(([y, width, depth, forward = 0], row) => {
        const start=indices.length;
        for (let i = 0; i < sides; i++) {
            const a = i / sides * Math.PI * 2;
            points.push(Math.cos(a) * width, y, Math.sin(a) * depth + forward);
            if (row) { const a = row * sides + i, b = row * sides + (i + 1) % sides, c = a - sides, d = b - sides; indices.push(c, a, b, c, b, d); }
        }
        if(row)materialGroup(start,(profile[row-1][0]+y)/2);
    });
    // Separate cap vertices prevent a radial star of normals on soft surfaces.
    for(const [row,reverse]of [[0,false],[profile.length-1,true]]){
        const start=points.length/3,firstFace=indices.length;
        for(let i=0;i<sides;i++)points.push(...points.slice((row*sides+i)*3,(row*sides+i)*3+3));
        for(let i=1;i<sides-1;i++)indices.push(start,start+(reverse?i+1:i),start+(reverse?i:i+1));
        materialGroup(firstFace,profile[row][0]);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    groups.forEach(({start,count,materialIndex})=>geometry.addGroup(start,count,materialIndex));return geometry;
}

export function createFigure(w, parent, position, size = 1, variation = 0) {
    const { group, mesh } = w, g = group(parent); g.position.copy(position); g.scale.setScalar(size);
    g.name = 'basalt-guild-figure'; g.userData.height = 1.82; g.userData.headHeight = .2575;
    g.userData.identity='Basalt guild automaton / ceramic shield / lantern eyes / woven coat / faultline seam';
    const tone = new T.Color(['#355a61','#a4763d','#53684b','#67596e'][variation%4]).lerp(w.accent, .045);
    const cloth = new T.MeshPhysicalMaterial({ color: tone, roughness: .86, sheen: .28, sheenColor:'#d6c9ae', sheenRoughness:.8 });
    // Soft work gloves make the articulated hands an intentional crafted surface.
    const face = new T.MeshStandardMaterial({ color: ['#8e6a42','#87725a','#99784e','#8b7055'][variation%4], roughness: .82 });
    const trousers = new T.MeshStandardMaterial({ color: '#303b3b', roughness: .94 });
    const shoes = new T.MeshStandardMaterial({ color: '#47372a', roughness: .68 });
    const yoke = new T.MeshStandardMaterial({color:'#263b3b',roughness:.84});
    const brass = new T.MeshStandardMaterial({color:'#c8a56b',metalness:.68,roughness:.36});
    const trim = new T.MeshStandardMaterial({color:w.accent.clone().lerp(new T.Color('#d7be8b'),.56),roughness:.78});
    for(const material of [cloth,trousers,yoke])material.userData.basaltFinish='cloth';
    brass.userData.basaltFinish='metal';
    const parts = [];
    function body(geometry, material, parent, name, position = v()) {
        const m = mesh(geometry, material, parent, position); m.name = name; m.userData.figure = true;
        parts.push(m); return m;
    }
    function oval(parent,name,material,position,scale){const m=body(new T.SphereGeometry(1,20,12),material,parent,name,position);m.scale.copy(scale);return m;}
    function seam(parent,name,material,points,radius=.002){return body(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,radius,6,false),material,parent,name);}
    const torso = group(g); torso.position.y=1;
    // Both fabrics share vertices and normals. A second closed yoke shell would
    // intersect the jacket and leave coincident shoulder caps during animation.
    const jacket=loft([[.919,.168,.111],[.947,.17,.112],[1.04,.158,.105],[1.13,.148,.099],[1.26,.16,.108],[1.365,.187,.114],[1.4,.195,.115],[1.475,.218,.09],[1.505,.11,.065]],24,1.365);
    const jacketPoints=jacket.getAttribute('position');
    for(let i=0;i<jacketPoints.count;i++){
        const y=jacketPoints.getY(i),drop=.037*(1-Math.abs(jacketPoints.getX(i))/.223)*Math.max(0,1-Math.abs(y-1.365)/.1);
        jacketPoints.setY(i,y-drop);
    }
    jacket.computeVertexNormals();body(jacket,[cloth,yoke],torso,'chest',v(0,-1));
    body(loft([[1.495,.077,.061],[1.519,.073,.058],[1.538,.066,.054],[1.553,.059,.051]]),trim,torso,'woven-collar',v(0,-1));
    seam(torso,'collar-fold',cloth,[v(-.059,.53,.035),v(-.032,.519,.056),v(.012,.515,.062),v(.049,.525,.048)],.003);
    seam(torso,'faultline-placket',trim,[v(-.046,.48,.095),v(-.029,.365,.126),v(.026,.235,.111),v(.035,.025,.108),v(.035,-.07,.111)],.0026);
    const thread=new T.MeshStandardMaterial({color:'#c6b590',roughness:1});
    const stitchLine=new T.CatmullRomCurve3([v(-.052,.475,.096),v(-.037,.365,.126),v(.018,.235,.112),v(.027,.025,.11),v(.027,-.065,.112)]);
    const stitchGeometry=new T.CylinderGeometry(.0007,.0007,.004,5).toNonIndexed(),stitchVertices=[],stitchNormals=[];
    const stitchRotation=new T.Quaternion().setFromUnitVectors(v(0,1,0),v(1,.3,0).normalize());
    for(let i=0;i<28;i++){
        const at=stitchLine.getPoint(i/27),positions=stitchGeometry.getAttribute('position'),normals=stitchGeometry.getAttribute('normal');
        for(let j=0;j<positions.count;j++){
            stitchVertices.push(...v().fromBufferAttribute(positions,j).applyQuaternion(stitchRotation).add(at).toArray());
            stitchNormals.push(...v().fromBufferAttribute(normals,j).applyQuaternion(stitchRotation).toArray());
        }
    }
    const stitches=new T.BufferGeometry();stitches.setAttribute('position',new T.Float32BufferAttribute(stitchVertices,3));stitches.setAttribute('normal',new T.Float32BufferAttribute(stitchNormals,3));stitchGeometry.dispose();
    body(stitches,thread,torso,'coat-stitching');
    body(loft([[.919,.170,.113],[.926,.1705,.1135]]),yoke,torso,'jacket-hem',v(0,-1));
    const shield=new T.Shape();shield.moveTo(-.022,.027);shield.lineTo(.022,.027);shield.lineTo(.021,-.005);shield.quadraticCurveTo(.015,-.021,0,-.032);shield.quadraticCurveTo(-.015,-.021,-.021,-.005);shield.closePath();
    const clasp=body(new T.ExtrudeGeometry(shield,{depth:.004,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.0015,bevelThickness:.0015,curveSegments:8}),brass,torso,'basalt-clasp',v(-.077,.402,.119));
    // Three offset strata echo cut basalt and a growing leaf, without a lettermark.
    for(let i=0;i<3;i++)seam(clasp,'clasp-stratum',yoke,[v(-.011,.014-i*.011,.006),v(.001,.014-i*.011,.006),v(.011,.021-i*.011,.006)],.0015);
    const pelvis=group(g);pelvis.position.y=.93;
    body(loft([[.865,.122,.081],[.93,.155,.095],[1.015,.145,.09]]), trousers, pelvis, 'pelvis',v(0,-.93));
    body(new T.CylinderGeometry(.033,.037,.075,24),yoke,torso,'neck-bearing',v(0,.547));
    for(const y of [.536,.554,.573]){
        const bearing=body(new T.TorusGeometry(.036,.0025,8,32),brass,torso,'neck-bearing-rim',v(0,y));bearing.rotation.x=Math.PI/2;
    }
    const head = group(torso); head.position.y = .564; head.scale.setScalar(1.12);
    const faceRig=createGuildFace({group,body,seam,head,variation,face});

    const arms = [], joints = [], legs=[];
    for (const side of [-1, 1]) {
        const arm = group(torso); arm.position.set(side * .212, .46, 0); arm.rotation.z = side * .07;
        const sleeve=loft([[-.308,.016,.017],[-.288,.033,.033],[-.225,.043,.046],[-.115,.062,.06],[-.065,.066,.065],[-.035,.068,.067],[.007,.051,.047],[.026,.018,.017],[.035,.001,.001]],24,-.065);
        const sleevePoints=sleeve.getAttribute('position');
        for(let i=0;i<sleevePoints.count;i++){
            const inset=.055*smooth((sleevePoints.getY(i)+.035)/.07);
            sleevePoints.setX(i,sleevePoints.getX(i)-side*inset);
        }
        sleeve.computeVertexNormals();body(sleeve,[cloth,yoke],arm,'upper-arm');
        const elbow = group(arm); elbow.position.y = -.29;
        body(loft([[-.26,.027,.022],[-.2,.037,.031],[-.1,.046,.041],[-.01,.035,.035],[.018,.027,.027],[.03,.009,.009]]), cloth, elbow, 'forearm');
        body(loft([[-.265,.028,.025],[-.243,.031,.027],[-.229,.033,.029]]),yoke,elbow,'guild-cuff');
        body(loft([[-.249,.032,.028],[-.242,.032,.028]]),trim,elbow,'product-cuff');
        const hand = group(elbow); hand.position.set(0,-.269,0); hand.rotation.x = -.04;
        body(loft([[-.094,.031,.015,-.002],[-.072,.037,.018,0],[-.025,.035,.019,0],[0,.024,.021,0],[.018,.022,.019,0],[.032,.018,.016,0]],20), face, hand, 'palm');
        const fingers=[];
        for (let f = 0; f < 4; f++) {
            const anatomy=side<0?f:3-f;
            const length = [.062,.072,.067,.052][anatomy], finger = group(hand); finger.position.set((f-1.5)*.016,-.087,0);
            const middle=group(finger),tip=group(middle);middle.position.y=-length*.48;tip.position.y=-length*.3;
            for(const [joint,partLength,radius]of [[finger,length*.48,.008],[middle,length*.3,.007],[tip,length*.22,.006]])body(loft([[-partLength,radius*.6,radius*.64],[-partLength*.74,radius*.91,radius*.94],[-partLength*.18,radius,radius],[.001,radius*.91,radius*.91]],12),face,joint,'finger');
            oval(middle,'finger-knuckle',face,v(),v(.0067,.0063,.0067));oval(tip,'finger-knuckle',face,v(),v(.0056,.0052,.0056));
            const pad=group(tip);pad.position.set(0,-length*.22*.8,.0045);
            fingers.push({finger,middle,tip,pad,length,anatomy});
        }
        // The thumb opposes from its metacarpal, rather than bending out of the
        // palm as another finger. Its base lies inside the thenar pad at rest.
        const thumbBase=group(hand);thumbBase.position.set(side*.025,-.036,.004);thumbBase.rotation.z=side*.55;
        body(loft([[-.032,.011,.01],[-.024,.014,.011],[-.011,.014,.011],[0,.008,.006],[.005,.002,.002]],16),face,thumbBase,'thumb-metacarpal');
        const thumb = group(thumbBase); thumb.position.y=-.032; thumb.rotation.z = -side*.23;
        const thumbTip=group(thumb);thumbTip.position.y=-.03;
        body(loft([[-.03,.009,.009],[-.008,.012,.011],[0,.012,.01]],12),face,thumb,'thumb');
        body(loft([[-.024,.004,.004],[-.018,.0075,.0075],[0,.009,.009]],12),face,thumbTip,'thumb');
        const thumbPad=group(thumbTip);thumbPad.position.set(0,-.024*.8,.0045);
        const leg = group(g); leg.position.set(side*.095,.9,0);
        body(loft([[-.472,.021,.022],[-.445,.044,.044],[-.36,.057,.06],[-.17,.078,.079],[-.03,.086,.085],[.015,.068,.069]]),trousers,leg,'thigh');
        const knee = group(leg); knee.position.y = -.45;
        body(loft([[-.43,.028,.034],[-.31,.036,.042],[-.15,.049,.052],[-.045,.044,.044],[0,.042,.042],[.02,.03,.031],[.032,.009,.01]]),trousers,knee,'calf');
        const ankle=group(knee);ankle.position.y=-.43;
        const foot=body(loft([[-.02,.048,.111,.043],[.012,.049,.11,.043],[.034,.045,.097,.035],[.064,.035,.061,.012],[.09,.029,.037,0]],24),shoes,ankle,'foot',v(0,-.02));
        arms.push(arm); joints.push({ side,arm,elbow,hand,fingers,thumbBase,thumb,thumbTip,thumbPad }); legs.push({side,leg,knee,ankle,foot});
    }
    const axis=v(),pole=v(),kneePoint=v(),lower=v(),inverse=new T.Quaternion(),footRotation=new T.Quaternion();
    function solveLeg(rig, target, yaw, pitch, hipShift, bob) {
        const {side,leg,knee,ankle}=rig;
        leg.position.set(side*.095+hipShift,.918+bob,0);
        axis.copy(target).sub(leg.position);const distance=T.MathUtils.clamp(axis.length(),.1,.879);axis.normalize();
        const along=(.45*.45-.43*.43+distance*distance)/(2*distance);
        pole.set(0,0,1).addScaledVector(axis,-axis.z).normalize();
        kneePoint.copy(leg.position).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,.45*.45-along*along)));
        leg.quaternion.setFromUnitVectors(down,kneePoint.clone().sub(leg.position).normalize());
        inverse.copy(leg.quaternion).invert();lower.copy(target).sub(kneePoint).normalize().applyQuaternion(inverse);
        knee.quaternion.setFromUnitVectors(down,lower);
        inverse.copy(leg.quaternion).multiply(knee.quaternion).invert();
        footRotation.setFromEuler(new T.Euler(pitch,yaw,0,'YXZ'));ankle.quaternion.copy(inverse).multiply(footRotation);
    }
    // A three-joint chain with a rounded fingertip pad. The middle and distal
    // flexions have a human ratio; the base supplies spread and opposition.
    // The supplied pole is the direction of flexion, in world space.
    function digitTo(hand, base, middle, tip, pad, lengths, worldTarget, worldPole, weight) {
        const target=hand.worldToLocal(worldTarget.clone()).sub(base.position),d=target.length(),direction=target.clone().normalize();
        const bend=worldPole?worldPole.clone().applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).invert()):v(0,0,1);
        bend.addScaledVector(direction,-bend.dot(direction));
        if(bend.lengthSq()<1e-8){bend.set(0,0,1).addScaledVector(direction,-direction.z);if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(direction,-direction.x);}
        bend.normalize();
        const [a,b]=lengths,c=-pad.position.y,z=pad.position.z,ratio=.65;
        const resultant=angle=>{
            const terminal=angle*(1+ratio);
            return {along:a+b*Math.cos(angle)+c*Math.cos(terminal)-z*Math.sin(terminal),across:b*Math.sin(angle)+c*Math.sin(terminal)+z*Math.cos(terminal)};
        };
        const magnitude=angle=>{const r=resultant(angle);return Math.hypot(r.along,r.across);};
        let low=0,high=2.25;
        for(let i=0;i<24;i++){const mid=(low+high)/2;if(magnitude(mid)>d)low=mid;else high=mid;}
        const flex=(low+high)/2,result=resultant(flex),roll=Math.atan2(result.across,result.along);
        const forward=direction.clone().multiplyScalar(Math.cos(roll)).addScaledVector(bend,-Math.sin(roll));
        const normal=direction.clone().multiplyScalar(Math.sin(roll)).addScaledVector(bend,Math.cos(roll));
        const localY=forward.clone().negate(),localX=localY.clone().cross(normal).normalize();
        const desired=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(localX,localY,normal));
        base.quaternion.slerp(desired,weight);
        middle.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(-flex,0,0)),weight);
        tip.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(-flex*ratio,0,0)),weight);
        return Math.abs(magnitude(flex)-d);
    }
    const human = { g, arms, torso, head, faceRig, parts, legs, joints, stance:[], handTargets:[], digitContacts:[], restHands:[], activity:'working',
        grip(index,curl=.28,point=false){
            const joint=joints[index];
            joint.fingers.forEach(({finger,middle,tip,anatomy},i)=>{
                const amount=anatomy===0?T.MathUtils.lerp(curl,.08,Number(point)):curl+(anatomy===3?.06:0);
                // A resting hand has a small finger fan, closing as it takes a load.
                finger.rotation.set(-amount*.9,0,(i-1.5)*.018*(1-T.MathUtils.clamp(curl,0,1)));
                middle.rotation.set(-amount*1.05,0,0);tip.rotation.set(-amount*.65,0,0);
            });
            joint.thumbBase.rotation.set(0,0,joint.side*.55);
            joint.thumb.rotation.set(-.2-curl*.35,joint.side*curl*.45,joint.side*(-.23-curl*.16));
            joint.thumbTip.rotation.set(-.2-curl*.6,0,0);
        },
        pinchFolio(index,{fingerTargets,thumbTarget,fingerPole,thumbPole,weight=1}){
            const joint=joints[index],contacts=[];weight=T.MathUtils.clamp(weight,0,1);g.updateMatrixWorld(true);
            const register=(kind,digit,pad,target,reachError)=>{
                g.updateMatrixWorld(true);const actual=pad.getWorldPosition(v());
                const contact={hand:index,kind,digit,weight,pad:actual.toArray(),target:target.toArray(),error:actual.distanceTo(target),reachError};
                contacts.push(contact);human.digitContacts.push(contact);
            };
            joint.fingers.forEach(({finger,middle,tip,pad,length},digit)=>{
                const target=fingerTargets?.[digit];if(!target)return;
                const reachError=digitTo(joint.hand,finger,middle,tip,pad,[length*.48,length*.3],target,fingerPole,weight);
                register('finger',digit,pad,target,reachError);
            });
            if(thumbTarget){
                const reachError=digitTo(joint.hand,joint.thumbBase,joint.thumb,joint.thumbTip,joint.thumbPad,[.032,.03],thumbTarget,thumbPole,weight);
                register('thumb',0,joint.thumbPad,thumbTarget,reachError);
            }
            return contacts;
        },
        handTo(index,worldTarget,worldOrientation,curl=.5,point=false){
            const joint=joints[index],{arm,elbow,hand,side}=joint;
            g.updateMatrixWorld(true);
            const target=torso.worldToLocal(worldTarget.clone()),direction=target.clone().sub(arm.position);
            const originalDistance=direction.length(),distance=T.MathUtils.clamp(originalDistance,.09,.557);direction.normalize();
            const along=(.29*.29-.269*.269+distance*distance)/(2*distance);
            const bend=v(side*.4,-.85,-.4);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
            const elbowPoint=arm.position.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,.29*.29-along*along)));
            arm.quaternion.setFromUnitVectors(down,elbowPoint.clone().sub(arm.position).normalize());
            const inverseArm=arm.quaternion.clone().invert();
            elbow.quaternion.setFromUnitVectors(down,target.clone().sub(elbowPoint).normalize().applyQuaternion(inverseArm));
            g.updateMatrixWorld(true);
            hand.quaternion.copy(elbow.getWorldQuaternion(new T.Quaternion()).invert()).multiply(worldOrientation);
            human.grip(index,curl,point);g.updateMatrixWorld(true);
            human.handTargets.push({hand:index,error:hand.getWorldPosition(v()).distanceTo(worldTarget),target:worldTarget.toArray(),curl});
        },
        act(cue,time,reduced=false) {
            const {routeStart,routeEnd,moving,turning,turnFrom,turnTo,lookAt,activity,segment}=cue;
            const travel=T.MathUtils.clamp(cue.travel,0,1),turnProgress=T.MathUtils.clamp(cue.turnProgress||0,0,1);
            let yaw=cue.yaw;const length=routeStart.distanceTo(routeEnd);human.activity=activity;human.handTargets=[];human.digitContacts=[];
            if(turning)yaw=turnFrom+angleDelta(turnFrom,turnTo)*smooth(turnProgress);
            g.position.copy(routeStart).lerp(routeEnd,travel);g.rotation.y=yaw;
            // A short adjustment is two small steps; a crossing uses a human stride.
            // The same contact pose is evaluated in either scroll direction.
            const steps=Math.max(2,Math.ceil(length/(.27*size))),stepFloat=travel*steps;
            const step=Math.min(steps-1,Math.floor(stepFloat)),phase=Math.min(1,stepFloat-step),stridePhase=stepFloat*Math.PI;
            const strideScale=Math.min(1,length/(.5*size)),turnAngle=angleDelta(turnFrom||0,turnTo||0);
            const turnSteps=Math.max(2,Math.ceil(Math.abs(turnAngle)/(.44*Math.PI)));
            const tq=Math.min(turnSteps-1e-9,turnProgress*turnSteps),turnStep=Math.floor(tq),turnPhase=tq-turnStep;
            const speed=moving?Math.sqrt(Math.max(0,Math.sin(Math.PI*travel)))*strideScale:0;
            const turnWeight=turning?Math.sin(Math.PI*turnProgress)*Math.min(1,Math.abs(turnAngle)/.65):0;
            const supportPhase=moving?phase:turnPhase,supportSide=((moving?step:turnStep)%2===0?1:-1);
            const hipShift=supportSide*Math.sin(Math.PI*supportPhase)**2*.026*Math.max(speed,turnWeight);
            const feet=legs.map((rig,i)=>{
                let footPoint=g.position.clone(), footYaw=yaw, lift=0, pitch=0, planted=true, contact=`rest:${human.activity}`;
                const lateral=rig.side*.095*size;
                if(moving){
                    const swing=step%2===i;
                    contact=swing?'swing':`${segment}:${step-1}`;
                    const startDistance=step<2?0:step/steps, endDistance=Math.min(1,(step+2)/steps), stanceDistance=step===0?0:Math.min(1,(step+1)/steps);
                    // Double support at either end gives the weight time to change feet.
                    const airborne=T.MathUtils.clamp((phase-.1)/.78,0,1);
                    const distance=swing?T.MathUtils.lerp(startDistance,endDistance,smooth(airborne)):stanceDistance;
                    footPoint.copy(routeStart).lerp(routeEnd,distance);
                    if(swing){
                        lift=Math.sin(Math.PI*airborne)**2*.065*strideScale;
                        // Toe push-off, then a heel-first landing and a quiet sole settle.
                        pitch=(.23*Math.sin(Math.PI*T.MathUtils.clamp((phase-.02)/.34,0,1))-.16*Math.sin(Math.PI*T.MathUtils.clamp((phase-.60)/.38,0,1)))*strideScale;
                        planted=airborne===0||airborne===1;
                    }
                }else if(turning){
                    const n=turnSteps,j=turnStep,f=turnPhase,swing=j%2===i;
                    const airborne=T.MathUtils.clamp((f-.1)/.78,0,1);
                    contact=swing?'swing':`turn:${segment}:${turnFrom.toFixed(3)}:${j-1}`;
                    const start=j<2?0:j/n,end=Math.min(1,(j+2)/n),stance=j===0?0:Math.min(1,(j+1)/n);
                    const rotation=swing?T.MathUtils.lerp(start,end,smooth(airborne)):stance;
                    footYaw=turnFrom+turnAngle*rotation;
                    if(swing){lift=Math.sin(Math.PI*airborne)**2*.038*Math.min(1,Math.abs(turnAngle)/.8);planted=airborne===0||airborne===1;}
                }
                footPoint.x+=Math.cos(footYaw)*lateral;footPoint.z-=Math.sin(footYaw)*lateral;
                const dx=(footPoint.x-g.position.x)/size,dz=(footPoint.z-g.position.z)/size;
                const ankleHeight=.04+lift+Math.max(Math.sin(pitch)*.155,-Math.sin(pitch)*.07);
                return {rig,target:v(Math.cos(yaw)*dx-Math.sin(yaw)*dz,ankleHeight,Math.sin(yaw)*dx+Math.cos(yaw)*dz),footYaw,pitch,stance:{planted,x:footPoint.x,z:footPoint.z,lift,side:rig.side,contact}};
            });
            // Place the pelvis over the support, then lower it enough for BOTH knees
            // to remain slightly bent. Never stretch a planted leg to reach the floor.
            let bob=-.006-.012*speed+(reduced?0:Math.sin(time*1.5+variation)*.001)*(1-speed);
            for(const {rig,target}of feet){
                const horizontal=(target.x-rig.side*.095-hipShift)**2+target.z**2;
                bob=Math.min(bob,target.y+Math.sqrt(Math.max(.01,.876**2-horizontal))-.918);
            }
            torso.position.set(hipShift*.8,.998+bob,0);pelvis.position.set(hipShift,.928+bob,0);
            torso.rotation.set(-.018*speed,Math.sin(stridePhase)*.034*speed,-hipShift*.5);
            pelvis.rotation.set(0,-Math.sin(stridePhase)*.025*speed,hipShift*.35);
            torso.scale.y=1+(reduced?0:Math.sin(time*1.8+variation)*.0015)*(1-speed);
            human.stance=feet.map(({rig,target,footYaw,pitch,stance})=>{solveLeg(rig,target,angleDelta(yaw,footYaw),pitch,hipShift,bob);return stance;});
            joints.forEach(({arm,elbow,hand},i)=>{
                const swing=Math.sin(stridePhase+(i?Math.PI:0));
                arm.rotation.set(swing*.29*speed-.025,0,(i?1:-1)*.045);
                elbow.rotation.set(-.12-(.06+Math.max(0,-swing)*.2)*speed,0,0);
                hand.rotation.set(.035+Math.sin(stridePhase+(i?Math.PI:0)-.3)*.035*speed,(i?-1:1)*Math.PI/2,0);
                human.grip(i,.22);
            });
            const gaze=Math.atan2(lookAt.x-g.position.x,lookAt.z-g.position.z);
            const headLead=turning?angleDelta(yaw,turnTo)*Math.sin(Math.PI*turnProgress):0;
            head.rotation.y=T.MathUtils.clamp(angleDelta(yaw,gaze)*(.65-.5*speed)+headLead*.45,-.5,.5);
            const eyeY=g.position.y+size*1.7;
            head.rotation.x=T.MathUtils.clamp(Math.atan2(eyeY-lookAt.y,Math.max(.35,Math.hypot(lookAt.x-g.position.x,lookAt.z-g.position.z))),-.2,.38)*(1-speed*.65)+(reduced?0:Math.sin(time*.72+variation)*.015*(1-speed));
            g.updateMatrixWorld(true);
            human.restHands=joints.map(({hand})=>({position:hand.getWorldPosition(v()),orientation:hand.getWorldQuaternion(new T.Quaternion())}));
            human.motion={walking:moving,turning,weight:Math.max(speed,turnWeight),stridePhase};
            faceRig.pose({time,reduced,activity,walking:speed,attention:head.rotation.y});
        },
    };
    w.people.push(human); return human;
}
