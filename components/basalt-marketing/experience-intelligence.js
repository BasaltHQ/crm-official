/* Two grounded worlds. Echo listens through water; Vigil works through sources.
 * Progress owns every consequential change, and reversing it reconstructs the
 * same physical state. Ambient time supplies only the quietest water movement. */
import { T, V, flightPath, batchArchitecture } from './flight-kit.js';

const PI = Math.PI, TAU = PI * 2;
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * p * (p * (p * 6 - 15) + 10); };
const phase = (p, a, b) => smooth((p - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;
function material(base, color, options = {}) { const mat = base.clone(); mat.color.set(color); Object.assign(mat, options); return mat; }
function cylinder(w, parent, r, h, mat, at = V(), r2 = r, sides = 64) { return w.mesh(new T.CylinderGeometry(r, r2, h, sides), mat, parent, at); }
function ring(w, parent, r, tube, mat, at = V(), flat = false) { const m = w.mesh(new T.TorusGeometry(r, tube, 12, 112), mat, parent, at); if (flat) m.rotation.x = PI / 2; return m; }
function curve(w, parent, points, radius, mat) { return w.tube(points.map(p => Array.isArray(p) ? V(...p) : p), radius, mat, parent); }

function documentSurface(w, parent, { width = 3, height = 4, title = '', subtitle = '', lines = [], color = '#eadfc1', ink = '#202321', transparent = false, emblem = null } = {}) {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = Math.round(900 * height / width);
    const ctx = canvas.getContext('2d'), h = canvas.height;
    if (!transparent) { ctx.fillStyle = color; ctx.fillRect(0, 0, 900, h); }
    ctx.strokeStyle = '#b39c72'; ctx.lineWidth = 2; ctx.strokeRect(30, 30, 840, h - 60);
    ctx.fillStyle = ink; ctx.textAlign = 'left';
    const wide = height / width < .65;
    ctx.font = `${wide ? Math.max(14, h * .09) : 28}px Georgia`; ctx.fillText(subtitle, 75, h * (wide ? .8 : .13), 750);
    ctx.font = `600 ${wide ? Math.min(48, h * .2) : 48}px Georgia`; String(title).split('\n').forEach((text, i) => ctx.fillText(text, 75, h * (wide ? .5 : .24) + i * 60, 750));
    if (!wide) { ctx.strokeStyle = '#ae9669'; ctx.beginPath(); ctx.moveTo(75, h * .36); ctx.lineTo(825, h * .36); ctx.stroke(); }
    ctx.font = '24px Arial'; lines.forEach((text, i) => ctx.fillText(text, 75, h * .44 + i * 47, 750));
    if (!transparent && height / width > .8) {
        ctx.strokeStyle = '#b0a58c'; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) { const y = h * .64 + i * h * .032; ctx.beginPath(); ctx.moveTo(75, y); ctx.lineTo(780 - (i % 3) * 95, y); ctx.stroke(); }
    }
    if (emblem !== null) {
        ctx.fillStyle = color; ctx.fillRect(0, 0, 900, h);
        ctx.strokeStyle = '#bba16e'; ctx.lineWidth = 5; ctx.strokeRect(26, 26, 848, h - 52); ctx.lineWidth = 1; ctx.strokeRect(42, 42, 816, h - 84);
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = '26px Georgia'; ctx.fillText(subtitle, 450, h * .13, 730);
        ctx.font = '600 64px Georgia'; String(title).split('\n').forEach((line, i) => ctx.fillText(line, 450, h * .29 + i * 78, 740));
        ctx.font = '600 230px Georgia'; ctx.fillText(emblem, 450, h * .7, 700);
        ctx.font = '25px Georgia'; ctx.fillText('B A S A L T  V I G I L', 450, h * .9, 740);
    }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    const mat = new T.MeshStandardMaterial({ map: texture, color: transparent ? '#ffffff' : '#c6bdab', roughness: .81, transparent, side: T.DoubleSide, depthWrite: !transparent });
    const mesh = w.mesh(new T.PlaneGeometry(width, height), mat, parent); mesh.castShadow = !transparent;
    return mesh;
}

function label(w, parent, text, position, width = 3.2, subtitle = '') {
    const group = w.group(parent); group.position.copy(position);
    w.box(width + .07, .88, .07, w.materials.bronze, group);
    documentSurface(w, group, { width, height: .81, title: text, subtitle, lines: [] }).position.z = .045;
    return group;
}

function markBolts(w, parent, radius, count, mat, axis = 'z') {
    const instanced = new T.InstancedMesh(new T.SphereGeometry(.065, 8, 6), mat, count), dummy = new T.Object3D();
    for (let i = 0; i < count; i++) {
        const a = i / count * TAU;
        dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, .12);
        if (axis === 'y') dummy.position.set(Math.cos(a) * radius, .12, Math.sin(a) * radius);
        dummy.updateMatrix(); instanced.setMatrixAt(i, dummy.matrix);
    }
    parent.add(instanced); return instanced;
}

// One physical coordinate system drives the outlets, the travelling surface,
// the reed bearings and the narrative audit. Nothing launches from an invisible
// point beside an instrument, and the answer waits for the question to arrive.
const OUTLET = 6.1, CROSSING = OUTLET * 2;
function exchangeState(p) {
    const outward = phase(p, .065, .47), returning = phase(p, .57, .92);
    return {
        requestFront: -OUTLET + outward * CROSSING,
        replyFront: OUTLET - returning * CROSSING,
        requestRadius: outward * CROSSING,
        replyRadius: returning * CROSSING,
        requestStrength: phase(p, .06, .08) * (1 - phase(p, .46, .56)),
        replyStrength: phase(p, .55, .59) * (1 - phase(p, .91, .985)),
        response: phase(p, .43, .49) * (1 - phase(p, .56, .63)),
    };
}
const waveFunctions = `
uniform float requestRadius; uniform float replyRadius;
uniform float requestStrength; uniform float replyStrength;
uniform float response; uniform float quietTime;
float pulse(vec2 point,vec2 origin,float radius,float width){float d=length(point-origin)-radius;return cos(d*6.6)*exp(-d*d/(width*width));}
float waterHeight(vec2 point){
 float channel=exp(-point.y*point.y*.055);
 float request=.135*pulse(point,vec2(-6.1,0.),requestRadius,.92)*requestStrength;
 float reply=.105*pulse(point,vec2(6.1,0.),replyRadius,1.32)*replyStrength;
 vec2 listening=point-vec2(6.1,0.);
 float shaped=.024*cos(length(listening)*5.5)*exp(-dot(listening,listening)*.3)*response;
 float edge=1.-smoothstep(8.65,9.14,length(point));
 return edge*((request+reply)*(channel*.75+.25)+shaped+.004*sin(point.x*.7+quietTime*.21)*cos(point.y*.53-quietTime*.17));
}`;

function listeningWater(w, parent) {
    const rings = 68, sides = 144, radius = 9.2, positions = [], indices = [], uvs = [];
    for (let r = 0; r <= rings; r++) for (let a = 0; a <= sides; a++) {
        const angle = a / sides * TAU, distance = r / rings * radius;
        positions.push(Math.cos(angle) * distance, 0, Math.sin(angle) * distance); uvs.push(a / sides, r / rings);
        if (r < rings && a < sides) { const i = r * (sides + 1) + a; indices.push(i, i + 1, i + sides + 2, i, i + sides + 2, i + sides + 1); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    const uniforms = { requestRadius: { value: 0 }, replyRadius: { value: 0 }, requestStrength: { value: 0 }, replyStrength: { value: 0 }, response: { value: 0 }, quietTime: { value: 0 } };
    const water = new T.MeshPhysicalMaterial({ color: '#4f6d68', metalness: .38, roughness: .19, clearcoat: 1, clearcoatRoughness: .12, side: T.DoubleSide, envMapIntensity: 1.55 });
    water.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `${waveFunctions}\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `float delta=.035;float hpx=waterHeight(position.xz+vec2(delta,0.));float hmx=waterHeight(position.xz-vec2(delta,0.));float hpz=waterHeight(position.xz+vec2(0.,delta));float hmz=waterHeight(position.xz-vec2(0.,delta));vec3 objectNormal=normalize(vec3((hmx-hpx)/(delta*2.),1.,(hmz-hpz)/(delta*2.)));`);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed=position;transformed.y+=waterHeight(position.xz);');
    };
    water.customProgramCacheKey = () => 'basalt-listening-well-v2';
    const mesh = w.mesh(geo, water, parent, V(0, .9, 0)); mesh.name = 'echo-purposeful-three-dimensional-water-wave'; mesh.castShadow = false;
    return { mesh, update(state, t) { for (const key of ['requestRadius', 'replyRadius', 'requestStrength', 'replyStrength', 'response']) uniforms[key].value = state[key]; uniforms.quietTime.value = t; } };
}

function acousticDiaphragm(w, fixed, moving, x, receiver = false) {
    const { brass, bronze, iron } = w.materials;
    const frame = w.group(fixed); frame.position.set(x, 2.8, 0); frame.rotation.y = x < 0 ? PI / 2 : -PI / 2;
    ring(w, frame, 1.75, .13, bronze); ring(w, frame, 1.58, .035, brass, V(0, 0, .08));
    for (const side of [-1, 1]) {
        w.beam(V(side * 1.8, -.2, 0), V(side * 2.1, -2.7, -.1), .13, iron, frame);
        w.box(.65, .22, .65, bronze, frame, V(side * 2.1, -2.6, -.1));
    }
    w.beam(V(-2.1, -2.6, -.1), V(2.1, -2.6, -.1), .1, brass, frame);
    // The visible outlet meets the basin; the diaphragm is carried by its fork.
    curve(w, frame, [[0, -1.6, 0], [0, -2.3, .3], [0, -1.95, 1.4]], .12, bronze);
    const movingFrame = w.group(moving); movingFrame.position.copy(frame.position); movingFrame.rotation.copy(frame.rotation);
    // A mounted, counterweighted striker supplies the visible cause of the
    // travelling question. Its stop leaves a small clearance at peak contact.
    for (const side of [-1, 1]) {
        w.beam(V(side * 1.82, -.1, 0), V(side * 1.82, 2.35, 0), .065, bronze, frame);
        w.beam(V(side * 1.82, 2.35, 0), V(side * .48, 2.6, 1.1), .065, brass, frame);
    }
    w.beam(V(-.48, 2.6, 1.1), V(.48, 2.6, 1.1), .085, bronze, frame);
    const striker = w.group(movingFrame); striker.position.set(0, 2.6, 1.1);
    w.beam(V(0, .42, 0), V(0, -2.6, 0), .055, bronze, striker);
    w.box(.24, .5, .24, iron, striker, V(0, .3, 0));
    const felt = material(w.materials.paper, '#d6c49e', { roughness: .63, bumpScale: .008 });
    w.mesh(new T.SphereGeometry(.24, 28, 20), felt, striker, V(0, -2.6, 0));
    batchArchitecture(striker);
    const diaphragmMat = material(w.materials.paper, receiver ? '#d5c6a5' : '#d9b879', { metalness: .15, roughness: .44 });
    const skin = new T.RingGeometry(0, 1.56, 96, 18);
    const skinPosition = skin.getAttribute('position'), radii = new Float32Array(skinPosition.count);
    for (let i = 0; i < radii.length; i++) radii[i] = Math.hypot(skinPosition.getX(i), skinPosition.getY(i));
    const diaphragm = w.mesh(skin, diaphragmMat, movingFrame, V(0, 0, .05)); diaphragm.material.side = T.DoubleSide;
    const heartMat = material(w.materials.glow, '#ecc988', { emissiveIntensity: .25 });
    const heart = cylinder(w, movingFrame, .24, .12, heartMat, V(0, 0, .14), .24, 40); heart.rotation.x = PI / 2;
    const rearHeart = cylinder(w, movingFrame, .24, .12, heartMat, V(0, 0, -.02), .24, 40); rearHeart.rotation.x = PI / 2;
    // Both faces belong to the instrument: the camera crosses the well, so the
    // reverse must show the same coupled ribs and hub instead of a blank disc.
    const ribs = new T.InstancedMesh(new T.TorusGeometry(1, .009, 8, 96), bronze, 16), ribPose = new T.Object3D();
    ribs.castShadow = false; ribs.receiveShadow = true; movingFrame.add(ribs);
    label(w, fixed, receiver ? 'A THOUGHTFUL REPLY' : 'A SPOKEN QUESTION', V(x, 1.7, 2.6), 3.2);
    for (const dx of [-1.2, 1.2]) w.beam(V(x + dx, .65, 2.6), V(x + dx, 1.28, 2.6), .035, bronze, fixed);
    let previousAmount = -1;
    return { diaphragm, heart, update(amount) {
        if (amount === previousAmount) return; previousAmount = amount;
        // A clamped membrane bows inside its rim. The embossed ribs and hub
        // follow that surface instead of a flat disc passing through them.
        const bow = radius => (.012 + amount * .045) * Math.pow(1 - (radius / 1.56) ** 2, 2);
        for (let i = 0; i < radii.length; i++) skinPosition.setZ(i, bow(radii[i]));
        skinPosition.needsUpdate = true; skin.computeVertexNormals();
        for (let i = 0; i < 16; i++) {
            const radius = .34 + (i % 8) * .14;
            ribPose.position.z = .05 + (i < 8 ? .016 : -.016) + bow(radius); ribPose.scale.set(radius, radius, 1); ribPose.updateMatrix(); ribs.setMatrixAt(i, ribPose.matrix);
        }
        ribs.instanceMatrix.needsUpdate = true;
        heart.position.z = .12 + bow(0); rearHeart.position.z = -.02 + bow(0); heart.material.emissiveIntensity = .25 + amount * .6;
        striker.rotation.x = -.7 + amount * .99;
    } };
}

function contextGate(w, fixed, moving, x, title) {
    const { brass, bronze, iron } = w.materials, top = 4.5;
    for (const z of [-2.7, 2.7]) {
        w.box(.48, .24, .65, bronze, fixed, V(x, .28, z));
        w.beam(V(x, .35, z), V(x, top, z), .07, bronze, fixed);
        w.beam(V(x, top, z), V(x, top + .85, z * .62), .06, brass, fixed);
    }
    w.beam(V(x, top + .85, -1.68), V(x, top + .85, 1.68), .09, brass, fixed);
    const labelGroup = label(w, fixed, title, V(x, top + 1.25, 0), 2.85); labelGroup.rotation.y = PI / 2;
    const shutters = [];
    for (let i = 0; i < 5; i++) {
        const g = w.group(moving); g.position.set(x, 3.5, (i - 2) * .82);
        const reed = new T.Shape(), length = 1.75 + (i % 3) * .16;
        reed.moveTo(-.19, -length / 2); reed.quadraticCurveTo(-.32, -.25, -.23, length / 2 - .15);
        reed.quadraticCurveTo(0, length / 2 + .22, .23, length / 2 - .15); reed.quadraticCurveTo(.32, -.25, .19, -length / 2); reed.closePath();
        const face = w.mesh(new T.ExtrudeGeometry(reed, { depth: .035, bevelEnabled: true, bevelThickness: .018, bevelSize: .025, bevelSegments: 2, curveSegments: 18 }), brass, g);
        face.rotation.y = PI / 2;
        w.beam(V(.05, -length / 2 + .16, 0), V(.05, length / 2 - .1, 0), .018, bronze, g);
        w.beam(V(0, -.98, 0), V(0, 1.8, 0), .026, brass, g);
        cylinder(w, fixed, .095, .16, bronze, V(x, 5.31, (i - 2) * .82), .095, 20);
        batchArchitecture(g);
        shutters.push(g);
    }
    const cam = w.group(moving); cam.position.set(x, 4.5, 2.86);
    ring(w, cam, .54, .06, bronze); ring(w, cam, .21, .04, brass);
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        w.beam(V(Math.cos(a) * .18, Math.sin(a) * .18, 0), V(Math.cos(a) * .54, Math.sin(a) * .54, 0), .035, brass, cam);
    }
    const marker = w.box(.16, .27, .1, brass, cam, V(0, .57, 0));
    const bearing = cylinder(w, fixed, .11, .32, bronze, V(x, 4.5, 2.73), .11, 28); bearing.rotation.x = PI / 2;
    batchArchitecture(cam);
    return { shutters, update(p) {
        shutters.forEach((shutter, i) => { shutter.rotation.y = -.2 + p * 1.72 + (i - 2) * .045 * p; });
        cam.rotation.z = -p * PI * 1.4;
    } };
}

function buildEcho(w) {
    const fixed = w.group(), moving = w.group(); fixed.name = 'echo-grounded-listening-well';
    const { brass, bronze, iron } = w.materials;
    const sand = material(w.materials.stone, '#a2906e', { bumpScale: .045, roughness: .78 });
    const dark = material(w.materials.stone, '#4b4940', { bumpScale: .07 });
    const warm = material(w.materials.bronze, '#8b6840', { roughness: .38 });
    const darkWaterFloor = material(w.materials.stone, '#33443f', { bumpScale: .03, roughness: .5 });
    cylinder(w, fixed, 130, .6, sand, V(0, -.35, 0));
    cylinder(w, fixed, 10.4, .65, dark, V(0, .25, 0));
    cylinder(w, fixed, 9.25, .12, darkWaterFloor, V(0, .53, 0));
    ring(w, fixed, 9.55, .35, sand, V(0, .65, 0), true); ring(w, fixed, 9.2, .075, brass, V(0, .9, 0), true);
    ring(w, fixed, 10.05, .04, bronze, V(0, .92, 0), true);
    // A circular acoustic room: continuous curved walls and a stepped listening
    // gallery. The viewer enters through an open quadrant at the front.
    const wall = w.mesh(new T.CylinderGeometry(15.7, 15.7, 15, 112, 1, true, PI * .51, PI * .98), sand, fixed, V(0, 7.1, -1.2)); wall.material.side = T.DoubleSide;
    const outerStone = material(sand, '#6e644f', { side: T.BackSide });
    w.mesh(new T.CylinderGeometry(70, 70, 46, 128, 1, true), outerStone, fixed, V(0, 22, 0));
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU;
        cylinder(w, fixed, .3, 43, dark, V(Math.sin(a) * 69.5, 20.5, Math.cos(a) * 69.5), .44, 20);
    }
    const acousticStrip = material(w.materials.glow, '#e5b85e', { emissiveIntensity: .4 });
    for (let i = 0; i < 17; i++) {
        const a = PI * .52 + i / 16 * PI * .96, x = Math.sin(a) * 15.2, z = Math.cos(a) * 15.2 - 1.2;
        cylinder(w, fixed, .18, 14, warm, V(x, 6.7, z), .28, 24);
        w.beam(V(x, 13.5, z), V(x * .55, 17, z * .55), .12, brass, fixed);
        cylinder(w, fixed, .42, .18, bronze, V(x, .2, z), .46, 32);
        cylinder(w, fixed, .08, 7.5, acousticStrip, V(x * 1.015, 6.4, z * 1.015), .08, 12);
    }
    // Actual annular steps stay outside the basin. Sector-shaped solid caps
    // would extend invisibly under the water and cut through its troughs.
    for (let i = 0; i < 3; i++) {
        const inner = 10.65 + i * 1.1, outer = inner + 1.1, height = .32 + i * .28, shape = new T.Shape();
        for (let j = 0; j <= 80; j++) {
            const a = PI * .58 + j / 80 * PI * .84, x = Math.sin(a) * outer, z = Math.cos(a) * outer;
            if (j === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
        }
        for (let j = 80; j >= 0; j--) { const a = PI * .58 + j / 80 * PI * .84; shape.lineTo(Math.sin(a) * inner, Math.cos(a) * inner); }
        shape.closePath();
        const terrace = w.mesh(new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }), sand, fixed, V(0, height, 0));
        terrace.rotation.x = PI / 2;
    }
    const water = listeningWater(w, moving);
    const source = acousticDiaphragm(w, fixed, moving, -7.5, false), answer = acousticDiaphragm(w, fixed, moving, 7.5, true);
    const gates = [-3.3, 0, 3.3].map((x, i) => contextGate(w, fixed, moving, x, ['PERSONALITY', 'LANGUAGE', 'KNOWLEDGE'][i]));
    for (const x of [-3.3, 0, 3.3]) curve(w, fixed, [[x, .35, -2.7], [x, .25, -9.8], [x * 1.2, .2, -12]], .055, bronze);
    label(w, fixed, 'THE LISTENING WELL', V(0, 1.55, 10.25), 5.8, 'ONE VOICE. A USEFUL EXCHANGE.');
    for (const x of [-2.4, 2.4]) {
        cylinder(w, fixed, .16, .14, bronze, V(x, .03, 10.25), .2, 24);
        w.beam(V(x, .1, 10.25), V(x, 1.3, 10.25), .045, brass, fixed);
    }
    batchArchitecture(fixed);
    const camera = flightPath([
        { p: 0, eye: [-13, 4.8, 16], target: [-4.5, 1.7, 0], fov: 44 },
        { p: .2, eye: [-8, 7.4, 16], target: [-2.5, 1.9, 0], fov: 47 },
        { p: .44, eye: [12, 9, 16], target: [1.5, 2, 0], fov: 48 },
        { p: .66, eye: [13, 6.8, 13], target: [3.6, 2.2, 0], fov: 44 },
        { p: 1, eye: [15, 13, 20], target: [0, 2.5, -1], fov: 52 },
    ]);
    const stages = ['A question enters the well', 'Context shapes the exchange', 'A reply returns across the water', 'A wider circle can listen'];
    return { title: 'The Listening Well', stages, camera, environment: { background: '#24231e', fog: '#494438', key: '#ffe3ac', keyIntensity: 2.7, keyPosition: [-16, 25, 14], fill: '#a8b9b5', fillIntensity: .8, portraitDistance: 1.95 }, update(p, t) {
        const state = exchangeState(p);
        water.update(state, t);
        source.update(Math.sin(phase(p, .015, .11) * PI) + Math.sin(phase(p, .9, .99) * PI) * .24);
        const valves = [-3.3, 0, 3.3].map(x => phase(state.requestFront, x - 1.15, x - .05));
        // Catch the incoming phrase first, then turn the reeds farther open
        // from the listening end back toward the speaker before the reply.
        const answerPreparation = [0, 1, 2].map(i => phase(p, .465 + (2 - i) * .012, .56 + (2 - i) * .012));
        gates.forEach((gate, i) => gate.update(valves[i] * (.68 + answerPreparation[i] * .32)));
        answer.update(Math.sin(phase(p, .44, .61) * PI));
        const chapter = Math.min(3, Math.round(p * 3));
        w.narrative = { chapter, subject: 'One request in a grounded acoustic well', action: stages[chapter], contextValvesOpen: valves.filter(value => value === 1).length, requestFront: state.requestFront, replyFront: state.replyFront, replyReturning: p >= .57 && p <= .92, outletAligned: true, grounded: true, automaticSend: false };
    } };
}

function vaultFolio(w, parent, { width = 2.6, height = 3.7, title, subtitle, lines = [], coverTitle = title, emblem = '', coverColor = '#633044', coverInk = '#ecdbaf' }) {
    const g = w.group(parent), rigid = w.group(g), { brass, bronze, paper } = w.materials;
    w.box(width + .22, height + .22, .18, bronze, rigid, V(0, 0, -.07));
    const page = documentSurface(w, rigid, { width, height, title, subtitle, lines });
    page.geometry.dispose(); page.geometry = new T.BoxGeometry(width, height, .075); page.material.side = T.FrontSide;
    const pageUV = page.geometry.getAttribute('uv');
    for (let i = 0; i < pageUV.count; i++) if (Math.floor(i / 4) !== 4) pageUV.setXY(i, .015 + pageUV.getX(i) * .003, .015 + pageUV.getY(i) * .003);
    const spine = cylinder(w, rigid, .065, height + .2, brass, V(-width / 2 - .06, 0, .05), .065, 24);
    for (const y of [-height * .36, height * .36]) cylinder(w, rigid, .105, .3, brass, V(-width / 2 - .06, y, .14), .105, 24);
    batchArchitecture(rigid);
    const cover = w.group(g); cover.position.set(-width / 2 - .06, 0, .14);
    for (const y of [-height / 2 - .04, height / 2 + .04]) w.box(width + .13, .045, .08, brass, cover, V(width / 2 + .06, y, 0));
    const front = documentSurface(w, cover, { width: width - .18, height: height - .18, title: coverTitle, subtitle, color: coverColor, ink: coverInk, emblem }); front.position.set(width / 2 + .06, 0, .04);
    const inside = documentSurface(w, cover, { width: width - .18, height: height - .18, title: 'Source\nretained.', subtitle: 'THE ORIGINAL STAYS WITH THE MATTER', lines: ['An inspectable contribution.', 'A considered next step.'], color: '#d8c8a8' });
    inside.position.set(width / 2 + .06, 0, -.04); inside.rotation.y = PI;
    // A single two-face atlas keeps the physical cover inexpensive to render.
    const atlas = document.createElement('canvas'); atlas.width = 1800; atlas.height = front.material.map.image.height;
    const paint = atlas.getContext('2d'); paint.drawImage(front.material.map.image, 0, 0); paint.drawImage(inside.material.map.image, 900, 0, 900, atlas.height);
    const map = new T.CanvasTexture(atlas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
    const coverGeometry = new T.BoxGeometry(width + .13, height + .15, .065), coverUV = coverGeometry.getAttribute('uv');
    for (let i = 0; i < coverUV.count; i++) {
        const face = Math.floor(i / 4);
        coverUV.setXY(i, face === 4 ? coverUV.getX(i) * .5 : face === 5 ? .5 + coverUV.getX(i) * .5 : .0075 + coverUV.getX(i) * .002, face >= 4 ? coverUV.getY(i) : .015 + coverUV.getY(i) * .003);
    }
    for (const surface of [front, inside]) { surface.removeFromParent(); surface.geometry.dispose(); surface.material.map.dispose(); surface.material.dispose(); }
    w.mesh(coverGeometry, new T.MeshStandardMaterial({ map, color: '#c6bdab', roughness: .66, metalness: .05 }), cover, V(width / 2 + .06, 0, 0));
    batchArchitecture(cover);
    return { group: g, cover, update(open) { cover.rotation.y = -2.25 * open; } };
}

function archiveCarrier(w, wheel, angle, words, index) {
    const { brass, bronze, iron } = w.materials;
    const gimbal = w.group(wheel); gimbal.position.set(Math.cos(angle) * 5.6, Math.sin(angle) * 5.6, 0);
    const rigid = w.group(gimbal);
    const axle = cylinder(w, rigid, .32, .5, bronze, V(0, 0, -.12), .32, 40); axle.rotation.x = PI / 2;
    ring(w, rigid, .36, .045, brass, V(0, 0, .16));
    for (const side of [-1, 1]) {
        w.beam(V(0, 0, .1), V(side * 1.16, -1.95, .2), .095, bronze, rigid);
        w.beam(V(side * 1.16, -1.95, .2), V(side * 1.16, -1.95, 2.85), .11, bronze, rigid);
    }
    w.beam(V(-1.2, -1.95, .18), V(1.2, -1.95, .18), .1, brass, rigid);
    batchArchitecture(rigid);
    // Nested, constant-length rails slide inside one another. No beam stretches,
    // and the drum is locked whenever a carrier leaves the vault.
    const stages = [];
    for (let stage = 0; stage < 2; stage++) {
        const stageGroup = w.group(gimbal), size = stage === 0 ? .14 : .105;
        for (const x of [-1.16, 1.16]) w.box(size, size, 2.85, stage === 0 ? bronze : brass, stageGroup, V(x, -1.95, 1.425));
        w.beam(V(-1.16, -2.025, 2.78), V(1.16, -2.025, 2.78), .045, stage === 0 ? bronze : brass, stageGroup);
        batchArchitecture(stageGroup); stages.push(stageGroup);
    }
    const carriage = w.group(gimbal), shoe = w.group(carriage);
    for (const x of [-1.16, 1.16]) {
        w.box(.27, .18, .34, bronze, shoe, V(x, -1.87, -.09));
        w.beam(V(x, -1.78, -.06), V(x, -1.54, -.06), .055, brass, shoe);
        const outside = Math.sign(x) * 1.7;
        w.beam(V(x, -1.9, 0), V(outside, -1.9, 0), .055, brass, shoe);
        const roller = cylinder(w, shoe, .105, .12, bronze, V(outside, -1.9, 0), .105, 28); roller.rotation.z = PI / 2;
    }
    batchArchitecture(shoe);
    const folio = vaultFolio(w, carriage, { title: words[0], subtitle: words[1], lines: words[2], emblem: ['I', 'II', 'III'][index], coverColor: ['#633044', '#bba780', '#394444'][index], coverInk: index === 1 ? '#322b25' : '#ecdbaf' });
    // Elevate the folio above every nested rail end while its backing remains
    // seated on the shoes. The larger upper corner still clears the open iris.
    folio.group.position.y = .18;
    const lamp = material(w.materials.glow, '#edcc8d', { emissiveIntensity: .1 });
    w.box(2.35, .065, .04, lamp, carriage, V(0, -1.5, .08));
    folio.cover.removeFromParent(); batchArchitecture(carriage); folio.group.add(folio.cover);
    return { group: gimbal, carriage, update(rotation, extension, open, active) {
        gimbal.rotation.z = -rotation;
        stages[0].position.z = extension / 2; stages[1].position.z = extension;
        carriage.position.z = 2.65 + extension; folio.update(open);
        lamp.emissiveIntensity = .1 + active * .65;
    } };
}

function vaultIris(w, fixed, moving) {
    const { brass, bronze, iron } = w.materials, center = V(0, 4.8, .8), housing = w.group(fixed); housing.position.copy(center);
    const dark = material(iron, '#30282b', { roughness: .44 });
    ring(w, housing, 3.65, .18, bronze); ring(w, housing, 3.2, .12, brass, V(0, 0, .35));
    ring(w, housing, 3.6, .08, brass, V(0, 0, -.2));
    for (const x of [-3.45, 3.45]) {
        w.box(.55, 2.5, 1.1, dark, fixed, V(x, 1.25, .8));
        w.box(1.1, .28, 1.6, brass, fixed, V(x, .14, .8));
    }
    const leaves = [], bladePose = new T.Object3D();
    const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(-3.25, .1); shape.quadraticCurveTo(-2.4, -.6, -.6, -.7); shape.quadraticCurveTo(-.12, -.45, 0, 0);
    const bladeGeometry = new T.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: false, curveSegments: 22 });
    const blades = new T.InstancedMesh(bladeGeometry, dark, 8); blades.castShadow = true; blades.receiveShadow = true; blades.frustumCulled = false; moving.add(blades);
    for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU, position = V(center.x + Math.cos(a) * 3.1, center.y + Math.sin(a) * 3.1, center.z + .015 + i * .019);
        const pin = cylinder(w, housing, .075, .32, brass, V(Math.cos(a) * 3.1, Math.sin(a) * 3.1, .1), .075, 20); pin.rotation.x = PI / 2;
        leaves.push({ position, a });
    }
    // The aperture's minimum open radius is 2.68. The travelling folio's
    // upper corner radius is 2.57, leaving clearance for its rails and bindings.
    return { update(open) { leaves.forEach(({ position, a }, i) => { bladePose.position.copy(position); bladePose.rotation.z = a + open * 1.08; bladePose.updateMatrix(); blades.setMatrixAt(i, bladePose.matrix); }); blades.instanceMatrix.needsUpdate = true; } };
}

function vaultGate(w, parent, side) {
    const g = w.group(parent); g.position.set(side * 8.46, 2.95, -2.3);
    const rigid = w.group(g), { brass, bronze, iron } = w.materials;
    const x = u => -side * u, top = u => 12 + 4.6 * Math.sin(u / 8.3 * PI / 2);
    w.beam(V(0, 0, 0), V(0, 12, 0), .14, bronze, rigid);
    w.beam(V(x(8.3), 0, 0), V(x(8.3), 16.6, 0), .13, brass, rigid);
    w.beam(V(0, 0, 0), V(x(8.3), 0, 0), .13, bronze, rigid);
    curve(w, rigid, Array.from({ length: 17 }, (_, i) => V(x(i / 16 * 8.3), top(i / 16 * 8.3), 0)), .14, brass);
    for (let i = 1; i < 11; i++) {
        const u = i / 11 * 8.3;
        w.beam(V(x(u), .5, 0), V(x(u), top(u), 0), .037, brass, rigid);
    }
    for (const y of [3.7, 8.5, 12]) w.beam(V(0, y, 0), V(x(8.3), y, 0), .055, bronze, rigid);
    for (let i = 0; i < 5; i++) {
        const a = i * 1.66, b = a + 1.66;
        w.beam(V(x(a), 3.7, .015), V(x(b), 8.5, .015), .03, bronze, rigid);
        w.beam(V(x(a), 8.5, .015), V(x(b), 3.7, .015), .03, bronze, rigid);
    }
    w.box(8.3, 1, .18, iron, rigid, V(x(4.15), .7, 0));
    const plaque = label(w, rigid, side < 0 ? 'SOURCES RETAINED' : 'REVIEW REMAINS YOURS', V(x(4.15), .7, .13), 5.3);
    for (const u of [1, 7.2]) {
        // The fork rides beside the overhead track; only its roller touches it.
        w.beam(V(x(u), top(u), 0), V(x(u), top(u), .26), .07, bronze, rigid);
        w.beam(V(x(u), top(u), .26), V(x(u), 17.73, .26), .07, bronze, rigid);
        w.beam(V(x(u), 17.73, .26), V(x(u), 17.73, 0), .055, bronze, rigid);
    }
    const rollers = new T.InstancedMesh(new T.CylinderGeometry(.18, .18, .16, 24), brass, 2), rollerPose = new T.Object3D(); rollers.castShadow = true; rollers.receiveShadow = true; rollers.frustumCulled = false; g.add(rollers);
    batchArchitecture(rigid);
    return { group: g, update(closed) {
        const travel = 8.65 * (1 - closed); g.position.x = side * (8.46 + travel);
        [1, 7.2].forEach((u, i) => { rollerPose.position.set(x(u), 17.73, 0); rollerPose.rotation.set(PI / 2, side * travel / .18, 0); rollerPose.updateMatrix(); rollers.setMatrixAt(i, rollerPose.matrix); }); rollers.instanceMatrix.needsUpdate = true;
    } };
}

function buildVigil(w) {
    const fixed = w.group(), moving = w.group(); fixed.name = 'vigil-indexed-evidence-vault';
    const { brass, bronze, iron } = w.materials;
    const stone = material(w.materials.stone, '#44373c', { roughness: .74, bumpScale: .075 });
    const limestone = material(w.materials.stone, '#8a7763', { roughness: .77, bumpScale: .045 });
    const dark = material(iron, '#302a2d', { roughness: .42 });
    const crimson = material(w.materials.cloth, '#702a3f', { sheen: .55, roughness: .65 });
    const floor = material(stone, '#343033', { roughness: .44, metalness: .2, bumpScale: .025 });
    w.box(160, .6, 160, floor, fixed, V(0, -.35, 0));
    w.box(92, 28, 2, stone, fixed, V(0, 13.7, -11.8));
    for (const x of [-44, 44]) w.box(2, 28, 75, stone, fixed, V(x, 13.7, 20));
    for (let i = -6; i <= 6; i++) {
        w.box(.045, .01, 65, bronze, fixed, V(i * 2.6, -.035, 12));
        w.box(40, .01, .045, bronze, fixed, V(0, -.035, i * 3));
    }
    for (const z of [-9, 3, 15]) {
        curve(w, fixed, [[-15, 0, z], [-15, 14, z], [-10, 21, z], [0, 24, z], [10, 21, z], [15, 14, z], [15, 0, z]], .23, limestone);
        for (const x of [-15, 15]) w.box(1.15, .55, 1.4, brass, fixed, V(x, .25, z));
    }
    // The circular archive is carried by masonry and a rear axle. Its folios
    // travel inside the arch's 8.2-unit clear radius, not through the stone.
    const vaultCenter = V(0, 10.4, -6.2);
    for (let i = 0; i < 48; i++) {
        const a = i / 48 * TAU, block = w.box(.95, 1.1, 2, limestone, fixed, V(Math.cos(a) * 8.8, 10.4 + Math.sin(a) * 8.8, -6.5)); block.rotation.z = a - PI / 2;
    }
    ring(w, fixed, 8.25, .12, brass, V(0, 10.4, -5.35));
    ring(w, fixed, 9.35, .09, bronze, V(0, 10.4, -5.7));
    for (const x of [-9.3, 9.3]) {
        w.box(2, 10.2, 5.5, stone, fixed, V(x, 5.1, -7.3));
        w.box(2.4, .5, 5.9, brass, fixed, V(x, .25, -7.3));
        w.box(1.1, 12, .18, crimson, fixed, V(x * 1.23, 10.1, -9.8));
    }
    w.box(3.2, 9.5, 2.6, dark, fixed, V(0, 4.75, -9));
    const rearAxle = cylinder(w, fixed, .65, 3.8, bronze, V(0, 10.4, -8.05), .65, 56); rearAxle.rotation.x = PI / 2;
    const wheel = w.group(moving); wheel.position.copy(vaultCenter);
    const wheelBody = w.group(wheel);
    ring(w, wheelBody, 7.75, .2, bronze); ring(w, wheelBody, 7.45, .075, brass, V(0, 0, .14));
    ring(w, wheelBody, 5.6, .13, iron, V(0, 0, -.15));
    const hub = cylinder(w, wheelBody, .85, .52, brass, V(0, 0, 0), .85, 64); hub.rotation.x = PI / 2;
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        w.beam(V(Math.cos(a) * .8, Math.sin(a) * .8, -.14), V(Math.cos(a) * 7.75, Math.sin(a) * 7.75, -.14), .085, bronze, wheelBody);
    }
    for (let i = 0; i < 72; i++) {
        const a = i / 72 * TAU, tooth = w.box(.22, .3, .24, brass, wheelBody, V(Math.cos(a) * 7.86, Math.sin(a) * 7.86, 0)); tooth.rotation.z = a;
    }
    batchArchitecture(wheelBody);
    const words = [
        ['The brief', '01 / FRAME THE QUESTION', ['The question to answer.', 'The boundaries that matter.']],
        ['The sources', '02 / TRACE THE CONTRIBUTION', ['Findings beside their sources.', 'Nothing loses its provenance.']],
        ['The review', '03 / KEEP THE RESPONSIBILITY', ['Who reviews the work.', 'What the next step requires.']],
    ];
    const carriers = words.map((text, i) => archiveCarrier(w, wheel, PI / 6 + i * TAU / 3, text, i));
    // The retrieval bridge is supported all the way from vault to review bay.
    w.box(4.3, .35, 9.6, limestone, fixed, V(0, 2.5, -1.65));
    for (const x of [-1.7, 1.7]) {
        for (const z of [-5.9, -.5, 2.45]) w.box(.45, 2.4, .6, dark, fixed, V(x, 1.2, z));
        w.box(.13, .12, 9.6, brass, fixed, V(x, 2.735, -1.65));
    }
    const iris = vaultIris(w, fixed, moving);
    const gates = [-1, 1].map(side => vaultGate(w, moving, side));
    w.beam(V(-18.5, 20.4, -2.3), V(18.5, 20.4, -2.3), .1, brass, fixed);
    for (const x of [-18, 18]) {
        w.box(.3, 20.4, .4, bronze, fixed, V(x, 10.2, -2.3));
        w.box(1.15, .35, 1.6, brass, fixed, V(x, .175, -2.3));
    }
    // The dossier's entire presentation is a supported lift and hinge. The
    // original source carriers are parked before the book or gates can move.
    w.box(6.3, 1.6, 7.4, limestone, fixed, V(0, .8, 6.35));
    w.box(6.45, .15, 7.55, bronze, fixed, V(0, 1.675, 6.35));
    for (const x of [-1.7, 1.7]) w.box(.2, .1, 5.6, iron, fixed, V(x, 1.89, 6.35));
    const lift = w.group(moving), hinge = w.group(lift), hingeBody = w.group(lift);
    for (const x of [-2.65, 2.65]) {
        cylinder(w, fixed, .13, 3.9, iron, V(x, 1.95, 9.15), .13, 32);
        cylinder(w, hingeBody, .25, .5, bronze, V(x, 0, 0), .25, 32);
        w.beam(V(x, 0, 0), V(x * .82, 0, 0), .12, brass, hingeBody);
    }
    w.beam(V(-2.65, 0, 0), V(2.65, 0, 0), .13, brass, hingeBody); batchArchitecture(hingeBody);
    const dossier = vaultFolio(w, hinge, { width: 4.3, height: 5.5, title: 'A considered\nnext step.', subtitle: 'DRAFT / FOR YOUR REVIEW', lines: ['01  Requirements retained.', '02  Sources remain inspectable.', '03  The decision remains yours.'], coverTitle: 'THE MATTER\nReady for review.' });
    dossier.group.position.y = 2.86;
    const tabs = words.map((text, i) => {
        const tab = w.group(dossier.group); tab.position.set(2.12, .95 - i * .95, .01);
        w.box(.45, .46, .1, brass, tab, V(.18, 0, 0));
        documentSurface(w, tab, { width: .34, height: .35, title: String(i + 1).padStart(2, '0'), color: '#9a744b', ink: '#f0e2be' }).position.set(.18, 0, .061);
        return tab;
    });
    label(w, fixed, 'THE EVIDENCE VAULT', V(0, 1.1, 10.18), 6, 'RETRIEVE. INSPECT. RETAIN.');
    batchArchitecture(fixed);
    const camera = flightPath([
        { p: 0, eye: [17, 13.5, 29], target: [0, 8.2, -2], fov: 48 },
        { p: .15, eye: [12, 10.5, 23], target: [0, 6.4, 1.5], fov: 48 },
        { p: .34, eye: [5, 10.1, 25], target: [0, 7, -.6], fov: 49 },
        { p: .53, eye: [-7, 9, 24], target: [-.4, 6.2, 1.1], fov: 48 },
        { p: .72, eye: [6, 10.2, 25], target: [0, 6.8, 3.2], fov: 48 },
        { p: 1, eye: [16, 15.5, 35], target: [0, 8.2, -.5], fov: 51 },
    ]);
    const stages = ['Retrieve the original', 'Follow every contribution', 'Bring the matter into review', 'Preserve the reasoning'];
    return { title: 'The Evidence Vault', stages, camera, environment: { background: '#1c171c', fog: '#30242d', key: '#ffe0b1', keyIntensity: 3.2, keyPosition: [-17, 27, 24], fill: '#b1a9b5', fillIntensity: .8, rim: '#d9c0a3', rimIntensity: .8, portraitDistance: 1.65 }, update(p) {
        const cycle = Math.min(2, Math.floor(p / .2)), local = Math.min(1, Math.max(0, (p - cycle * .2) / .2));
        const turns = Math.min(3, cycle + phase(local, 0, .2)), rotation = -TAU / 3 * turns;
        wheel.rotation.z = rotation;
        const aperture = p < .6 ? phase(local, .2, .29) * (1 - phase(local, .9, .98)) : 0;
        iris.update(aperture);
        carriers.forEach((carrier, i) => {
            const active = i === cycle && p < .6;
            const extension = active ? 5.8 * phase(local, .26, .4) * (1 - phase(local, .73, .89)) : 0;
            const opened = active ? phase(local, .41, .49) * (1 - phase(local, .64, .72)) : 0;
            carrier.update(rotation, extension, opened, active ? phase(local, .2, .35) * (1 - phase(local, .85, .98)) : 0);
        });
        lift.position.set(0, 2.1 + phase(p, .61, .78), 9.15);
        hinge.rotation.x = -PI / 2 * (1 - phase(p, .61, .8));
        dossier.update(phase(p, .76, .9));
        tabs.forEach((tab, i) => { tab.position.x = 2.12 + .28 * phase(p, i * .2 + .115, i * .2 + .14); });
        const preserved = phase(p, .84, 1); gates.forEach(gate => gate.update(preserved));
        const chapter = Math.min(3, Math.round(p * 3));
        w.narrative = { chapter, subject: 'Three supported source folios and one review dossier', action: stages[chapter], sourceCount: 3, sourcesRetained: true, activeSource: p < .6 ? cycle + 1 : null, drumTurns: turns / 3, carrierExtension: p < .6 ? 5.8 * phase(local, .26, .4) * (1 - phase(local, .73, .89)) : 0, irisOpen: aperture, dossierPresented: phase(p, .61, .8), preservation: preserved, registeredSections: [.14, .34, .54].filter(end => p >= end).length, grounded: true, automaticApproval: false };
    } };
}

export const experienceIntelligence = { wave: buildEcho, shield: buildVigil };

