/* Conversations become visible decisions. Every mechanism stays attached to its work. */
import { T, v, range, frame, actor, perform, held, placard, architecture, finishStory } from './cinematic-kit.js';

const mix = T.MathUtils.lerp;
const TAU = Math.PI * 2;

function restingHand(human, index) {
    const saved = human.restHands?.[index];
    human.g.updateMatrixWorld(true);
    return saved || { position: human.joints[index].hand.getWorldPosition(v()), orientation: human.joints[index].hand.getWorldQuaternion(new T.Quaternion()) };
}

// Task poses grow out of the current gait. A listening or explaining arm must
// return to its own swing, rather than be pinned to a second idle animation.
function gesture(human, index, position, rotation, amount, curl = .3, point = 0) {
    const weight = amount * (1 - (human.motion?.weight || 0));
    if (weight < .00001) return;
    const rest = restingHand(human, index);
    const target = human.g.localToWorld(position.clone());
    const orientation = human.g.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation, 'YXZ')));
    human.handTo(index, rest.position.clone().lerp(target, weight), rest.orientation.clone().slerp(orientation, weight), mix(.28, curl, weight), point * weight);
}

function taskHand(human, index, target, orientation, weight, curl, clearance = 0, retreat = v()) {
    if (weight < .00001) return;
    const rest = restingHand(human, index), wrist = rest.position.clone().lerp(target, weight);
    wrist.y += Math.sin(weight * Math.PI) * clearance;
    wrist.addScaledVector(retreat, Math.sin(weight * Math.PI));
    human.handTo(index, wrist, rest.orientation.clone().slerp(orientation, weight), mix(.28, curl, weight));
}

function rail(w, c, start, end, material = c.brass, radius = .022, parent = w.root) {
    return c.beam(start, end, radius, radius, material, parent);
}

function rivets(w, c, parent, positions, radius = .011) {
    const fasteners = new T.InstancedMesh(new T.SphereGeometry(radius, 8, 6), c.brass, positions.length), dummy = new T.Object3D();
    parent.add(fasteners); fasteners.name = 'flush-brass-fasteners';
    positions.forEach((position, index) => { dummy.position.copy(position); dummy.scale.set(1, .38, 1); dummy.updateMatrix(); fasteners.setMatrixAt(index, dummy.matrix); });
    return fasteners;
}

function instanceStatic(parent, objects, name) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert(), batches = new Map();
    for (const [objectIndex, object] of objects.entries()) {
        // Exact dimensions preserve the shared finisher's physical bevel radius and grain.
        const key = `${object.geometry.type}/${JSON.stringify(object.geometry.parameters)}/${object.material.uuid}`;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(object);
        // Keep the original transformed geometry in the collision audit, without render work.
        object.visible = false;
        object.name = `${name}-collision-${objectIndex}`;
    }
    let index = 0;
    for (const batch of batches.values()) {
        const instances = new T.InstancedMesh(batch[0].geometry, batch[0].material, batch.length);
        instances.name = `${name}-batch-${index++}`;
        batch.forEach((object, i) => instances.setMatrixAt(i, inverse.clone().multiply(object.matrixWorld)));
        instances.instanceMatrix.needsUpdate = true;
        parent.add(instances);
    }
}

function inscribedPage(c, folio, title, subtitle, lines, accent = '#785448') {
    const face = folio.children.find(child => child.isMesh && child.geometry.type === 'PlaneGeometry');
    if (!face) return;
    face.material.map?.dispose();
    face.material.map = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#e2d5b7'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#aa9170'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, width - 48, height - 48);
        ctx.strokeStyle = '#c0ad8d'; ctx.lineWidth = 1; ctx.strokeRect(31, 31, width - 62, height - 62);
        ctx.fillStyle = accent; ctx.font = '600 18px Georgia'; ctx.fillText(subtitle, 50, 75);
        ctx.fillStyle = '#443d33'; ctx.font = 'bold 33px Georgia'; ctx.fillText(title, 50, 122);
        ctx.fillStyle = '#6a5943'; ctx.font = '22px Georgia';
        lines.forEach((line, i) => ctx.fillText(line, 50, 180 + i * 33, width - 100));
        ctx.fillStyle = accent; ctx.fillRect(50, 146, width - 100, 2);
        ctx.font = 'italic 16px Georgia'; ctx.fillText('Illustrative review / preserve the reasoning', 50, height - 48);
    }, 640, 720);
}

function mountedHorn(w, c, position) {
    const base = w.group(); base.position.copy(position); base.name = 'echo-table-mount';
    c.cylinder(.24, .27, .065, c.darkwood, base, v(0, .033));
    c.cylinder(.21, .21, .02, c.brass, base, v(0, .078));
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        c.cylinder(.016, .016, .016, c.iron, base, v(Math.cos(a) * .17, .095, Math.sin(a) * .17), 6);
    }
    rail(w, c, v(0, .08), v(0, .5), c.brass, .064, base);
    const collar = w.ring(.1, .022, c.copper, base); collar.position.y = .42; collar.rotation.x = Math.PI / 2;
    const pivot = w.group(base); pivot.position.y = .5;
    c.cylinder(.11, .11, .1, c.brass, pivot).rotation.x = Math.PI / 2;
    const arm = w.group(pivot);
    const profile = [[.048, 0], [.058, .12], [.09, .24], [.15, .35], [.245, .45], [.33, .49]];
    const hornMaterial = c.brass.clone(); hornMaterial.side = T.DoubleSide;
    w.mesh(new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), 28), hornMaterial, arm);
    // Raised petal seams follow the bell, with a rolled lip rather than a paper-thin edge.
    for (let i = 0; i < 12; i++) {
        const angle = i / 12 * TAU;
        w.path(profile.slice(1).map(([radius, y]) => v(Math.cos(angle) * (radius + .003), y, Math.sin(angle) * (radius + .003))), .0035, c.copper, arm);
    }
    const rim = w.ring(.33, .019, c.copper, arm); rim.position.y = .49; rim.rotation.x = Math.PI / 2;
    const innerLip = w.ring(.313, .007, c.brass, arm); innerLip.position.y = .486; innerLip.rotation.x = Math.PI / 2;
    const throat = w.group(arm); throat.position.y = .17;
    w.mesh(new T.CircleGeometry(.075, 24), c.iron, throat).rotation.x = -Math.PI / 2;
    for (const radius of [.027, .049, .07]) { const grille = w.ring(radius, .0025, c.copper, throat); grille.rotation.x = Math.PI / 2; grille.position.y = .002; }
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        rail(w, c, v(Math.cos(a) * .009, .003, Math.sin(a) * .009), v(Math.cos(a) * .074, .003, Math.sin(a) * .074), c.brass, .0025, throat);
    }
    const diaphragm = w.mesh(new T.SphereGeometry(.026, 16, 10), c.copper, throat, v(0, .008)); diaphragm.scale.y = .22;
    for (let i = 0; i < 7; i++) { const collar = w.ring(.067, .005, c.brass, base); collar.position.y = .15 + i * .034; collar.rotation.x = Math.PI / 2; }
    // An enclosed resonator and braided lead explain the instrument's physical construction.
    const resonator = c.cylinder(.052, .052, .22, c.copper, base, v(-.14, .2, -.065), 20);
    for (const y of [.115, .285]) { const band = w.ring(.055, .008, c.brass, base); band.position.set(-.14, y, -.065); band.rotation.x = Math.PI / 2; }
    w.path([v(-.14, .32, -.065), v(-.105, .385, -.07), v(0, .4, -.07)], .012, c.brass, base);
    w.path([v(-.14, .09, -.065), v(-.12, .03, -.24), v(.02, .01, -.33)], .014, c.iron, base);
    resonator.name = 'mounted-resonance-chamber';
    const gauge = w.group(base); gauge.position.set(0, .18, .13); gauge.rotation.x = -.25;
    const gaugeRim = w.ring(.105, .014, c.brass, gauge);
    const dialMap = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#dbd3b8'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#4f5548'; ctx.lineWidth = 4;
        for (let i = 0; i <= 20; i++) {
            const a = Math.PI * (.2 + i / 20 * 1.6), outer = 214, inner = i % 5 ? 199 : 185;
            ctx.beginPath(); ctx.moveTo(width / 2 + Math.cos(a) * inner, height / 2 + Math.sin(a) * inner); ctx.lineTo(width / 2 + Math.cos(a) * outer, height / 2 + Math.sin(a) * outer); ctx.stroke();
        }
        ctx.fillStyle = '#4f5548'; ctx.font = 'bold 34px Georgia'; ctx.textAlign = 'center'; ctx.fillText('ECHO', width / 2, 210);
        ctx.font = '22px Georgia'; ctx.fillText('LISTEN / REPLY', width / 2, 335);
    });
    w.mesh(new T.CircleGeometry(.1, 32), new T.MeshStandardMaterial({ map: dialMap, roughness: .76 }), gauge, v(0, 0, -.007));
    const needle = w.box(.007, .073, .009, c.copper, gauge, v(0, .03, .009)); needle.geometry.translate(0, -.03, 0);
    w.mesh(new T.SphereGeometry(.009, 12, 8), c.brass, gauge, v(0, 0, .017));
    const faceGlass = w.mesh(new T.CircleGeometry(.099, 32), new T.MeshPhysicalMaterial({ color: '#c5d2bf', roughness: .08, metalness: .1, transparent: true, opacity: .11, depthWrite: false }), gauge, v(0, 0, .024));
    faceGlass.name = 'calibrated-dial-glass';
    const lampMat = new T.MeshStandardMaterial({ color: '#e5c586', emissive: '#ffd081', emissiveIntensity: .1, roughness: .3 });
    const lamp = w.mesh(new T.SphereGeometry(.041, 12, 8), lampMat, base, v(.13, .13, .12));
    w.mounts = [{ base, pivot, arm }];
    return { base, arm, gaugeRim, needle, lamp, diaphragm };
}

function irrigationPlan(w, c, table) {
    const plan = w.group(table); plan.position.set(-.5, .078, .2); plan.name = 'shared-irrigation-plan';
    w.box(1.65, .037, 1.12, c.paper, plan);
    const map = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#d8cca8'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#b3a883'; ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for (let y = 0; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        ctx.fillStyle = '#51452e'; ctx.font = 'bold 29px Georgia'; ctx.fillText('THE GREENHOUSE PLAN', 28, 48);
        ctx.font = '17px Georgia'; ctx.fillText('One missing valve. One useful answer.', 28, 78);
    }, 768, 512);
    const face = w.mesh(new T.PlaneGeometry(1.61, 1.08), new T.MeshStandardMaterial({ map, roughness: 1 }), plan, v(0, .021)); face.rotation.x = -Math.PI / 2;
    const pipeMaterial = c.copper.clone(); pipeMaterial.roughness = .4;
    // The route is a physical tabletop model, with a real gap at its valve seat.
    for (const [x, length] of [[-.47, .54], [.24, .7]]) {
        const pipe = c.cylinder(.025, .025, length, pipeMaterial, plan, v(x, .07, .45)); pipe.rotation.z = Math.PI / 2;
    }
    const pump = w.group(plan); pump.position.set(-.68, .08, .44);
    c.cylinder(.095, .095, .12, c.brass, pump).rotation.z = Math.PI / 2;
    const wheel = c.gear(.09, pump, c.copper, 10); wheel.position.z = .08;
    w.box(.21, .045, .2, c.darkwood, pump, v(0, -.027));
    const greenhouse = w.group(plan); greenhouse.position.set(.53, .055, .24);
    w.box(.36, .027, .55, c.wood, greenhouse);
    for (const x of [-.16, .16]) for (const z of [-.24, .24]) rail(w, c, v(x, 0, z), v(x, .21, z), c.brass, .011, greenhouse);
    for (const z of [-.24, .24]) {
        rail(w, c, v(-.16, .21, z), v(0, .32, z), c.brass, .012, greenhouse);
        rail(w, c, v(0, .32, z), v(.16, .21, z), c.brass, .012, greenhouse);
    }
    rail(w, c, v(0, .32, -.24), v(0, .32, .24), c.brass, .012, greenhouse);
    const shoots = [], leaves = [];
    for (let i = 0; i < 5; i++) {
        const sprout = w.group(greenhouse); sprout.position.set((i % 2 ? 1 : -1) * .065, .015, -.17 + i * .075);
        rail(w, c, v(), v(0, .15), c.green, .008, sprout);
        for (const side of [-1, 1]) {
            const hinge = w.group(sprout); hinge.position.set(0, .09); hinge.userData.side = side;
            const leaf = w.mesh(new T.IcosahedronGeometry(.036, 1), c.greenLight, hinge, v(side * .022)); leaf.scale.set(.8, .19, 1.5); leaves.push(hinge);
        }
        shoots.push(sprout);
    }
    const roofGlass = new T.MeshPhysicalMaterial({ color: '#c3dfc4', roughness: .16, metalness: .12, transparent: true, opacity: .12, side: T.DoubleSide, depthWrite: false });
    for (const side of [-1, 1]) {
        const pane = w.mesh(new T.PlaneGeometry(.197, .48), roofGlass, greenhouse, v(side * .078, .268)); pane.rotation.set(-Math.PI / 2, side * -.6, 0);
    }
    const irrigation = w.group(greenhouse); irrigation.name = 'working-irrigation-channels';
    const channelMat = new T.MeshStandardMaterial({ color: '#518d80', roughness: .2, metalness: .15, emissive: '#174e41', emissiveIntensity: .25 });
    const channels = [];
    for (const side of [-1, 1]) {
        for (const dx of [-.02, .02]) w.box(.008, .026, .44, c.copper, irrigation, v(side * .075 + dx, .031));
        const stream = w.box(.027, .007, .42, channelMat, irrigation, v(side * .075, .035, .21)); stream.geometry.translate(0, 0, -.21); channels.push(stream);
    }
    w.box(.21, .019, .025, c.copper, irrigation, v(0, .032, .23));
    rivets(w, c, plan, [-.78, .78].flatMap(x => [-.5, .5].map(z => v(x, .026, z))), .012);
    // Both the replacement valve and its brass tray sit within the planner's reach.
    const tray = w.group(table); tray.position.set(-.22, .09, .71);
    w.box(.25, .025, .18, c.brass, tray);
    const valve = held(w.group()); valve.name = 'replacement-valve';
    const valveBody = c.cylinder(.052, .052, .12, c.brass, valve); valveBody.rotation.z = Math.PI / 2;
    rail(w, c, v(), v(0, .08), c.brass, .02, valve);
    const control = w.ring(.052, .008, c.copper, valve); control.position.y = .08; control.rotation.x = Math.PI / 2;
    const waterMat = new T.MeshStandardMaterial({ color: '#80b6aa', emissive: '#70b4a9', emissiveIntensity: .9, roughness: .35 });
    const water = w.box(.72, .013, .018, waterMat, plan, v(-.17, .075, .45)); water.geometry.translate(.36, 0, 0);
    const warning = w.ring(.083, .011, new T.MeshBasicMaterial({ color: '#b87042', transparent: true, opacity: .75, depthWrite: false }), plan); warning.position.set(-.17, .04, .45); warning.rotation.x = Math.PI / 2;
    return { plan, pump, wheel, shoots, leaves, channels, valve, water, warning, control, tray };
}

function echoConservatoryDetails(w, c, conservatory) {
    const bayPositions = [-4.7, -2.5, -.3, 1.9, 4.1];
    const roofCurve = new T.CatmullRomCurve3([v(-4.4, 2.7), v(-3.2, 4.2), v(0, 5.5), v(3.2, 4.2), v(4.4, 2.7)]);
    const glass = new T.MeshPhysicalMaterial({ color: '#d1d5bb', roughness: .2, metalness: .06, transparent: true, opacity: .075, side: T.DoubleSide, depthWrite: false });
    for (let bay = 0; bay < bayPositions.length - 1; bay++) {
        const positions = [], indices = [], steps = 24;
        for (let i = 0; i <= steps; i++) {
            const point = roofCurve.getPoint(i / steps);
            positions.push(point.x, point.y, bayPositions[bay], point.x, point.y, bayPositions[bay + 1]);
            if (i < steps) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
        const pane = w.mesh(geometry, glass, conservatory); pane.name = 'curved-conservatory-glazing';
    }
    for (let i = 1; i < 12; i++) {
        const point = roofCurve.getPoint(i / 12);
        rail(w, c, v(point.x, point.y, -4.7), v(point.x, point.y, 4.1), c.brass, .013, conservatory);
    }
    // A shallow timber diffuser softens voices without turning the room into an abstract equalizer.
    const baffle = w.group(conservatory); baffle.position.set(0, 2.25, -4.15); baffle.name = 'timber-acoustic-diffuser';
    w.box(2.8, 1.28, .095, c.darkwood, baffle);
    for (let i = 0; i < 23; i++) {
        const depth = .09 + ((i * i + 3 * i) % 11) * .014;
        w.box(.076, 1.16, depth, i % 3 === 0 ? c.copper : c.wood, baffle, v(-1.28 + i * .116, 0, depth * .5));
    }
    for (const x of [-1.5, 1.5]) c.plant(conservatory, v(x, 0, -3.85), 1.45);
    const halo = w.ring(.68, .025, c.brass, conservatory); halo.position.set(0, 3.54, -.2); halo.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
        const angle = i / 6 * TAU, x = Math.cos(angle) * .68, z = -.2 + Math.sin(angle) * .68;
        rail(w, c, v(x, 3.54, z), v(0, 4.08, -.2), c.brass, .012, conservatory);
        const shade = c.cylinder(.035, .085, .1, c.copper, conservatory, v(x, 3.51, z), 12);
        w.mesh(new T.SphereGeometry(.039, 12, 8), c.amber, shade, v(0, -.055));
    }
}

export function buildEcho(w, c) {
    const { root, group } = w;
    architecture(w, c, { width: 8.8, depth: 10, height: 3.3 });
    const conservatory = group(); conservatory.name = 'echo-vaulted-conservatory';
    for (const z of [-4.7, -2.5, -.3, 1.9, 4.1]) {
        w.path([v(-4.4, 2.7, z), v(-3.2, 4.2, z), v(0, 5.5, z), v(3.2, 4.2, z), v(4.4, 2.7, z)], .048, c.brass, conservatory);
    }
    for (const x of [-3.1, 0, 3.1]) rail(w, c, v(x, x === 0 ? 5.5 : 4.24, -4.7), v(x, x === 0 ? 5.5 : 4.24, 4.1), c.copper, .027, conservatory);
    for (const side of [-1, 1]) {
        const planter = w.box(.75, .45, 4.8, c.stone, conservatory, v(side * 3.9, .225, -1)); planter.name = 'greenhouse-planter';
        for (let i = 0; i < 5; i++) c.plant(conservatory, v(side * 3.9, .44, -2.9 + i * .91), 1.2 + (i % 2) * .25);
    }
    const pendant = c.lantern(conservatory, v(0, 3.35, -.2), 1.25); rail(w, c, v(0, 3.85, -.2), v(0, 5.46, -.2), c.iron, .018, conservatory);
    pendant.name = 'meeting-table-pendant';
    echoConservatoryDetails(w, c, conservatory);
    const table = c.desk(root, v(0, 1.16, 0), 3.35, 1.62); table.name = 'echo-working-table';
    const instrument = mountedHorn(w, c, v(1.13, 1.217, -.12));
    const model = irrigationPlan(w, c, table);
    c.folio('MORNING WORK', 'GREENHOUSE TEAM', table, .4, .52).position.set(-1.27, .085, -.27);
    const recorder = c.folio('DECISIONS', 'OWNERS / NEXT STEPS', table, .46, .58); recorder.position.set(.45, .075, -.39);
    c.plant(table, v(-1.4, .06, -.56), .55);
    const sign = placard(w, c, 'THE CONSERVATORY\nA place to think together', 2.6, .54); sign.position.set(0, 2.85, -4.82);
    const planner = actor(w, c, v(-.66, 0, 1.1), 1, 'planner');
    const colleague = actor(w, c, v(.83, 0, -1.2), .98, 'colleague');
    const facilitator = actor(w, c, v(-2.23, 0, -.14), 1.03, 'facilitator');
    const plannerTrack = [frame(0, -.66, 1.1, Math.PI, 'explain', [1.13, 1.72, -.12]), frame(.33, -.66, 1.1, Math.PI, 'listen', [1.13, 1.72, -.12]), frame(.66, -.66, 1.1, Math.PI, 'consider', [-.5, 1.25, .5]), frame(1, -.66, 1.1, Math.PI, 'revise-plan', [-.65, 1.3, .55])];
    const colleagueTrack = [frame(0, .83, -1.2, 0, 'listen', [-.66, 1.58, 1.17]), frame(.33, .83, -1.2, 0, 'listen', [1.13, 1.75, -.12]), frame(.66, .83, -1.2, -.25, 'consider', [-.5, 1.25, .5]), frame(1, .7, -1.2, -.25, 'continue-conversation', [-.66, 1.58, 1.17])];
    const facilitatorTrack = [frame(0, -2.23, -.14, Math.PI / 2, 'listen', [-.66, 1.55, 1.17]), frame(.33, -2.23, -.14, Math.PI / 2, 'listen', [1.13, 1.74, -.12]), frame(.66, -2.23, -.14, Math.PI / 2, 'consider', [-.5, 1.25, .5]), frame(1, -2.23, -.14, Math.PI / 2, 'agree', [-.5, 1.25, .5])];
    w.motions.push((p, t) => {
        perform(w, planner, plannerTrack, p, t); perform(w, colleague, colleagueTrack, p, t); perform(w, facilitator, facilitatorTrack, p, t);
        const ask = 1 - range(p, .12, .3), reply = range(p, .35, .48) * (1 - range(p, .65, .75));
        const reachValve = range(p, .66, .72), graspValve = range(p, .72, .745), pick = range(p, .745, .78);
        const move = range(p, .78, .88), setDown = range(p, .89, .94), releaseGrip = range(p, .945, .965), release = range(p, .965, 1);
        const beat = w.reduced ? 0 : Math.sin(t * 2.1) * .012;
        gesture(planner, 1, v(.25, 1.39, .13), [-.85, -.15, -.12], ask, .2);
        gesture(facilitator, 0, v(-.23, 1.25, .19), [-.5, .7, .08], range(p, .48, .56) * (1 - range(p, .61, .69)), .24);
        gesture(colleague, 1, v(.24, 1.36, .21), [-.85, -.2, .08], range(p, .94, 1), .24);
        // Arrive with an open hand, close around the control, then lift. The
        // valve cannot leave its tray before the fingers support its weight.
        const start = v(-.22, 1.29, .71), end = v(-.67, 1.308, .65);
        model.valve.position.copy(start).lerp(end, move); model.valve.position.y += Math.sin(move * Math.PI) * .13 + pick * (1 - setDown) * .045;
        // Spin around the wheel's own normal. Rotating its parent Y axis would
        // tip the horizontal control upright while the planner is holding it.
        model.control.rotation.z = range(p, .91, .96) * Math.PI / 2;
        const orientation = planner.g.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(-.08, model.control.rotation.z * .5, .04, 'YXZ')));
        const gripTarget = model.valve.position.clone().add(v(0, .08, 0)).sub(v(-.015, -.15, .08).applyQuaternion(orientation));
        const holdWeight = reachValve * (1 - release), grip = graspValve * (1 - releaseGrip);
        taskHand(planner, 0, gripTarget, orientation, holdWeight, mix(.16, .45, grip), .26);
        model.water.scale.x = Math.max(.001, range(p, .94, .985));
        model.channels.forEach((stream, i) => { stream.scale.z = Math.max(.001, range(p, .964 + i * .008, 1)); });
        model.warning.visible = p < .94;
        model.wheel.rotation.z = range(p, .945, 1) * TAU;
        model.shoots.forEach((shoot, i) => { shoot.scale.y = mix(.32, 1, range(p, .94 + i * .003, 1)); });
        model.leaves.forEach((leaf, i) => { leaf.rotation.z = leaf.userData.side * mix(-1.05, -.18, range(p, .955 + i * .002, 1)); });
        const aim = v(-.8, -.1, .48).lerp(v(-.25, -.04, -.5), range(p, .86, 1)).normalize();
        instrument.arm.quaternion.setFromUnitVectors(v(0, 1, 0), aim);
        instrument.needle.rotation.z = mix(-.9, .9, ask * .6 + reply * (.72 + beat));
        instrument.diaphragm.scale.y = .22 + reply * (.06 + beat * 2);
        instrument.lamp.material.emissiveIntensity = .1 + reply * 1.9 + (p > .15 && p < .4 ? .8 : 0);
        w.caption = p < .22 ? { speaker: 'Planner', text: 'The greenhouse is ready. What is holding up the water?' } : p < .46 ? { speaker: 'Echo listens', text: 'The team keeps its attention on the work.' } : p < .72 ? { speaker: 'Echo', text: 'Use the spare valve. Then check the route before opening it.' } : { speaker: 'Planner', text: 'I will fit it and check the flow. Then we can begin.' };
        finishStory(w, p, { task: p < .22 ? 'describe-the-problem' : p < .46 ? 'listen-in-context' : p < .72 ? 'give-a-useful-answer' : 'revise-the-plan', owner: p < .46 || p > .72 ? 0 : 1, valveSeated: setDown, routeOpen: range(p, .94, .985), physicalInstrument: true });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [-2.9, 2.08, 3.3], look: [-.35, 1.38, .2], fov: 46 },
        { p: .18, eye: [-1.95, 2.1, 2.5], look: [.65, 1.57, -.05], fov: 44 },
        { p: 1 / 3, eye: [2.8, 2.16, 2.2], look: [.5, 1.48, -.06], fov: 43 },
        { p: .5, eye: [2.5, 2.23, -2.55], look: [-.3, 1.4, .22], fov: 48 },
        { p: 2 / 3, eye: [.25, 2.8, 2.5], look: [-.44, 1.26, .38], fov: 44 },
        { p: .9, eye: [-2.2, 2.65, 1.65], look: [-.51, 1.3, .6], fov: 45 },
        { p: 1, eye: [-3.85, 2.68, 4.7], look: [-.18, 1.38, -.02], fov: 49 },
    ] };
}

function shelves(w, c) {
    const archive = w.group(); archive.name = 'vigil-source-archive';
    const bookMats = ['#6b4546', '#465057', '#8c795d', '#454139'].map(color => new T.MeshStandardMaterial({ color, roughness: .94, flatShading: true }));
    const books = [], spineMarks = [];
    for (const x of [-3.25, 3.25]) {
        for (const z of [-3.6, -1.9, -.2]) {
            const shelf = w.group(archive); shelf.position.set(x, 0, z); shelf.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
            for (const side of [-.68, .68]) w.box(.085, 6.4, .52, c.darkwood, shelf, v(side, 3.2));
            for (let tier = 0; tier < 8; tier++) {
                const y = .24 + tier * .77; w.box(1.45, .065, .54, c.darkwood, shelf, v(0, y));
                for (let i = 0; i < 8; i++) {
                    const height = .38 + ((i + tier) % 3) * .06, book = w.box(.1 + (i % 2) * .025, height, .35, bookMats[(i + tier) % 4], shelf, v(-.54 + i * .15, y + height / 2 + .035, -.015));
                    books.push(book);
                    spineMarks.push(w.box(.085, .013, .006, c.brass, book, v(0, height * .25, .178)));
                }
            }
        }
    }
    instanceStatic(archive, books, 'archive-book');
    instanceStatic(archive, spineMarks, 'brass-spine-mark');
    const window = c.arch(archive, 3.8, 7.8, v(0, 0, -4.3), true);
    window.traverse(object => { if (object.isMesh && object.material.transparent) { object.material.color.set('#b97982'); object.material.emissive.set('#56252f'); object.material.emissiveIntensity = .32; } });
    // Access galleries make the archive's height useful, with brackets carrying their weight.
    for (const side of [-1, 1]) {
        w.box(.76, .13, 4.15, c.darkwood, archive, v(side * 2.9, 3.5, -2.15));
        for (let i = 0; i < 7; i++) {
            const z = -4 + i * .62;
            rail(w, c, v(side * 2.48, 3.57, z), v(side * 2.48, 4.3, z), c.brass, .025, archive);
            rail(w, c, v(side * 3.19, 2.95, z), v(side * 2.53, 3.46, z), c.darkwood, .055, archive);
        }
        for (const y of [3.79, 4.31]) rail(w, c, v(side * 2.48, y, -4.05), v(side * 2.48, y, -.2), c.brass, .03, archive);
        const galleryName = placard(w, c, side < 0 ? 'I / RECORDS' : 'II / AUTHORITIES', 1.18, .19, archive); galleryName.position.set(side * 2.95, 3.45, -.045);
    }
    const ladder = w.group(archive); ladder.position.set(-2.48, 0, -3.28); ladder.rotation.y = -.2;
    for (const x of [-.2, .2]) rail(w, c, v(x, .04, .46), v(x, 3.58, -.22), c.darkwood, .043, ladder);
    for (let i = 0; i < 11; i++) { const y = .22 + i * .3; rail(w, c, v(-.22, y, .46 - y * .192), v(.22, y, .46 - y * .192), c.brass, .028, ladder); }
    const cabinet = w.group(archive); cabinet.position.set(0, .72, -3.99); cabinet.name = 'indexed-evidence-drawers';
    w.box(3.2, 1.4, .57, c.darkwood, cabinet);
    const pulls = [], drawerHandles = [], drawerFronts = [];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 5; column++) {
        const x = (column - 2) * .61, y = (row - 1) * .42;
        drawerFronts.push(w.box(.575, .378, .025, c.wood, cabinet, v(x, y, .297)));
        const pull = w.ring(.036, .007, c.brass, cabinet); pull.position.set(x, y - .083, .32);
        drawerHandles.push(pull);
        pulls.push(v(x - .064, y - .083, .319), v(x + .064, y - .083, .319));
    }
    instanceStatic(cabinet, drawerFronts, 'evidence-drawer-front');
    instanceStatic(cabinet, drawerHandles, 'evidence-drawer-handle');
    rivets(w, c, cabinet, pulls, .008);
    const indexMap = c.texture((ctx, width, height) => {
        ctx.clearRect(0, 0, width, height); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let row = 0; row < 3; row++) for (let column = 0; column < 5; column++) {
            const x = (column + .5) * width / 5, y = (row + .34) * height / 3;
            ctx.fillStyle = '#d2c3a0'; ctx.fillRect(x - 33, y - 13, 66, 26); ctx.fillStyle = '#524438'; ctx.font = '17px Georgia'; ctx.fillText(String(row * 5 + column + 1).padStart(2, '0'), x, y);
        }
    }, 800, 360);
    w.mesh(new T.PlaneGeometry(3.05, 1.26), new T.MeshStandardMaterial({ map: indexMap, transparent: true, roughness: .9, depthWrite: false }), cabinet, v(0, 0, .314));
    const oculus = w.group(archive); oculus.position.set(0, 6.25, -4.08);
    for (const radius of [.79, .92]) w.ring(radius, .025, c.brass, oculus);
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        rail(w, c, v(Math.cos(a) * .14, Math.sin(a) * .14), v(Math.cos(a) * .77, Math.sin(a) * .77), c.brass, .012, oculus);
    }
    w.mesh(new T.CircleGeometry(.14, 24), c.copper, oculus);
    const lintel = placard(w, c, 'THE READING ROOM\nEvidence before certainty', 2.7, .55, archive); lintel.position.set(0, 3, -4.14);
    return archive;
}

function sourceLift(w, c) {
    const rails = w.group(); rails.name = 'archive-document-lift';
    for (const x of [-1.32, -.06]) {
        rail(w, c, v(x, 1.21, -.15), v(x, 6.55, -.15), c.brass, .065, rails);
        w.box(.18, .1, .26, c.darkwood, rails, v(x, 1.22, -.15));
    }
    w.box(1.55, .15, .3, c.darkwood, rails, v(-.69, 6.52, -.15));
    const upperWheel = c.gear(.19, rails, c.brass, 16); upperWheel.position.set(-.69, 6.48, .04);
    const weight = w.group(rails); weight.name = 'guided-archive-counterweight';
    w.box(.23, .46, .17, c.iron, weight);
    for (const y of [-.17, .17]) w.box(.27, .032, .19, c.brass, weight, v(0, y));
    for (const x of [-2.075, -1.725]) rail(w, c, v(x, 1.15, -.5), v(x, 6.55, -.5), c.brass, .025, rails);
    rail(w, c, v(-2.1, 6.54, -.5), v(-.69, 6.54, -.5), c.darkwood, .075, rails);
    const ropeMaterial = new T.MeshStandardMaterial({ color: '#766653', roughness: .98 });
    const loadCable = c.cylinder(.009, .009, 1, ropeMaterial, rails), weightCable = c.cylinder(.009, .009, 1, ropeMaterial, rails);
    w.path([v(-.99, 6.42, -.5), v(-1.02, 6.59, -.5), v(-1.85, 6.59, -.5), v(-1.9, 6.42, -.5)], .009, ropeMaterial, rails);
    const pulleys = [-.99, -1.9].map(x => { const wheel = c.gear(.085, rails, c.brass, 12); wheel.position.set(x, 6.47, -.515); return wheel; });
    const carriage = w.group(); carriage.name = 'guided-source-carriage';
    w.box(1.08, .075, .83, c.darkwood, carriage);
    w.box(1.13, .027, .88, c.brass, carriage, v(0, .05));
    for (const x of [-.63, .63]) {
        c.cylinder(.077, .077, .22, c.copper, carriage, v(x, -.03, -.15));
        rail(w, c, v(x, 0, -.15), v(x * .73, 0, 0), c.brass, .04, carriage);
    }
    rail(w, c, v(-.3, .025, -.36), v(-.3, .11, -.52), c.brass, .025, carriage);
    rivets(w, c, carriage, [-.46, .46].flatMap(x => [-.32, .32].map(z => v(x, .069, z))), .014);
    const source = c.folio('SOURCE / 12', 'SCOPE AND CONDITIONS', carriage, .73, .63); source.position.set(0, .14, .05);
    inscribedPage(c, source, 'Scope & conditions', 'SOURCE 12 / ORIGINAL WORDING', ['Approval applies only after', 'the stated conditions', 'have been met.', '', 'Keep this condition with', 'the claim it supports.']);
    w.box(.027, .007, .43, c.cloth, source, v(-.29, .045, .14));
    const citation = placard(w, c, '12', .083, .115, source); citation.position.set(-.29, .055, .26); citation.rotation.x = -Math.PI / 2;
    const underline = w.box(.44, .009, .025, c.copper, source, v(0, .042, .1));
    const tab = placard(w, c, 'SOURCE 12', .58, .16, carriage); tab.position.set(0, -.065, .45);
    return { carriage, upperWheel, source, underline, weight, loadCable, weightCable, pulleys };
}

export function buildVigil(w, c) {
    const { root } = w;
    architecture(w, c, { width: 7.5, depth: 10, height: 7 });
    shelves(w, c);
    for (const x of [-2.6, 2.6]) {
        c.lantern(root, v(x, 2.7, -1.5), .9);
        rail(w, c, v(x, 2.96, -1.5), v(x, 4, -1.5), c.iron, .018);
    }
    const desk = c.desk(root, v(.1, 1.16, .02), 3.05, 1.36); desk.name = 'vigil-review-desk';
    // Pegged braces and restrained brass joinery ground the instrument-like reading desk.
    for (const side of [-1, 1]) {
        for (const z of [-.4, .4]) {
            rail(w, c, v(side * 1.26, -.52, z), v(side * .89, -.075, z), c.darkwood, .068, desk);
            c.cylinder(.025, .025, .17, c.brass, desk, v(side * 1.26, -.34, z)).rotation.x = Math.PI / 2;
        }
        w.box(.025, .027, 1.18, c.brass, desk, v(side * 1.49, -.078));
    }
    w.box(2.8, .018, .025, c.brass, desk, v(0, -.083, .64));
    const lift = sourceLift(w, c);
    const draftHinge = w.group(desk); draftHinge.position.set(.27, .105, .56); draftHinge.name = 'annotated-draft-hinge';
    w.box(.93, .03, .82, c.darkwood, draftHinge, v(0, 0, -.34));
    const draft = c.folio('THE DRAFT', 'A CLAIM TO REVIEW', draftHinge, .8, .72); draft.position.set(0, .04, -.34);
    inscribedPage(c, draft, 'A claim to review', 'WORKING DRAFT / 01', ['Approval applies', 'in every case.', '', 'Check the scope before', 'relying on this wording.'], '#954f57');
    held(draftHinge);
    for (const x of [-.39, .39]) {
        const hinge = c.cylinder(.04, .04, .13, c.brass, draftHinge, v(x, -.012, .02)); hinge.rotation.z = Math.PI / 2;
    }
    const disputed = w.box(.59, .008, .03, c.copper, draft, v(0, .043, -.035));
    const citation = placard(w, c, '12', .085, .12, draft); citation.position.set(.345, .065, -.18); citation.rotation.x = -Math.PI / 2;
    const revisedMap = c.texture((ctx, width, height) => {
        ctx.fillStyle = '#e2d5b7'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#3e5445'; ctx.font = 'bold 28px Georgia';
        ctx.fillText('Approval applies when', 12, 43); ctx.fillText('conditions are met.', 12, 83);
        ctx.fillStyle = '#7c4e4f'; ctx.font = '18px Georgia'; ctx.fillText('Scope retained / source 12', 12, 116);
    }, 480, 140);
    const revisedText = w.mesh(new T.PlaneGeometry(.62, .2), new T.MeshStandardMaterial({ map: revisedMap, transparent: true, opacity: 0, roughness: .96, depthWrite: false }), draft, v(0, .053, -.04)); revisedText.rotation.x = -Math.PI / 2;
    const correction = w.group(draft); correction.position.set(-.29, .052, .28);
    for (let i = 0; i < 3; i++) { const line = w.box(.52 - i * .055, .005, .011, c.iron, correction, v((.52 - i * .055) / 2, 0, i * .035)); line.name = `revision-line-${i}`; }
    const reason = placard(w, c, 'REASON RECORDED\nSource 12 / scope corrected', .85, .2, draftHinge); reason.position.set(0, .07, .056); reason.rotation.x = -Math.PI / 2;
    const seal = w.group(desk); seal.position.set(1.17, .092, .32); c.cylinder(.07, .07, .04, c.copper, seal); c.cylinder(.029, .052, .12, c.brass, seal, v(0, .07));
    c.lantern(desk, v(1.29, .42, -.43), .75);
    const reviewer = actor(w, c, v(.63, 0, 1.2), 1, 'reviewer');
    const client = actor(w, c, v(2.12, 0, .64), .99, 'client');
    const reviewerTrack = [frame(0, .63, 1.2, Math.PI, 'flag-the-question', [.38, 1.3, .3]), frame(.18, -.5, 1.2, Math.PI, 'request-source', [-.69, 5.6, .05]), frame(.38, -.5, 1.2, Math.PI, 'compare-source', [-.69, 1.5, .2]), frame(.56, .63, 1.2, Math.PI, 'compare-draft', [.37, 1.3, .3]), frame(.63, .63, .91, Math.PI, 'correct-draft', [.37, 1.3, .3]), frame(.8, .63, .91, Math.PI, 'correct-draft', [.37, 1.3, .3]), frame(.85, .63, .91, Math.PI, 'prepare-explanation', [.37, 1.3, .3]), frame(.93, .63, 1.2, Math.PI, 'prepare-explanation', [.37, 1.3, .3]), frame(1, .64, 1.2, 2.15, 'explain-reasoning', [2.12, 1.6, .64])];
    const clientTrack = [frame(0, 2.12, .64, -Math.PI / 2, 'wait', [.63, 1.6, .99]), frame(.33, 2.12, .64, -Math.PI / 2, 'observe-review', [-.69, 1.5, .05]), frame(.67, 2.12, .64, -Math.PI / 2, 'observe-correction', [.37, 1.32, .3]), frame(1, 1.93, .64, -Math.PI / 2, 'understand-reasoning', [.55, 1.55, .8])];
    const pen = held(w.group(reviewer.joints[1].hand)); pen.position.set(-.013, -.095, .005);
    c.cylinder(.008, .011, .16, c.brass, pen); w.mesh(new T.ConeGeometry(.009, .045, 8), c.iron, pen, v(0, -.1)).rotation.z = Math.PI;
    const penNib = v(0, -.1225, 0);
    w.motions.push((p, t) => {
        perform(w, reviewer, reviewerTrack, p, t); perform(w, client, clientTrack, p, t);
        // Release the page, take a short backward step, then turn to the client.
        // Keeping the shoulders square to the desk prevents a sleeve brushing it during the pivot.
        if (p >= .85 && p <= .93) {
            const travel = range(p, .85, .93);
            reviewer.act({ routeStart: v(.63, 0, .91), routeEnd: v(.63, 0, 1.2), travel, moving: travel > 0 && travel < 1, turning: false, yaw: Math.PI, turnFrom: Math.PI, turnTo: Math.PI, turnProgress: 1, lookAt: v(.37, 1.3, .3), activity: 'step-back', segment: 'vigil-backstep' }, w.reduced ? 0 : t, w.reduced);
        }
        const descend = range(p, .18, .4), writing = range(p, .635, .67) * (1 - range(p, .81, .85)), presentation = range(p, .86, 1);
        lift.carriage.position.set(-.69, mix(5.34, 1.29, descend), .02);
        lift.upperWheel.rotation.z = descend * TAU * 3;
        lift.weight.position.set(-1.9, mix(1.57, 5.62, descend), -.5);
        const loadBottom = lift.carriage.position.y + .11, weightTop = lift.weight.position.y + .23;
        lift.loadCable.position.set(-.99, (loadBottom + 6.43) / 2, -.5); lift.loadCable.scale.y = 6.43 - loadBottom;
        lift.weightCable.position.set(-1.9, (weightTop + 6.43) / 2, -.5); lift.weightCable.scale.y = 6.43 - weightTop;
        lift.pulleys.forEach(wheel => { wheel.rotation.z = -descend * TAU * 5; });
        lift.underline.scale.x = mix(.2, 1, range(p, .4, .49));
        disputed.scale.x = mix(1, .001, range(p, .69, .78));
        revisedText.material.opacity = range(p, .78, .815);
        citation.visible = p > .45;
        const rows = [[.67, .708], [.724, .762], [.778, .81]];
        correction.children.forEach((line, i) => { const progress = range(p, ...rows[i]); line.scale.x = Math.max(.001, progress); line.position.x = (.52 - i * .055) * progress / 2; });
        reason.visible = p > .8;
        draftHinge.rotation.x = presentation * .56;
        // The pen is an actual hand attachment; the nib stays on the current revision line.
        let row = 2, along = 1, nibLift = 0;
        for (let i = 0; i < rows.length; i++) {
            if (p <= rows[i][1]) { row = i; along = range(p, ...rows[i]); break; }
            if (i < 2 && p < rows[i + 1][0]) {
                const turn = range(p, rows[i][1], rows[i + 1][0]);
                row = i + turn; along = 1 - turn; nibLift = Math.sin(turn * Math.PI) * .07; break;
            }
        }
        const linePoint = draft.localToWorld(v(-.29 + (.52 - Math.floor(row) * .055) * along, .054 + nibLift, .28 + row * .035));
        const desiredWrist = linePoint.clone().add(v(.013, .2175, -.005));
        // Settle at the desk before bringing the nib to the first line. During
        // travel the wrist keeps its walking pose; full contact still solves
        // directly from the nib, so a softer approach cannot slide the pen.
        taskHand(reviewer, 1, desiredWrist, new T.Quaternion(), writing, .69, .26, v(0, 0, .12));
        const explain = range(p, .935, 1);
        gesture(reviewer, 0, v(-.23, 1.38, .23), [-.85, .15, -.1], explain, .24, .6);
        gesture(client, 0, v(-.23, 1.32, .18), [-.75, .35, .08], explain, .24);
        pen.visible = p > .635 && p < .85;
        // Ink cannot appear until the pen has reached the paper.
        w.workContact = writing > .999 && nibLift < .0001 ? { pen, point: linePoint, nib: penNib } : null;
        w.caption = p < .18 ? { speaker: 'Reviewer', text: 'This claim needs a source before it can go forward.' } : p < .49 ? { speaker: 'Source 12', text: 'The original wording includes a condition the draft has missed.' } : p < .84 ? { speaker: 'Reviewer', text: 'Narrow the claim. Keep the supporting passage with the correction.' } : { speaker: 'Reviewer', text: 'Here is what changed, and the evidence behind the change.' };
        finishStory(w, p, { task: p < .18 ? 'flag-the-question' : p < .49 ? 'retrieve-and-compare' : p < .84 ? 'correct-the-draft' : 'explain-the-reasoning', sourceHeight: lift.carriage.position.y, sourceGuided: true, correction: range(p, .64, .8), presentation, owner: 0 });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [1.1, 2.65, 1.85], look: [.36, 1.29, .3], fov: 44 },
        { p: .17, eye: [.34, 6.18, 2.5], look: [-.69, 5.47, .04], fov: 42 },
        { p: 1 / 3, eye: [-.1, 3.75, 3.07], look: [-.69, 2.85, .04], fov: 44 },
        { p: .46, eye: [-1.56, 2.32, 2.62], look: [-.43, 1.43, .26], fov: 43 },
        { p: 2 / 3, eye: [1.75, 2.65, 1.65], look: [.35, 1.34, .42], fov: 44 },
        { p: .83, eye: [2.89, 2.2, 2.83], look: [.48, 1.36, .31], fov: 45 },
        { p: 1, eye: [3.75, 2.37, 4.45], look: [.55, 1.41, .42], fov: 47 },
    ] };
}
