/* Two stories about continuity: a prepared conversation and a connected district.
 * Every journey is authored in scroll space. The same physical document carries
 * the narrative across the shots; people never wander on an independent timer. */
import { T, v, range, frame, actor, perform, hand, reach, held, placard, architecture, finishStory } from './cinematic-kit.js';

const pi = Math.PI;
const rotation = (x = 0, y = 0, z = 0) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'YXZ'));
const mix = T.MathUtils.lerp;

function acknowledge(h,p,start,end){
    const beat=Math.sin(pi*range(p,start,end))**2;
    h.head.rotation.x+=.075*beat;h.head.rotation.z-=.018*beat;
}

function manuscript(w, c, title, subtitle, width = .39, height = .48) {
    const g = w.group(); g.name = title;
    const page = c.folio(title, subtitle, g, width, height);
    page.rotation.x = pi / 2; page.scale.y = .2;
    const face = page.children.find(o => o.isMesh && o.material.map);
    if (face) {
        const reverse = new T.Mesh(face.geometry.clone(), face.material);
        reverse.rotation.set(pi / 2, 0, pi); reverse.position.y = -.065; page.add(reverse);
    }
    g.userData.coverEdge = width / 2 + .03;
    g.userData.coverHeight = height / 2 + .03;
    g.userData.paperHalfWidth=width/2;g.userData.paperHalfHeight=height/2;
    held(g); return g;
}

function carry(h, offset = v(0, 1.24, .3), facing = 1) {
    h.g.updateMatrixWorld(true);
    // The load belongs to the chest, so the arms and folio share the same small
    // weight shifts. Opposite grips preserve its face through an exchange.
    return { position: h.torso.localToWorld(offset.clone().sub(v(0, 1))), rotation: h.torso.getWorldQuaternion(new T.Quaternion()).multiply(rotation(0, facing < 0 ? pi : 0)).multiply(rotation(-.13)) };
}

function putDocument(document, position, orientation) {
    document.position.copy(position); document.quaternion.copy(orientation); document.updateMatrixWorld(true);
    if (window.__BASALT_SCENE_AUDIT__) document.userData.handoffGrips = new Map();
}

function auditHandoff(w, document, giver, receiver, phase) {
    if (!window.__BASALT_SCENE_AUDIT__) return;
    w.handoffAudit = {
        position: document.getWorldPosition(v()).toArray(), quaternion: document.getWorldQuaternion(new T.Quaternion()).toArray(), giver, receiver, phase,
        grips: [...document.userData.handoffGrips.values()].map(({ h, index, amount, edge, wrist, digitTargets }) => {
            const joint = h.joints[index].hand, actual = document.worldToLocal(joint.getWorldPosition(v()));
            const digits=digitTargets?.map(({pad,target,kind})=>({kind,error:pad.getWorldPosition(v()).distanceTo(target),point:document.worldToLocal(pad.getWorldPosition(v())).toArray()}))||[];
            let penetration=0;
            if(amount>.999){
                const inverse=document.matrixWorld.clone().invert(),point=v();
                joint.traverse(part=>{
                    if(!part.isMesh)return;
                    const matrix=inverse.clone().multiply(part.matrixWorld),vertices=part.geometry.getAttribute('position');
                    for(let i=0;i<vertices.count;i++){
                        point.fromBufferAttribute(vertices,i).applyMatrix4(matrix);
                        for(const [halfX,halfY,lo,hi]of [[document.userData.coverEdge,document.userData.coverHeight,-.0115,-.0025],[document.userData.paperHalfWidth,document.userData.paperHalfHeight,-.0065,.0065]]){
                            if(Math.abs(point.x)<halfX&&Math.abs(point.y)<halfY&&point.z>lo&&point.z<hi)penetration=Math.max(penetration,Math.min(halfX-Math.abs(point.x),halfY-Math.abs(point.y),point.z-lo,hi-point.z));
                        }
                    }
                });
            }
            return { role: h.g.userData.role, index, weight: amount, edge: edge.toArray(), actualEdge: actual.toArray(), error: actual.distanceTo(edge), wristError: joint.getWorldQuaternion(new T.Quaternion()).angleTo(wrist),digits,penetration };
        }),
    };
}

function support(h, document, amount = 1, both = true, facing = 1, level = .04) {
    grasp(h, 0, document, amount, facing, level);
    if (both) grasp(h, 1, document, amount, facing, level);
}

function releaseToTask(h,index,document,amount,pose){
    const rig=h.joints[index],digits=[...rig.fingers.flatMap(f=>[f.finger,f.middle,f.tip]),rig.thumbBase,rig.thumb,rig.thumbTip];
    const held=digits.map(joint=>joint.quaternion.clone());
    pose();
    digits.forEach((joint,i)=>joint.quaternion.slerpQuaternions(held[i],joint.quaternion.clone(),amount));
    h.g.updateMatrixWorld(true);
    const grip=document.userData.handoffGrips?.get(`${h.g.userData.role}:${index}`);
    if(grip)grip.amount=0; // This hand is leaving the cover; the other hand carries it.
}

function grasp(h, index, document, amount = 1, facing = 1, level = .04) {
    if (amount <= 0) return;
    h.g.updateMatrixWorld(true); document.updateMatrixWorld(true);
    const side=index?1:-1,edgeSign=side*facing,size=h.g.scale.x,cover=document.userData.coverEdge;
    // Place the whole palm outside the binding. The former wrist target was
    // only 25mm beyond it, leaving most of the 94mm palm inside the board.
    const edge=v(edgeSign*(cover+.093*size),level,-.007-facing*.052*size);
    const q=document.getWorldQuaternion(new T.Quaternion());
    // Begin at the rig's authored resting/swinging hand, not a fixed hip socket.
    const joint = h.joints[index].hand, baseline = h.restHands?.[index];
    const rest = baseline ? baseline.orientation.clone() : joint.getWorldQuaternion(new T.Quaternion());
    const target = (baseline ? baseline.position.clone() : joint.getWorldPosition(v())).lerp(document.localToWorld(edge.clone()), amount);
    // Fixed edge assignment avoids a nearest-edge swap and wrist flip when the
    // carrier turns. Receiving hands take a lower grip while both people support it.
    // Thumb side points up; fingers point inward and close on the far face.
    const diagonal=Math.SQRT1_2;
    const basis=new T.Matrix4().makeBasis(v(0,side,0),v(edgeSign*diagonal,0,-facing*diagonal),v(-edgeSign*diagonal,0,-facing*diagonal));
    const wrist=q.clone().multiply(new T.Quaternion().setFromRotationMatrix(basis));
    document.userData.handoffGrips?.set(`${h.g.userData.role}:${index}`, { h, index, amount, edge, wrist: wrist.clone() });
    h.handTo(index, target, rest.slerp(wrist, amount), mix(.22, .32, amount));
    const fingers=h.joints[index].fingers.map(({anatomy},i)=>document.localToWorld(v(edgeSign*(cover-[.012,.016,.012,.004][anatomy]*size),level+side*(i-1.5)*.016*size,-.007+facing*.0085)));
    const thumb=document.localToWorld(v(edgeSign*(cover-.010*size),level+.032*size,-.007-facing*.0085));
    h.pinchFolio(index,{fingerTargets:fingers,thumbTarget:thumb,fingerPole:v(0,0,-facing).applyQuaternion(q),thumbPole:v(0,0,facing).applyQuaternion(q),weight:range(amount,.72,1)});
    const grip=document.userData.handoffGrips?.get(`${h.g.userData.role}:${index}`);
    if(grip)grip.digitTargets=[...h.joints[index].fingers.map(({pad},i)=>({pad,target:fingers[i],kind:'finger'})),{pad:h.joints[index].thumbPad,target:thumb,kind:'thumb'}];
}

function registry(w, c, x, z, width = 2.3) {
    const cabinet = w.group(); cabinet.position.set(x, 0, z);
    const drawers = [];
    w.box(width, .14, .48, c.darkwood, cabinet, v(0, .07));
    for (const side of [-1, 1]) c.beam(v(side * width / 2, .1, 0), v(side * width / 2, 2.55, 0), .12, .38, c.darkwood, cabinet);
    w.box(width + .14, .12, .5, c.wood, cabinet, v(0, 2.57));
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
        const xx = (col - 1) * width / 3, yy = .37 + row * .45;
        const drawer = w.group(cabinet); drawer.position.set(xx, yy, 0); drawers.push(drawer);
        w.box(width / 3 - .055, .37, .35, c.wood, drawer);
        w.box(.16, .047, .045, c.brass, drawer, v(0, .03, .204));
        w.box(.23, .08, .015, c.paper, drawer, v(0, -.1, .19));
        const files = new T.InstancedMesh(new T.BoxGeometry(width / 3 - .13, .15, .018), c.paper, 4), transform = new T.Object3D(); drawer.add(files);
        for (let i = 0; i < 4; i++) { transform.position.set(0, .19, -.11 + i * .062); transform.updateMatrix(); files.setMatrixAt(i, transform.matrix); }
    }
    const sign = placard(w, c, 'CUSTOMER HISTORY', width * .83, .21, cabinet); sign.position.set(0, 2.8, .02);
    c.beam(v(-.6, 2.58), v(-.6, 2.88), .025, .025, c.brass, cabinet);
    c.beam(v(.6, 2.58), v(.6, 2.88), .025, .025, c.brass, cabinet);
    return { cabinet, drawers };
}

function dossierLeaf(w, c, title, subtitle, sketch, parent) {
    const leaf = w.group(parent);
    w.box(.58, .73, .032, c.darkwood, leaf);
    w.box(.548, .698, .018, c.brass, leaf, v(0, 0, .023));
    const map = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#e7d8b6'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#967747'; ctx.lineWidth = 2; ctx.strokeRect(20, 20, width - 40, height - 40);
        ctx.fillStyle = '#443b2b'; ctx.textAlign = 'center'; ctx.font = 'bold 27px Georgia'; ctx.fillText(title, width / 2, 71);
        ctx.font = '13px Georgia'; ctx.fillText(subtitle, width / 2, 101);
        ctx.strokeStyle = '#526f68'; ctx.lineWidth = 3;
        if (sketch === 'person') {
            ctx.beginPath(); ctx.ellipse(width / 2, 194, 43, 54, 0, 0, pi * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(130, 305); ctx.bezierCurveTo(150, 240, 280, 240, 300, 305); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(183, 202); ctx.lineTo(248, 202); ctx.moveTo(214, 205); ctx.lineTo(210, 225); ctx.stroke();
        } else if (sketch === 'history') {
            ctx.beginPath(); ctx.moveTo(77, 208); ctx.lineTo(350, 208); ctx.stroke();
            for (let i = 0; i < 3; i++) {
                const x = 88 + i * 123; ctx.beginPath(); ctx.arc(x, 208, 12, 0, pi * 2); ctx.fillStyle = '#527e74'; ctx.fill();
                ctx.fillStyle = '#705438'; ctx.font = '15px Georgia'; ctx.fillText(['FIRST VISIT', 'FOLLOW-UP', 'TODAY'][i], x, 258);
            }
        } else {
            ctx.beginPath(); ctx.moveTo(135, 240); ctx.lineTo(195, 280); ctx.lineTo(295, 162); ctx.stroke();
            ctx.strokeRect(123, 155, 182, 160);
        }
        ctx.textAlign = 'left'; ctx.fillStyle = '#847359';
        for (let i = 0; i < 6; i++) ctx.fillRect(49, 368 + i * 23, width - 105 - (i % 3) * 27, 2);
        ctx.fillStyle = '#466b62'; ctx.font = 'italic 18px Georgia'; ctx.fillText('Every conversation carries forward.', 49, height - 52);
    }, 432, 568);
    w.mesh(new T.PlaneGeometry(.531, .682), new T.MeshStandardMaterial({ map, roughness: .91 }), leaf, v(0, 0, .034));
    for (const y of [-.29, .29]) c.cylinder(.021, .021, .075, c.brass, leaf, v(-.294, y), 10);
    return leaf;
}

function correspondenceVault(w, c, workbench, archives) {
    const { root, box } = w;
    // A carved upper gallery and vaulted roof establish the hall's full scale.
    for (const x of [-4.65, -.15]) {
        c.beam(v(x, 0, -3.85), v(x, 5.2, -3.85), .17, .19, c.darkwood);
        for (const y of [.12, 3.1, 4.85]) box(.33, .1, .33, c.brass, root, v(x, y, -3.85));
    }
    box(5.1, .16, .9, c.darkwood, root, v(-2.4, 3.05, -4.02));
    box(5.22, .045, .96, c.brass, root, v(-2.4, 3.15, -4.02));
    for (const y of [3.31, 3.83]) c.beam(v(-4.9, y, -3.58), v(.12, y, -3.58), .033, .04, c.brass);
    const railGeo = new T.BoxGeometry(.023, .53, .023), rails = new T.InstancedMesh(railGeo, c.brass, 31), dummy = new T.Object3D(); root.add(rails);
    for (let i = 0; i < 31; i++) { dummy.position.set(-4.9 + i * .1667, 3.57, -3.58); dummy.updateMatrix(); rails.setMatrixAt(i, dummy.matrix); }
    for (const z of [-4.25, -2.25, -.25]) {
        const curve = [];
        for (let i = 0; i <= 20; i++) { const a = i / 20 * pi; curve.push(v(Math.cos(a) * 5.3, 4.25 + Math.sin(a) * 2.5, z)); }
        w.path(curve, .075, c.darkwood); w.path(curve.map(p => p.clone().add(v(0, -.09, 0))), .018, c.brass);
    }
    // A mechanical archive conduit carries the completed correspondence overhead.
    const route = [v(-3.25, 2.65, -3.1), v(-3.25, 3.35, -3.0), v(-1.8, 3.85, -2.85), v(.9, 3.85, -2.7), v(2.8, 3.25, -2.7), v(3.15, 1.42, -.3)];
    const curve = new T.CatmullRomCurve3(route);
    const glass = new T.MeshPhysicalMaterial({ color: '#80c8b9', transparent: true, opacity: .12, roughness: .12, metalness: .08, depthWrite: false });
    w.mesh(new T.TubeGeometry(curve, 100, .092, 12, false), glass);
    for (let i = 0; i < 18; i++) {
        const u = i / 17, at = curve.getPoint(u), tangent = curve.getTangent(u);
        const clamp = w.ring(.105, .016, c.brass); clamp.position.copy(at); clamp.quaternion.setFromUnitVectors(v(0, 0, 1), tangent);
        if (i % 3 === 0 && u < .8) c.beam(at.clone().add(v(0, .11)), v(at.x, 4.7, at.z), .019, .025, c.darkwood);
    }
    const capsule = w.group(); capsule.name = 'routed-correspondence';
    c.cylinder(.058, .058, .24, c.copper, capsule, v(), 16);
    for (const y of [-.12, .12]) c.cylinder(.062, .062, .035, c.brass, capsule, v(0, y), 16);
    const dossier = w.group(); dossier.position.set(-1.55, 1.78, -1.55);
    for (const x of [-.26, .26]) c.beam(v(x, -.565, .02), v(x, -.3, 0), .025, .028, c.brass, dossier);
    dossierLeaf(w, c, 'THE PERSON', 'CONTEXT, NOT JUST A RECORD', 'person', dossier);
    const left = w.group(dossier), right = w.group(dossier); left.position.x = -.296; right.position.x = .296;
    const history = dossierLeaf(w, c, 'OUR HISTORY', 'REMEMBER WHAT CAME BEFORE', 'history', left); history.position.x = -.296;
    const promise = dossierLeaf(w, c, 'NEXT PROMISE', 'THE COLLEAGUE CAN CONTINUE', 'promise', right); promise.position.x = .296;
    left.position.z = .045; right.position.z = .09;
    const crest = w.ring(.71, .043, c.brass); crest.position.set(2.8, 3.65, -3.3);
    const crestFace = w.mesh(new T.CircleGeometry(.65, 64), c.darkwood, root, v(2.8, 3.65, -3.35));
    for (let i = 0; i < 12; i++) { const a = i / 12 * pi * 2; c.beam(v(2.8 + Math.sin(a) * .48, 3.65 + Math.cos(a) * .48, -3.3), v(2.8 + Math.sin(a) * .6, 3.65 + Math.cos(a) * .6, -3.3), .018, .018, c.brass); }
    const handOfClock = c.beam(v(2.8, 3.65, -3.27), v(2.8, 4.08, -3.27), .027, .027, c.brass); handOfClock.name = 'guild-clock'; crestFace.name = 'guild-clock-face';
    c.lantern(workbench, v(.94, .4, -.41), .58);
    w.motions.push(p => {
        const opened = range(p, .21, .36), planned = range(p, .38, .51);
        left.rotation.y = mix(-pi + .06, -.2, opened);
        right.rotation.y = mix(pi - .06, .2, planned);
        archives[0].drawers[7].position.z = .32 * opened;
        archives[1].drawers[10].position.z = .25 * range(p, .29, .44);
        const delivered = range(p, .8, .99); capsule.position.copy(curve.getPoint(delivered)); capsule.quaternion.setFromUnitVectors(v(0, 1, 0), curve.getTangent(delivered));
    });
}

export function buildCRM(w, c) {
    architecture(w, c, { width: 11, depth: 12, height: 5.8 });
    const { root, box, anchor } = w;
    // A hall with an open foreground and a real route around the preparation desk.
    const archives = [registry(w, c, -3.25, -3.35, 2.1), registry(w, c, -.8, -3.35, 2.1)];
    c.arch(root, 2.2, 4.4, v(2.8, .05, -3.6));
    c.plant(root, v(3.7, 0, -2.5), 2.2);
    c.plant(root, v(-4.5, 0, -.9), 1.8);
    c.plant(root, v(4.1, 0, 2.1), 1.4);
    const workbench = c.desk(root, v(-1.6, 1.16, -1.23), 2.4, 1.25);
    workbench.name = 'preparation-counter';
    c.lantern(workbench, v(-.91, .4, -.37), .78);
    const record = c.folio('A familiar story', 'HISTORY / NEED / NEXT STEP', workbench, .67, .63);
    record.position.set(.16, .11, .23); record.rotation.y = -.11;
    const inkwell = c.quill(workbench); inkwell.g.position.set(.88, .058, -.21);
    const smallPlant = c.plant(workbench, v(.92, .058, -.46), .48); smallPlant.rotation.y = .7;
    correspondenceVault(w, c, workbench, archives);
    // The entry shelf leaves both sides open for the initial exchange.
    const reception = w.group(); reception.position.set(3.15, 0, -.3);
    c.cylinder(.14, .23, 1.14, c.darkwood, reception, v(0, .57), 8);
    c.cylinder(.31, .31, .07, c.brass, reception, v(0, 1.16), 8);
    box(.3, .02, .3, c.wood, reception, v(0, 1.207));
    const guild = placard(w, c, 'THE CORRESPONDENCE GUILD', 3.4, .32);
    guild.position.set(-.45, 3.58, -3.3);
    const manager = actor(w, c, v(-.25, 0, 1.1), 1, 'account-manager');
    const customer = actor(w, c, v(.79, 0, 1.1), 1, 'customer');
    const colleague = actor(w, c, v(-2.7, 0, 1.95), 1, 'next-owner');
    const plan = manuscript(w, c, 'The next conversation', 'ONE CUSTOMER / SHARED CONTEXT');
    const pen = w.group(manager.joints[1].hand); pen.position.set(.012, -.085, .018); pen.rotation.set(.46, 0, .1);
    c.cylinder(.006, .009, .17, c.brass, pen, v(0, -.075), 8); held(pen);
    const managerTrack = [
        frame(0, -.25, 1.1, pi / 2, 'receive', [.32, 1.24, 1.1]),
        frame(.19, -.25, 1.1, pi / 2, 'receive', [.32, 1.24, 1.1]),
        frame(1 / 3, -1.55, -.04, pi, 'review', [-1.44, 1.29, -.53]),
        frame(.47, -1.55, -.04, pi, 'prepare', [-1.55, 1.25, -.35]),
        frame(2 / 3, .65, 1.45, pi / 2, 'explain', [1.8, 1.5, 1.45]),
        frame(.78, .65, 1.45, pi / 2, 'explain', [1.8, 1.5, 1.45]),
        frame(.88, .65, 1.45, -pi / 2, 'introduce', [-.45, 1.5, 1.45]),
        frame(1, .65, 1.45, -pi / 2, 'handoff', [-.45, 1.35, 1.45]),
    ];
    const customerTrack = [
        frame(0, .79, 1.1, -pi / 2, 'ask', [-.25, 1.5, 1.1]),
        frame(.19, .79, 1.1, -pi / 2, 'ask', [-.25, 1.5, 1.1]),
        frame(1 / 3, 1.8, 1.45, -2, 'wait', [-1.55, 1.4, -.04]),
        frame(2 / 3, 1.8, 1.45, -pi / 2, 'listen', [.65, 1.5, 1.45]),
        frame(1, 1.8, 1.45, -pi / 2, 'understand', [-.45, 1.5, 1.45]),
    ];
    const colleagueTrack = [
        frame(0, -2.7, 1.95, 1.6, 'available', [-1.55, 1.4, -.04]),
        frame(.69, -2.7, 1.95, 1.6, 'available', [.65, 1.5, 1.45]),
        frame(.86, -.35, 1.45, pi / 2, 'join', [.65, 1.5, 1.45]),
        frame(1, -.35, 1.45, pi / 2, 'continue', [.0, 1.25, 1.45]),
    ];
    anchor('customer', plan, v(0, .3));
    anchor('record-0', record, v(0, .15));
    w.motions.push((p, t) => {
        w.workContact = null;
        perform(w, manager, managerTrack, p, t); perform(w, customer, customerTrack, p, t); perform(w, colleague, colleagueTrack, p, t);
        acknowledge(manager,p,.145,.18);acknowledge(customer,p,.69,.76);acknowledge(colleague,p,.965,1);
        const a = carry(customer), b = carry(manager, v(0, 1.24, .3), -1), d = carry(colleague);
        const initialOffer = range(p, .025, .07), initialTake = range(p, .145, .185);
        const firstShared = customer.g.position.clone().lerp(manager.g.position, .5); firstShared.y = 1.24;
        const source = a.position.clone().lerp(firstShared, initialOffer).lerp(b.position, initialTake);
        const offer = range(p, .86, .91), transfer = range(p, .96, 1);
        const shared = manager.g.position.clone().lerp(colleague.g.position, .5); shared.y = 1.24;
        const end = shared.clone().lerp(d.position, transfer);
        // Both exchanges have a contact pause: the receiver closes their grip
        // before the sender releases, then brings the same folio toward their chest.
        const orient = a.rotation.clone().slerp(b.rotation, initialTake).slerp(d.rotation, transfer);
        putDocument(plan, source.lerp(end, offer), orient);
        const managerGrip = range(p, .055, .095) * (1 - range(p, .935, .96));
        const managerLevel = mix(-.045, .04, range(p, .15, .19));
        support(manager, plan, managerGrip, false, -1, managerLevel);
        support(customer, plan, 1 - range(p, .115, .145));
        grasp(colleague, 0, plan, range(p, .89, .925), 1, -.045);
        grasp(colleague, 1, plan, range(p, .905, .935), 1, -.045);
        const writing = range(p, .345, .385) * (1 - range(p, .465, .495));
        const explaining = range(p, .63, .69) * (1 - range(p, .77, .85));
        const initialSupport = range(p, .065, .105) * (1 - range(p, .935, .96));
        grasp(manager, 1, plan, initialSupport, -1, managerLevel);
        if (writing > .001) {
            const wrist = manager.g.getWorldQuaternion(new T.Quaternion()).multiply(rotation(.42, -.2, -.4));
            const nib = plan.localToWorld(v(.015 + (w.reduced ? 0 : Math.sin(t * 1.8) * .018), -.035, -.017));
            const penOffset = v(0, -.16, 0).applyQuaternion(pen.quaternion).add(pen.position).applyQuaternion(wrist);
            const target = nib.clone().sub(penOffset);
            const rest = manager.joints[1].hand.getWorldPosition(v());
            releaseToTask(manager,1,plan,writing,()=>manager.handTo(1, rest.lerp(target, writing), manager.joints[1].hand.getWorldQuaternion(new T.Quaternion()).slerp(wrist, writing), mix(.48, .62, writing)));
            if (writing > .999) w.workContact = { point: nib, pen };
        }
        if (explaining > .001) {
            const wrist = manager.g.getWorldQuaternion(new T.Quaternion()).multiply(rotation(-.3, -1.1, -.15));
            const target = manager.g.localToWorld(v(.235, 1.18, .28));
            const held = manager.joints[1].hand.getWorldPosition(v());
            const orientation = manager.joints[1].hand.getWorldQuaternion(new T.Quaternion());
            releaseToTask(manager,1,plan,explaining,()=>manager.handTo(1, held.lerp(target, explaining), orientation.slerp(wrist, explaining), .26));
        }
        pen.visible = writing > .04; pen.scale.setScalar(Math.max(.001, writing));
        auditHandoff(w, plan, p < .19 ? 'customer' : 'account-manager', p < .19 ? 'account-manager' : p >= .86 ? 'next-owner' : null, p < .19 ? 'initial' : p >= .86 ? 'final' : 'carry');
        w.caption = p < .2 ? { speaker: 'CUSTOMER', text: 'Can we pick up where we left off?' } : p < .5 ? { speaker: 'ACCOUNT MANAGER', text: 'The history changes how I can help.' } : p < .86 ? { speaker: 'ACCOUNT MANAGER', text: 'Here is a next step that fits.' } : { speaker: 'COLLEAGUE', text: 'I have the context. I can take it from here.' };
        finishStory(w, p, { task: p < .2 ? 'A customer asks' : p < .5 ? 'Prepare with context' : p < .86 ? 'A considered conversation' : 'A colleague takes the next step', owner: p < .145 ? 1 : p < .96 ? 0 : 2, handoff: (p >= .095 && p <= .115) || (p >= .925 && p <= .935), transfer });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [2.25, 1.9, 3.75], look: [.3, 1.23, 1.1], fov: 40 },
        { p: .19, eye: [1.6, 1.86, 3.6], look: [.12, 1.27, 1.1], fov: 40 },
        { p: 1 / 3, eye: [.3, 2.1, 1.9], look: [-1.53, 1.35, -.43], fov: 42 },
        { p: .47, eye: [-.15, 1.93, 1.85], look: [-1.55, 1.3, -.25], fov: 41 },
        { p: 2 / 3, eye: [2.7, 1.96, 4.3], look: [1.12, 1.3, 1.45], fov: 44 },
        { p: .88, eye: [1.95, 1.89, 4.25], look: [.33, 1.29, 1.45], fov: 44 },
        { p: 1, eye: [3.45, 2.4, 5.5], look: [.55, 1.26, 1.45], fov: 43 },
    ] };
}

function guildhouse(w, c, name, position, width, height, tint, yaw = 0, activation = [.92,.98]) {
    const house = w.group(); house.position.copy(position); house.rotation.y = yaw;
    const accent = new T.MeshStandardMaterial({ color: tint, roughness: .72, flatShading: true });
    w.box(width, .22, 3, c.stone, house, v(0, .01));
    w.box(width, height, .18, c.stone, house, v(0, height / 2, -1.38));
    for (const x of [-width / 2 + .08, width / 2 - .08]) {
        c.beam(v(x, .1, 1.25), v(x, height, 1.25), .13, .15, c.darkwood, house);
        c.beam(v(x, .1, -1.25), v(x, height, -1.25), .13, .15, c.darkwood, house);
        w.box(.14, height * .3, 2.6, c.wood, house, v(x, height * .8));
    }
    for (const y of [1.98, height]) w.box(width + .2, .16, 2.9, c.darkwood, house, v(0, y));
    c.arch(house, width * .65, 2.4, v(0, .1, -1.25));
    const roof = w.group(house); roof.position.y = height;
    for (const side of [-1, 1]) {
        const panel = w.box(width / 2 + .24, .09, 3.25, accent, roof, v(side * width / 4, .38)); panel.rotation.z = -side * .33;
        c.beam(v(side * width / 2, -.02, 1.7), v(0, .8, 1.7), .06, .06, c.brass, roof);
        const tiles = new T.InstancedMesh(new T.BoxGeometry((width / 2 + .22) / 5, .024, .29), accent, 55), transform = new T.Object3D(); panel.add(tiles);
        for (let row = 0; row < 5; row++) for (let col = 0; col < 11; col++) {
            transform.position.set((row - 2) * (width / 2 + .22) / 5, .061 + row * .001, (col - 5) * .287); transform.updateMatrix(); tiles.setMatrixAt(row * 11 + col, transform.matrix);
            tiles.setColorAt(row * 11 + col, new T.Color().setRGB(.79 + (row % 2) * .12, .8 + (col % 3) * .055, .82 + ((row + col) % 2) * .12));
        }
    }
    // Occupied upper rooms, carved balconies and copper rainwater collection.
    w.box(width - .15, height - 2.56, .095, c.wood, house, v(0, (height + 2.56) / 2, 1.22));
    const warmWindow = c.texture((ctx, cw, ch) => {
        const glow = ctx.createLinearGradient(0, 0, 0, ch); glow.addColorStop(0, '#ffd494'); glow.addColorStop(1, '#ac713e'); ctx.fillStyle = glow; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#3c352a'; ctx.fillRect(0, ch * .55, cw, 9); ctx.fillRect(cw * .47, 0, 10, ch);
        for (let i = 0; i < 6; i++) ctx.fillRect(19 + i * 18, ch * .72 - (i % 3) * 14, 13, ch * .28 + (i % 3) * 14);
        ctx.beginPath(); ctx.arc(cw * .77, ch * .3, 15, 0, pi * 2); ctx.fill();
        ctx.fillRect(cw * .74, ch * .32, 17, ch * .28);
        ctx.strokeStyle = '#493b27'; ctx.lineWidth = 16; ctx.strokeRect(0, 0, cw, ch);
    }, 256, 384);
    const light = new T.MeshStandardMaterial({ color: '#f3d3a0', map: warmWindow, emissive: '#ffd799', emissiveMap: warmWindow, emissiveIntensity: .045, roughness: .64 });
    const windows = new T.InstancedMesh(new T.PlaneGeometry(.55, Math.min(.88, height - 2.65)), light, 3), placement = new T.Object3D(); house.add(windows);
    for (let i = 0; i < 3; i++) { placement.position.set((i - 1) * width * .29, (height + 2.56) / 2, 1.274); placement.updateMatrix(); windows.setMatrixAt(i, placement.matrix); }
    w.box(width + .14, .08, .43, c.darkwood, house, v(0, 2.58, 1.4));
    c.beam(v(-width / 2, 2.91, 1.58), v(width / 2, 2.91, 1.58), .028, .028, c.brass, house);
    const balusters = new T.InstancedMesh(new T.BoxGeometry(.018, .33, .018), c.brass, 15); house.add(balusters);
    for (let i = 0; i < 15; i++) { placement.position.set(-width / 2 + i * width / 14, 2.75, 1.58); placement.updateMatrix(); balusters.setMatrixAt(i, placement.matrix); }
    const downpipe = [v(width / 2 + .06, height, 1.32), v(width / 2 + .06, .8, 1.32), v(width / 2 + .23, .3, 1.05)];
    w.path(downpipe, .033, c.copper, house);
    c.cylinder(.21, .18, .48, c.darkwood, house, v(width / 2 + .23, .24, 1.05), 12);
    for (const y of [.1, .37]) { const hoop = w.ring(.2, .016, c.brass, house); hoop.rotation.x = pi / 2; hoop.position.set(width / 2 + .23, y, 1.05); }
    const sign = placard(w, c, name, width * .68, .32, house); sign.position.set(0, 2.34, 1.38);
    for (const x of [-.65, .65]) c.beam(v(x, 2.15, 1.25), v(x, 2.56, 1.4), .018, .018, c.brass, house);
    c.lantern(house, v(width / 2 - .15, 1.67, 1.48), .65);
    c.plant(house, v(-width / 2 + .3, .13, 1), .95);
    c.plant(house, v(width / 2 - .3, height + .22, -.8), .8);
    // A solar collector integrated with the roof, not a free-floating ornament.
    const collector = w.group(roof); collector.position.set(.25, .78, -.35); collector.rotation.x = -.35;
    w.box(.97, .045, .73, c.darkwood, collector);
    for (let i = 0; i < 4; i++) w.box(.19, .02, .66, accent, collector, v((i - 1.5) * .22, .034));
    w.districtWindows ||= []; w.districtWindows.push(light);
    const sleepingWindow=new T.Color('#52686d'),occupiedWindow=new T.Color('#f3d3a0');
    w.motions.push(p => {
        const occupied=range(p,...activation);
        light.color.copy(sleepingWindow).lerp(occupiedWindow,occupied);
        light.emissiveIntensity=mix(.025,1.6,occupied);
    });
    return house;
}

function canalInfrastructure(w, c, water) {
    const { root, box } = w;
    // Gates, bearings and a real paddle wheel turn water into work for the district.
    const wheel = w.group(); wheel.position.set(-2.18, .36, -1.05);
    for (const z of [-.32, .32]) {
        const rim = w.ring(.64, .048, c.darkwood, wheel); rim.position.z = z;
        for (let i = 0; i < 8; i++) { const a = i / 8 * pi * 2; c.beam(v(0, 0, z), v(Math.cos(a) * .6, Math.sin(a) * .6, z), .038, .043, c.brass, wheel); }
    }
    const paddles = new T.InstancedMesh(new T.BoxGeometry(.16, .065, .72), c.wood, 16), dummy = new T.Object3D(); wheel.add(paddles);
    for (let i = 0; i < 16; i++) { const a = i / 16 * pi * 2; dummy.position.set(Math.cos(a) * .65, Math.sin(a) * .65, 0); dummy.rotation.z = a + pi / 2; dummy.updateMatrix(); paddles.setMatrixAt(i, dummy.matrix); }
    c.beam(v(-2.18, .36, -1.6), v(-2.18, .36, -.25), .095, .095, c.iron);
    for (const z of [-1.67, -.27]) {
        box(.22, .54, .18, c.stone, root, v(-2.18, .19, z));
        const bearing = w.ring(.104, .029, c.brass); bearing.position.set(-2.18, .36, z);
    }
    const gates = [];
    for (const x of [-4.25, 4.25]) {
        for (const z of [-1.64, -.46]) c.beam(v(x, -.28, z), v(x, 1.05, z), .08, .08, c.darkwood);
        c.beam(v(x, 1.05, -1.7), v(x, 1.05, -.4), .11, .11, c.darkwood);
        const gate = box(.085, .57, 1.04, c.copper, root, v(x, .015, -1.05)); gates.push(gate);
        c.beam(v(x, .22, -1.05), v(x, 1.42, -1.05), .026, .026, c.brass);
        const wheelTop = c.gear(.18); wheelTop.rotation.x = pi / 2; wheelTop.position.set(x, 1.32, -1.05);
    }
    const pipeRoute = [v(-2.18, .36, -.29), v(-2.18, .55, -.17), v(-3.25, .55, -.17), v(-3.25, .12, -.17), v(-4.15, .12, -2.3), v(-4.15, 2.68, -3.9)];
    for (let i = 1; i < pipeRoute.length; i++) w.path([pipeRoute[i - 1], pipeRoute[i - 1].clone().lerp(pipeRoute[i], .5), pipeRoute[i]], .041, c.copper).name = `west-canal-feed-${i}`;
    const opposite = [v(-2.18, .36, -1.7), v(-2.18, -.14, -1.83), v(2.9, -.14, -1.83), v(3.85, .22, -2.7), v(3.85, 2.7, -3.9)];
    for (let i = 1; i < opposite.length; i++) w.path([opposite[i - 1], opposite[i - 1].clone().lerp(opposite[i], .5), opposite[i]], .036, c.copper).name = `east-canal-feed-${i}`;
    // Water carries visible directional ripples rather than unrelated floating particles.
    const flow = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { travel: { value: 0 }, uFlow: { value: 0 }, tint: { value: new T.Color('#b0e9d7') } },
        vertexShader: 'varying vec2 at;void main(){at=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 at;uniform float travel;uniform float uFlow;uniform vec3 tint;void main(){float wave=sin(at.x*210.-travel*20.+sin(at.y*23.)*.45);float crest=pow(max(0.,wave),15.);float bank=smoothstep(0.,.15,at.y)*smoothstep(0.,.15,1.-at.y);float stream=smoothstep(.0,.16,uFlow);gl_FragColor=vec4(tint,crest*bank*stream*.31);}'});
    const surface = w.mesh(new T.PlaneGeometry(41.9, 1.14), flow, root, v(0, -.237, -1.05)); surface.rotation.x = -pi / 2;
    const jet = w.group(); jet.position.set(-2.07, -.17, -1.06);
    const rippleMaterial = new T.MeshBasicMaterial({ color: '#bce9d5', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 4; i++) { const r = w.ring(.17 + i * .073, .006, rippleMaterial, jet); r.rotation.x = -pi / 2; r.position.x = i * .17; r.scale.y = .5; }
    const medallion = w.ring(1.83, .008, c.brass); medallion.rotation.x = -pi / 2; medallion.position.set(0, -.01, -4.15);
    // Engraved civic paving reveals the whole network in the final rising shot.
    const compass = new T.InstancedMesh(new T.BoxGeometry(.017, .009, .44), c.brass, 24); root.add(compass);
    for (let i = 0; i < 24; i++) { const a = i / 24 * pi * 2; dummy.position.set(Math.sin(a) * 2.05, -.011, -4.15 + Math.cos(a) * 2.05); dummy.rotation.set(0, a, 0); dummy.updateMatrix(); compass.setMatrixAt(i, dummy.matrix); }
    w.motions.push((p, t) => {
        const flowOn = range(p, .43, .67); gates.forEach((gate, i) => { gate.position.y = .015 + range(p, .44 + i * .1, .61 + i * .1) * .61; });
        wheel.rotation.z = -flowOn * pi * 4 - range(p, .67, 1) * pi * 5;
        flow.uniforms.uFlow.value = flowOn; flow.uniforms.travel.value = p * 8 + (w.reduced ? 0 : t * .07 * flowOn);
        rippleMaterial.opacity = .32 * flowOn; water.color.set('#365d63').lerp(new T.Color('#56867b'), flowOn * .6);
    });
}

function quayMaterial(c) {
    // One repeating relief texture gives the district hand-laid paving without
    // turning every cobble into a separate mesh or a new collision surface.
    const map = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#494c44'; ctx.fillRect(0, 0, width, height);
        const sw = width / 8, sh = height / 8;
        for (let row = 0; row < 8; row++) for (let col = -1; col < 9; col++) {
            const x = col * sw + (row % 2) * sw / 2, y = row * sh;
            const seed = Math.abs(Math.sin((col + 19) * 127.1 + row * 311.7)), tone = Math.round(116 + seed * 23);
            ctx.fillStyle = `rgb(${tone + 13},${tone + 9},${tone - 5})`;
            ctx.beginPath();
            ctx.moveTo(x + 9, y + 4); ctx.lineTo(x + sw - 12, y + 5);
            ctx.lineTo(x + sw - 4, y + 13); ctx.lineTo(x + sw - 5, y + sh - 11);
            ctx.lineTo(x + sw - 15, y + sh - 4); ctx.lineTo(x + 12, y + sh - 5);
            ctx.lineTo(x + 4, y + sh - 14); ctx.lineTo(x + 5, y + 13); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(220,211,181,.22)'; ctx.lineWidth = 2; ctx.stroke();
            // Sparse wear and mineral flecks keep the stone from reading as tile.
            for (let speck = 0; speck < 38; speck++) {
                const a = Math.abs(Math.sin(seed * 171 + speck * 3.71)), b = Math.abs(Math.cos(seed * 73 + speck * 5.33));
                ctx.fillStyle = speck % 3 ? 'rgba(53,68,57,.10)' : 'rgba(238,223,190,.17)';
                ctx.fillRect(x + 13 + a * (sw - 27), y + 14 + b * (sh - 28), 1 + a * 3, 1 + b * 2);
            }
        }
    }, 1024, 1024);
    map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(14, 9); map.anisotropy = 8;
    const material = c.stone.clone(); material.color.set('#ffffff'); material.map = map;
    material.bumpMap = map; material.bumpScale = .016; material.roughness = .94;
    return material;
}

function illustrateDistrictPlan(c, plan) {
    // An object-sized illustration tells the story even when no text is legible.
    const map=c.texture((ctx,width,height)=>{
        ctx.fillStyle='#eee4ca';ctx.fillRect(0,0,width,height);
        ctx.strokeStyle='#b79e69';ctx.lineWidth=3;ctx.strokeRect(27,27,width-54,height-54);
        ctx.textAlign='center';ctx.fillStyle='#284b50';ctx.font='bold 41px Georgia';
        ctx.fillText('Something good.',width/2,91);
        ctx.font='15px sans-serif';ctx.fillText('MADE POSSIBLE, TOGETHER.',width/2,123);
        const house=(x,y,size,color)=>{
            ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.lineJoin='round';ctx.lineWidth=6;
            ctx.fillStyle=color;ctx.strokeStyle='#284b50';
            ctx.beginPath();ctx.moveTo(-60,-8);ctx.lineTo(0,-63);ctx.lineTo(60,-8);ctx.lineTo(49,-8);ctx.lineTo(49,70);ctx.lineTo(-49,70);ctx.lineTo(-49,-8);ctx.closePath();ctx.fill();ctx.stroke();
            ctx.fillStyle='#284b50';ctx.fillRect(-12,24,24,46);
            ctx.fillStyle='#f8ebbc';ctx.fillRect(-34,5,16,19);ctx.fillRect(18,5,16,19);
            ctx.restore();
        };
        house(384,246,1.04,'#78a59a');
        ctx.strokeStyle='#b18b4c';ctx.lineWidth=10;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(384,335);ctx.bezierCurveTo(384,376,113,320,113,421);ctx.bezierCurveTo(113,510,384,452,384,558);ctx.stroke();
        ctx.strokeStyle='#647e73';ctx.lineWidth=5;ctx.setLineDash([5,12]);
        ctx.beginPath();ctx.moveTo(139,420);ctx.bezierCurveTo(210,388,339,403,385,441);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#294d51';ctx.font='bold 23px Georgia';ctx.textAlign='left';
        ctx.fillText('An idea.',475,246);ctx.fillText('A contribution.',241,419);
        ctx.strokeStyle='#b18b4c';ctx.lineWidth=8;
        ctx.beginPath();ctx.moveTo(384,555);ctx.lineTo(384,579);ctx.moveTo(186,592);ctx.quadraticCurveTo(384,540,582,592);ctx.stroke();
        house(186,650,.91,'#7f9d82');house(384,634,1.13,'#6d919f');house(582,650,.91,'#a49aba');
        ctx.fillStyle='#294d51';ctx.textAlign='center';ctx.font='bold 26px Georgia';ctx.fillText('A world of possibility.',384,794);
        ctx.fillStyle='#b18b4c';
        for(const x of [344,384,424]){ctx.beginPath();ctx.arc(x,837,4,0,pi*2);ctx.fill();}
    },768,896);
    const materials=new Set();plan.traverse(o=>{if(o.isMesh&&o.material.map)materials.add(o.material);});
    for(const material of materials){material.map.dispose();material.map=map;}
}

export function buildHQ(w, c) {
    const { root, box, anchor } = w;
    // The canal is an actual gap between two stone quays; the courier crosses its bridge.
    const paving = quayMaterial(c);
    box(42, .2, 27, paving, root, v(0, -.13, 12.9));
    box(42, .2, 27, paving, root, v(0, -.13, -15.2));
    const water = new T.MeshPhysicalMaterial({ color: '#365d63', metalness: .24, roughness: .24, transparent: true, opacity: .83 });
    box(42, .025, 1.25, water, root, v(0, -.26, -1.05));
    for (const z of [-.45, -1.68]) box(42, .28, .18, c.darkwood, root, v(0, -.19, z));
    for (let i = 0; i < 13; i++) box(2, .07, .115, c.wood, root, v(0, -.045, -.35 - i * .12));
    for (const side of [-1, 1]) {
        for (const z of [-.38, -1.76]) c.beam(v(side * 1.02, .0, z), v(side * 1.02, .9, z), .07, .07, c.darkwood);
        c.beam(v(side * 1.02, .84, -.38), v(side * 1.02, .84, -1.76), .045, .045, c.brass);
        c.beam(v(side * 1.02, .42, -.38), v(side * 1.02, .42, -1.76), .025, .025, c.brass);
    }
    const routeStone = new T.MeshStandardMaterial({ color: '#99896c', roughness: .94, flatShading: true });
    // Widely spaced paving joints establish scale without becoming a wire grid.
    for (let row = 0; row < 6; row++) box(5.7, .012, .03, c.darkwood, root, v(0, -.024, row * 1.05 - .02));
    const plaza = c.cylinder(2.6, 2.6, .045, routeStone, root, v(0, -.032, -4.15), 16);
    plaza.name = 'shared-courtyard';
    guildhouse(w, c, 'CRM / KNOW THE PERSON', v(-5.7, 0, 4.15), 2.8, 3.8, '#49857e', pi / 2, [.12,.17]);
    guildhouse(w, c, 'ERP / MAKE IT WORK', v(5.45, 0, 1.5), 2.8, 3.8, '#538b85', -pi / 2, [.38,.43]);
    guildhouse(w, c, 'ONYX / FIND YOUR VOICE', v(-5.3, 0, -4.1), 3.3, 4.5, '#78668c', pi / 2, [.9,.94]);
    guildhouse(w, c, 'CMS / SHARE THE STORY', v(5.2, 0, -4.0), 3.4, 4.1, '#a08fba', -pi / 2, [.92,.96]);
    guildhouse(w, c, 'BASALT / WORK TOGETHER', v(0, 0, -8.6), 4.4, 5.2, '#667f85', 0, [.65,.72]);
    guildhouse(w, c, 'ECHO / A VOICE AT THE TABLE', v(-9.4, 0, -7.2), 3.7, 4.3, '#b4955c', .36, [.94,.975]);
    guildhouse(w, c, 'VIGIL / FOLLOW THE REASONING', v(9.5, 0, -8.0), 3.7, 5.3, '#956b74', -.3, [.95,.985]);
    guildhouse(w, c, 'SURGE / OPEN FOR BUSINESS', v(-10.3, 0, 4.3), 3, 4.8, '#b37d53', pi / 3, [.96,.995]);
    for (const [x, z] of [[9, 5.6], [-13, -3], [13, -3], [-4, -10.4], [4.4, -11.2]]) {
        const height = 4.3 + Math.abs(x % 3) * .38;
        box(2.5, height, 2.7, c.wood, root, v(x, height / 2, z));
        const roof = w.mesh(new T.ConeGeometry(2.05, 1.25, 4), c.darkwood, root, v(x, height + .62, z)); roof.rotation.y = pi / 4;
        c.arch(root, 1.4, 2.6, v(x, .15, z + 1.36));
        c.plant(root, v(x + 1.4, 0, z + 1), 1.6);
    }
    for (const [x, z] of [[-3.6, -.15], [3.6, -.15], [-3.5, -2.3], [3.5, -2.3]]) {
        c.plant(root, v(x, 0, z), 1.65); c.lantern(root, v(x, 2.25, z), .8);
        c.beam(v(x, .03, z), v(x, 2.65, z), .055, .055, c.darkwood);
    }
    canalInfrastructure(w, c, water);
    // Public workstations belong to the buildings, with the street route kept clear.
    const initialDesk = c.desk(root, v(-4.65, 1.16, 4.15), 1.3, .75); initialDesk.rotation.y = pi / 2;
    const craftDesk = c.desk(root, v(4.55, 1.16, 1.5), 1.3, .75); craftDesk.rotation.y = pi / 2;
    const gear = c.gear(.17, craftDesk); gear.position.set(0, .27, .12);
    c.beam(v(0, .07, .03), v(0, .27, .12), .04, .04, c.brass, craftDesk);
    const courier = actor(w, c, v(-2.95, 0, 4.15), 1, 'courier');
    const originator = actor(w, c, v(-3.85, 0, 4.15), 1, 'originating-guild');
    const maker = actor(w, c, v(3.65, 0, 1.5), 1, 'contributing-guild');
    const coordinator = actor(w, c, v(.9, 0, -3.7), 1, 'project-coordinator');
    const plan = manuscript(w, c, 'A shared plan', 'PEOPLE / CONTRIBUTIONS / PROGRESS', .43, .5);
    illustrateDistrictPlan(c,plan);
    const contribution = w.group(plan); contribution.position.set(-.16, .04, -.022);
    c.cylinder(.045, .045, .022, c.copper, contribution, v()); contribution.rotation.x = pi / 2; held(contribution);
    const sealMap=c.texture(ctx=>{
        ctx.fillStyle='#a57142';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#f5d69d';ctx.lineWidth=6;
        ctx.beginPath();ctx.arc(64,64,51,0,pi*2);ctx.stroke();ctx.lineCap='round';ctx.lineJoin='round';
        ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(35,66);ctx.lineTo(55,85);ctx.lineTo(91,43);ctx.stroke();
    },128,128);
    const sealMaterial=new T.MeshStandardMaterial({map:sealMap,roughness:.5,metalness:.25});
    for(const side of [-1,1]){
        const seal=w.mesh(new T.CircleGeometry(.041,32),sealMaterial,contribution,v(0,side*.0115));seal.rotation.x=-side*pi/2;
    }
    const courierTrack = [
        frame(0, -2.95, 4.15, -pi / 2, 'receive', [-3.5, 1.24, 4.15]),
        frame(.17, -2.95, 4.15, -pi / 2, 'carry', [3.65, 1.5, 1.5]),
        frame(.34, 2.7, 1.5, pi / 2, 'connect', [3.65, 1.5, 1.5]),
        frame(.43, 2.7, 1.5, pi / 2, 'collect', [3.65, 1.5, 1.5]),
        frame(.57, 0, .1, pi, 'carry', [0, 1.1, -3.7]),
        frame(2 / 3, 0, -2.45, pi, 'cross', [.9, 1.5, -3.7]),
        frame(.79, 0, -3.7, pi / 2, 'arrive', [.9, 1.5, -3.7]),
        frame(.92, 0, -3.7, pi / 2, 'handoff', [.9, 1.5, -3.7]),
        frame(1, 0, -3.7, pi / 2, 'explain', [.9, 1.5, -3.7]),
    ];
    const originTrack = [frame(0, -3.85, 4.15, pi / 2, 'ask', [-2.95, 1.5, 4.15]), frame(.18, -3.85, 4.15, pi / 2, 'release', [-2.95, 1.5, 4.15]), frame(1, -3.85, 4.15, pi / 2, 'continue-work', [-4.2, 1.2, 4.15])];
    const makerTrack = [frame(0, 3.65, 1.5, -pi / 2, 'prepare', [2.7, 1.4, 1.5]), frame(.34, 3.65, 1.5, -pi / 2, 'contribute', [2.7, 1.4, 1.5]), frame(.43, 3.65, 1.5, -pi / 2, 'contribute', [2.7, 1.4, 1.5]), frame(1, 3.65, 1.5, -pi / 2, 'continue-work', [4.12, 1.2, 1.5])];
    const coordinatorTrack = [frame(0, .9, -3.7, -pi / 2, 'wait', [0, 1.5, -2]), frame(.79, .9, -3.7, -pi / 2, 'receive', [0, 1.5, -3.7]), frame(1, .9, -3.7, -pi / 2, 'review', [.45, 1.24, -3.7])];
    anchor('courier', courier.g, v(0, 1.9)); anchor('guild', plan, v(0, .31));
    w.motions.push((p, t) => {
        perform(w, courier, courierTrack, p, t); perform(w, originator, originTrack, p, t); perform(w, maker, makerTrack, p, t); perform(w, coordinator, coordinatorTrack, p, t);
        acknowledge(courier,p,.115,.16);acknowledge(courier,p,.398,.43);acknowledge(coordinator,p,.955,1);
        const contribute = range(p, .32, .35) * (1 - range(p, .43, .47));
        const a = carry(originator), b = carry(courier, v(0, 1.24, .3 + .15 * contribute), -1), d = carry(coordinator);
        const receive = range(p, .115, .155), offer = range(p, .79, .84), transfer = range(p, .90, .96);
        const firstShared = originator.g.position.clone().lerp(courier.g.position, .5); firstShared.y = 1.24;
        const shared = courier.g.position.clone().lerp(coordinator.g.position, .5); shared.y = 1.24;
        const at = a.position.clone().lerp(firstShared, range(p, .015, .05)).lerp(b.position, receive).lerp(shared.clone().lerp(d.position, transfer), offer);
        const orientation = a.rotation.clone().slerp(b.rotation, receive).slerp(d.rotation, transfer);
        putDocument(plan, at, orientation);
        support(originator, plan, 1 - range(p, .09, .115));
        const courierLevel = mix(-.045, .04, range(p, .12, .16));
        grasp(courier, 0, plan, range(p, .04, .075) * (1 - range(p, .87, .90)), -1, courierLevel);
        grasp(courier, 1, plan, range(p, .05, .085) * (1 - range(p, .87, .90)), -1, courierLevel);
        grasp(coordinator, 0, plan, range(p, .82, .855), 1, -.045);
        grasp(coordinator, 1, plan, range(p, .83, .865), 1, -.045);
        const touching = range(p, .34, .38) * (1 - range(p, .415, .45));
        reach(maker, 0, plan, v(-.19, .065, -.01), touching, .32);
        const stamp=range(p,.365,.405);
        contribution.visible=stamp>.001;contribution.position.z=-.022-.018*(1-stamp);contribution.rotation.y=-.22*(1-stamp);
        auditHandoff(w, plan, p < .16 ? 'originating-guild' : 'courier', p < .16 ? 'courier' : p >= .79 ? 'project-coordinator' : null, p < .16 ? 'initial' : p >= .79 ? 'final' : 'carry');
        w.caption = p < .2 ? { speaker: 'A WORKSHOP', text: 'We have an idea. We need a few good people.' } : p < .46 ? { speaker: 'A NEIGHBORING GUILD', text: 'We can make this part work.' } : p < .79 ? { speaker: 'THE COURIER', text: 'Bring the right work to the right people.' } : { speaker: 'THE SHARED COURTYARD', text: 'One plan, built from many contributions.' };
        finishStory(w, p, { task: p < .2 ? 'A workshop asks for help' : p < .46 ? 'A neighboring guild contributes' : p < .79 ? 'Connect the district' : 'A shared plan comes together', owner: p < .115 ? 1 : p < .90 ? 0 : 3, handoff: (p >= .075 && p <= .09) || (p >= .855 && p <= .87), transfer });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [-2, 1.72, 5.9], look: [-3.4, 1.36, 4.15], fov: 42 },
        { p: .09, eye: [-2.1, 1.78, 5.93], look: [-3.4, 1.33, 4.15], fov: 42 },
        { p: .17, eye: [-1.15, 1.82, 6.7], look: [-2.95, 1.29, 4.15], fov: 45 },
        { p: 1 / 3, eye: [.65, 1.88, 4.8], look: [3.05, 1.3, 1.5], fov: 46 },
        { p: .43, eye: [.9, 1.85, 4.35], look: [3.15, 1.3, 1.5], fov: 44 },
        { p: .57, eye: [1.6, 2.15, 3.6], look: [-.25, 1.18, -.2], fov: 47 },
        { p: .615, eye: [1, 2.7, 2.25], look: [-.7, 1, -1], fov: 50 },
        { p: 2 / 3, eye: [1.75, 2.5, .55], look: [.15, 1.2, -2.55], fov: 48 },
        { p: .82, eye: [1.75, 2.15, -.1], look: [.45, 1.27, -3.7], fov: 44 },
        { p: .94, eye: [1.8, 2.05, -.4], look: [.45, 1.27, -3.7], fov: 42 },
        { p: .975, eye: [3.7, 4.5, .4], look: [.45, 1.3, -4.1], fov: 46 },
        { p: 1, eye: [8, 9, 10], look: [0, 1.35, -3.1], fov: 50 },
    ] };
}
