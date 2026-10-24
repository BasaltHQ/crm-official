/* An acoustic instrument and an illuminated evidence engine. Progress is their
 * score: every hinge, wave and optical movement reverses with the reader. */
import { T, v, range, mix, ground, panel, state } from './kinetic-kit.js';

const PI = Math.PI, TAU = PI * 2;

function metal(color, roughness = .28) {
    return new T.MeshPhysicalMaterial({ color, metalness: .82, roughness, clearcoat: .12, clearcoatRoughness: .3 });
}

function rim(w, radius, thickness, mat, parent, z = 0) {
    const mesh = w.mesh(new T.TorusGeometry(radius, thickness, 12, 112), mat, parent, v(0, 0, z));
    return mesh;
}

function bolts(w, parent, radius, z, mat, count = 24) {
    const mesh = new T.InstancedMesh(new T.CylinderGeometry(.028, .028, .024, 6), mat, count), dummy = new T.Object3D();
    for (let i = 0; i < count; i++) {
        const a = i / count * TAU;
        dummy.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z); dummy.rotation.set(PI / 2, 0, a); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    parent.add(mesh); return mesh;
}

function etchedDisk(w, c, parent, radius, title, subtitle, mat, z) {
    const map = c.texture((ctx, width, height) => {
        const cx = width / 2, cy = height / 2;
        ctx.clearRect(0, 0, width, height); ctx.strokeStyle = '#e7c58b'; ctx.fillStyle = '#e7c58b'; ctx.textAlign = 'center'; ctx.lineWidth = 1.7;
        for (let i = 0; i < 96; i++) {
            const a = i / 96 * TAU, outer = width * .472, inner = outer - (i % 8 ? 7 : 18);
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); ctx.stroke();
        }
        ctx.font = '500 22px Georgia'; ctx.fillText(title, cx, height * .27); ctx.font = '12px monospace'; ctx.fillText(subtitle, cx, height * .73);
        ctx.beginPath(); ctx.arc(cx, cy, width * .31, PI * .14, PI * .86); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, width * .31, PI * 1.14, PI * 1.86); ctx.stroke();
    }, 768, 768);
    return w.mesh(new T.CircleGeometry(radius, 96), new T.MeshStandardMaterial({ map, color: mat, transparent: true, roughness: .5, metalness: .15, depthWrite: false }), parent, v(0, 0, z));
}

function acousticHead(w, c, parent, position, radius, receiving = false) {
    const g = w.group(parent); g.name = receiving ? 'echo-answer-aperture' : 'echo-listening-diaphragm'; g.position.copy(position);
    const copper = metal(receiving ? '#a38351' : '#b77945'), pale = metal('#c8ae79', .34), dark = metal('#454840', .43);
    const ringGeo = new T.LatheGeometry([
        new T.Vector2(radius * .91, -.19), new T.Vector2(radius * .98, -.21), new T.Vector2(radius * 1.06, -.12),
        new T.Vector2(radius * 1.075, 0), new T.Vector2(radius * 1.04, .075), new T.Vector2(radius * .94, .09),
        new T.Vector2(radius * .91, .035),
    ], 112);
    const collar = w.mesh(ringGeo, copper, g); collar.rotation.x = PI / 2;
    rim(w, radius * 1.035, .026, pale, g, .08); rim(w, radius * .915, .013, dark, g, .094); bolts(w, g, radius * .99, .105, pale, 24);
    const geometry = new T.CircleGeometry(radius * .91, 112, 0, TAU);
    // A radial mesh with enough concentric vertices for a physically fixed rim.
    const positions = [], indices = [], radial = 26, angular = 112;
    for (let r = 0; r <= radial; r++) for (let a = 0; a <= angular; a++) {
        const angle = a / angular * TAU, distance = r / radial * radius * .91;
        positions.push(Math.cos(angle) * distance, Math.sin(angle) * distance, 0);
        if (r < radial && a < angular) { const i = r * (angular + 1) + a; indices.push(i, i + 1, i + angular + 2, i, i + angular + 2, i + angular + 1); }
    }
    geometry.dispose(); const surface = new T.BufferGeometry(); surface.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); surface.setIndex(indices); surface.computeVertexNormals();
    const membraneMat = metal(receiving ? '#c4b27f' : '#c59458', .42); membraneMat.side = T.DoubleSide;
    const membrane = w.mesh(surface, membraneMat, g, v(0, 0, .012)); membrane.name = 'resonant-copper-membrane';
    etchedDisk(w, c, g, radius * .88, receiving ? 'A considered answer' : 'Every voice matters', receiving ? '02 / RESPOND' : '01 / LISTEN', '#fff2d1', .058);
    const ribs = [];
    for (let i = 0; i < 7; i++) { const r = radius * (.12 + i * .104); const mesh = rim(w, r, .006, pale, g, .027); ribs.push({ mesh, r }); }
    // The visible trunnions and fork all meet the rigid outer collar.
    for (const side of [-1, 1]) {
        c.beam(v(side * radius * 1.065, -.05, -.1), v(side * radius * 1.065, -radius * 1.25, -.1), .08, .09, dark, g);
        const axle = c.cylinder(.115, .115, .16, pale, g, v(side * radius * 1.065, -.05, -.1), 24); axle.rotation.z = PI / 2;
    }
    c.beam(v(-radius * 1.065, -radius * 1.25, -.1), v(radius * 1.065, -radius * 1.25, -.1), .1, .1, dark, g);
    c.beam(v(0, -radius * 1.25, -.1), v(0, -position.y - 1.43, -.1), .17, .18, pale, g);
    const petals = [];
    if (receiving) for (let i = 0; i < 10; i++) {
        const arm = w.group(g), angle = i / 10 * TAU; arm.rotation.z = angle; arm.position.z = .115;
        const hinge = w.group(arm); hinge.position.y = radius * .86;
        const shape = new T.Shape(); shape.moveTo(-.16, 0); shape.quadraticCurveTo(-.43, -radius * .54, -.03, -radius * .93); shape.quadraticCurveTo(.31, -radius * .65, .18, -.05); shape.closePath();
        w.mesh(new T.ExtrudeGeometry(shape, { depth: .013, bevelEnabled: true, bevelSize: .007, bevelThickness: .007, bevelSegments: 2 }), i % 2 ? copper : pale, hinge);
        c.cylinder(.032, .032, .06, dark, hinge).rotation.x = PI / 2;
        petals.push(hinge);
    }
    function deform(p, strength) {
        const data = surface.attributes.position;
        for (let i = 0; i < data.count; i++) {
            const r = Math.hypot(data.getX(i), data.getY(i)) / (radius * .91);
            const edge = (1 - r * r) ** 2, wave = Math.sin(r * 25 - p * 36) * .062 * strength * edge;
            data.setZ(i, wave);
        }
        data.needsUpdate = true; surface.computeVertexNormals();
        for (const { mesh, r } of ribs) { const u = r / (radius * .91); mesh.position.z = .027 + Math.sin(u * 25 - p * 36) * .062 * strength * (1 - u * u) ** 2; }
    }
    return { g, membrane, petals, deform };
}

function resonantLeaf(w, c, parent, height, width, material, veinMaterial) {
    const shape = new T.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(-width * .48, height * .2, -width * .6, height * .77, 0, height); shape.bezierCurveTo(width * .6, height * .77, width * .48, height * .2, 0, 0);
    const mesh = w.mesh(new T.ExtrudeGeometry(shape, { depth: .024, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 20 }), material, parent);
    const veins = [];
    const vein = (points, radius) => veins.push(new T.TubeGeometry(new T.CatmullRomCurve3(points), 12, radius, 5, false));
    vein([v(0, 0, .04), v(0, height * .48, .055), v(0, height * .96, .04)], .012);
    for (let i = 1; i <= 4; i++) for (const side of [-1, 1]) {
        const y = height * (i * .15 + .1), dx = Math.sin(y / height * PI) * width * .32;
        vein([v(0, y, .045), v(side * dx * .6, y + height * .035, .045), v(side * dx, y + height * .07, .038)], .004);
    }
    // A single engraved mesh per leaf keeps the close-up detail affordable.
    const positions = [], normals = [], indices = [];
    for (const geometry of veins) {
        const offset = positions.length / 3;
        positions.push(...geometry.attributes.position.array); normals.push(...geometry.attributes.normal.array);
        indices.push(...Array.from(geometry.index.array, index => index + offset)); geometry.dispose();
    }
    const engraving = new T.BufferGeometry(); engraving.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); engraving.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); engraving.setIndex(indices);
    w.mesh(engraving, veinMaterial, parent);
    return mesh;
}

export function buildEcho(w, c) {
    ground(w, c, -1.9); w.kineticSubjects = [];
    const root = w.group(); root.name = 'the-resonance-garden'; root.rotation.y = -.08;
    const brass = metal('#c4a76a'), dark = metal('#35463f', .48), gold = metal('#bfa252', .35);
    const enamel = new T.MeshPhysicalMaterial({ color: '#9fa981', metalness: .12, roughness: .34, clearcoat: .5, clearcoatRoughness: .25, side: T.DoubleSide });
    const light = new T.MeshStandardMaterial({ color: '#ffde8b', emissive: '#e9ab39', emissiveIntensity: .45, roughness: .38, metalness: .36 });
    // One continuous spine supports both transducers and every resonant fin.
    w.path([v(-3.45, -1.43, 0), v(-2.7, -1.43, -.4), v(0, -1.43, -.38), v(2.7, -1.43, -.4), v(3.45, -1.43, 0)], .11, dark, root);
    for (const x of [-3.45, 0, 3.45]) {
        c.cylinder(.24, .31, .12, dark, root, v(x, -1.78, -.1), 48);
        c.cylinder(.075, .075, .32, brass, root, v(x, -1.57, -.1), 24);
    }
    const receive = acousticHead(w, c, root, v(3.2, .56, -.22), 1.02, true); receive.g.rotation.y = -.25;
    const listen = acousticHead(w, c, root, v(-3.2, .56, -.22), 1.28); listen.g.rotation.y = .25;
    w.kineticSubjects.push(listen.g, receive.g);
    const fins = [], count = 17;
    for (let i = 0; i < count; i++) {
        const x = -2.35 + i / (count - 1) * 4.7, h = 1.3 + .76 * Math.sin(i / (count - 1) * PI);
        const fork = w.group(root); fork.position.set(x, -1.39, -.38); fork.name = `voice-resonator-${i}`;
        c.cylinder(.065, .075, .18, brass, fork, v(0, .09), 20);
        c.beam(v(0, .16, 0), v(0, .46, 0), .035, .035, dark, fork);
        const pair = [];
        for (const side of [-1, 1]) {
            const hinge = w.group(fork); hinge.position.y = .46;
            resonantLeaf(w, c, hinge, h, .34, side > 0 ? enamel : gold, brass);
            const collar = c.cylinder(.05, .05, .1, brass, hinge, v(), 24); collar.rotation.z = PI / 2;
            pair.push({ hinge, side });
        }
        const bead = c.cylinder(.047, .047, .06, light.clone(), fork, v(0, .28, .05), 16); bead.rotation.x = PI / 2;
        fins.push({ fork, pair, bead, i }); w.kineticSubjects.push(fork, ...pair.map(x => x.hinge));
    }
    const ribbonPoints = 145, ribbonGeometry = new T.BufferGeometry(), ribbonPositions = new Float32Array(ribbonPoints * 2 * 3), ribbonIndices = [];
    for (let i = 0; i < ribbonPoints - 1; i++) { const n = i * 2; ribbonIndices.push(n, n + 1, n + 3, n, n + 3, n + 2); }
    ribbonGeometry.setAttribute('position', new T.BufferAttribute(ribbonPositions, 3)); ribbonGeometry.setIndex(ribbonIndices);
    const ribbonMat = new T.MeshStandardMaterial({ color: '#ffe1a1', emissive: '#f7ba4b', emissiveIntensity: .6, metalness: .6, roughness: .3, side: T.DoubleSide });
    const ribbon = w.mesh(ribbonGeometry, ribbonMat, root); ribbon.name = 'the-visible-conversation';
    const inscription = panel(w, c, { width: 2.85, height: .37, parent: root, position: v(0, -1.68, .15), depth: .025, draw: (ctx, width, height) => {
        ctx.fillStyle = '#293b32'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#e6d1a5'; ctx.font = '38px Georgia'; ctx.textAlign = 'center'; ctx.fillText('LISTEN   ·   UNDERSTAND   ·   ANSWER', width / 2, height * .63, width - 64);
    } }); inscription.rotation.x = -.35;
    w.anchor('assistant-context', receive.g, v(0, -1.2, .1));
    w.motions.push(p => {
        const hearing = range(p, .015, .2), carrying = range(p, .2, .55), answering = range(p, .53, .77), opening = range(p, .76, 1);
        listen.deform(p, Math.sin(hearing * PI) * .9 + (1 - opening) * .13); receive.deform(p + .14, Math.sin(answering * PI) * .75);
        receive.petals.forEach((petal, i) => { petal.rotation.z = -.17 + answering * .72; petal.rotation.x = opening * -.34 - answering * .12 + Math.sin(i * .63) * .012; });
        fins.forEach(({ pair, bead, i }) => {
            const at = i / (count - 1), wave = Math.sin((at - carrying) * PI * 6) * Math.exp(-(((at - carrying) * 4) ** 2)) * Math.sin(carrying * PI);
            pair.forEach(({ hinge, side }) => {
                hinge.rotation.x = side * mix(.08 + wave * .52, .93 - Math.sin(at * PI) * .23, opening);
                hinge.rotation.z = wave * .12 * (1 - opening);
            });
            bead.material.emissiveIntensity = .12 + Math.exp(-(((at - carrying) * 9) ** 2)) * .8 * (1 - opening) + opening * .45;
        });
        const visibleLength = mix(.001, 1, range(p, .07, .44));
        for (let i = 0; i < ribbonPoints; i++) {
            const u = i / (ribbonPoints - 1), x = -3.05 + Math.min(u, visibleLength) * 6.1;
            const envelope = Math.sin(u * PI), first = Math.sin(u * TAU * 3.5 - carrying * 7) * envelope * .28;
            const response = Math.sin(u * TAU * 2.5 + answering * 4) * envelope * .2;
            const y = -.55 + mix(first, response, answering) * (1 - opening * .6) + opening * .63 * envelope;
            ribbonPositions.set([x, y - .019, .22, x, y + .019, .22], i * 6);
        }
        ribbonGeometry.attributes.position.needsUpdate = true; ribbonGeometry.computeVertexNormals(); ribbonGeometry.computeBoundingSphere();
        const chapter = Math.min(3, Math.round(p * 3));
        w.caption = { speaker: ['THE VOICE', 'THE MEANING', 'THE ANSWER', 'THE CONVERSATION'][chapter], text: ['A single voice sets everything in motion.', 'The signal travels through a living instrument.', 'A considered answer opens the other side.', 'Two voices. One shared understanding.'][chapter] };
        state(w, p, { phase: ['listen', 'understand', 'answer', 'shared-understanding'][chapter], hearing, carrying, answering, canopy: opening, outcome: opening > .99 ? 'An open acoustic canopy connects the two voices.' : 'The connected instrument is carrying the conversation.' });
    });
    return { shots: [
        { p: 0, eye: [-3.15, 1.22, 3.5], look: [-3.18, .52, -.12], fov: 35 },
        { p: .19, eye: [-4.5, 1.55, 4.9], look: [-2.5, .2, -.15], fov: 38 },
        { p: .38, eye: [-.4, 1.2, 4.5], look: [.1, -.05, -.2], fov: 37 },
        { p: .64, eye: [4.6, 1.1, 3.65], look: [3.05, .6, -.1], fov: 35 },
        { p: .82, eye: [6, 4, 7.8], look: [.5, -.25, -.2], fov: 39 },
        { p: 1, eye: [4.9, 4.7, 10.7], look: [0, -.05, -.2], fov: 38 },
    ] };
}

function evidenceArtwork(title, kicker, lines, red = '#9e383c') {
    return (ctx, width, height) => {
        ctx.save(); ctx.scale(width / 640, height / 900);
        ctx.fillStyle = '#e8ddc3'; ctx.fillRect(0, 0, 640, 900); ctx.strokeStyle = '#997a51'; ctx.lineWidth = 2; ctx.strokeRect(22, 22, 596, 856); ctx.strokeRect(29, 29, 582, 842);
        ctx.fillStyle = red; ctx.font = '18px monospace'; ctx.fillText(kicker, 48, 72, 544); ctx.fillStyle = '#30291f'; ctx.font = '45px Georgia'; ctx.fillText(title, 48, 132, 544);
        ctx.fillStyle = '#997a51'; ctx.fillRect(48, 154, 544, 2); ctx.font = '22px Georgia';
        lines.forEach((line, i) => { ctx.fillStyle = i === 2 ? red : '#493c2e'; ctx.fillText(line, 48, 205 + i * 35, 544); });
        // An illuminated source tree makes provenance legible even when the
        // camera is too far away to read the typesetting.
        ctx.strokeStyle = '#927044'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(320, 725); ctx.lineTo(320, 423); ctx.bezierCurveTo(170, 365, 94, 440, 128, 536); ctx.bezierCurveTo(157, 607, 253, 598, 320, 646); ctx.bezierCurveTo(405, 597, 497, 617, 520, 531); ctx.bezierCurveTo(550, 440, 468, 371, 320, 423); ctx.stroke();
        for (const [x, y, label] of [[178, 480, 'SOURCE'], [462, 480, 'CONTEXT'], [320, 619, 'REASON']]) {
            ctx.strokeStyle = red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 51, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#927044'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 43, 0, TAU); ctx.stroke();
            ctx.fillStyle = red; ctx.textAlign = 'center'; ctx.font = '16px monospace'; ctx.fillText(label, x, y + 6);
            for (let j = 0; j < 12; j++) { const a = j / 12 * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 57, y + Math.sin(a) * 57); ctx.lineTo(x + Math.cos(a) * 62, y + Math.sin(a) * 62); ctx.stroke(); }
        }
        ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(320, 720); ctx.lineTo(343, 743); ctx.lineTo(320, 766); ctx.lineTo(297, 743); ctx.closePath(); ctx.fill();
        for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { const y = 412 + i * 49, x = 320 + side * (204 + Math.sin(i * .6) * 13); ctx.strokeStyle = '#9c875c'; ctx.beginPath(); ctx.ellipse(x, y, 9, 21, side * .7, 0, TAU); ctx.stroke(); }
        ctx.textAlign = 'left'; ctx.fillStyle = '#5b4837'; ctx.font = '18px Georgia'; ctx.fillText('Keep the evidence. Preserve the reasoning.', 48, 818, 544);
        ctx.font = '11px monospace'; ctx.fillStyle = '#78664f'; ctx.fillText('BASALT VIGIL / ILLUSTRATIVE EVIDENCE', 48, 850); ctx.restore();
    };
}

function shieldShape(width, height) {
    const shape = new T.Shape(); shape.moveTo(0, -height * .5); shape.bezierCurveTo(-width * .43, -height * .27, -width * .5, height * .01, -width * .5, height * .27);
    shape.lineTo(-width * .5, height * .42); shape.quadraticCurveTo(-width * .23, height * .41, 0, height * .5); shape.quadraticCurveTo(width * .23, height * .41, width * .5, height * .42);
    shape.lineTo(width * .5, height * .27); shape.bezierCurveTo(width * .5, height * .01, width * .43, -height * .27, 0, -height * .5); return shape;
}

export function buildVigil(w, c) {
    ground(w, c, -1.9); w.kineticSubjects = [];
    const root = w.group(); root.name = 'the-illuminated-evidence-folio';
    const brass = metal('#bc9a66'), dark = metal('#4d3439', .46), scarlet = new T.MeshPhysicalMaterial({ color: '#8d333d', roughness: .46, metalness: .15, clearcoat: .25 });
    const paper = new T.MeshStandardMaterial({ color: '#e8ddc3', roughness: .8, side: T.DoubleSide });
    const book = w.group(root); book.position.set(0, -.65, 0); book.name = 'the-source-folio';
    c.cylinder(.11, .11, 3.25, brass, book, v(0, 1.35, -.09), 32);
    for (const y of [-.19, .5, 1.35, 2.2, 2.92]) { const ring = w.ring(.13, .025, dark, book); ring.rotation.x = PI / 2; ring.position.set(0, y, -.09); }
    const covers = [];
    for (const side of [-1, 1]) {
        const hinge = w.group(book); hinge.name = side < 0 ? 'source-left-cover' : 'source-right-cover';
        w.box(1.65, 3.05, .11, scarlet, hinge, v(side * .84, 1.36, -.1));
        const leaf = panel(w, c, { width: 1.52, height: 2.86, parent: hinge, position: v(side * .84, 1.36, -.026), material: paper, frame: false, depth: .045,
            draw: evidenceArtwork(side < 0 ? 'The source' : 'The question', side < 0 ? '01 / ORIGINAL RECORD' : '02 / REVIEW IN CONTEXT', side < 0 ? ['Every clause has a context.', 'Keep the original close.', 'A claim is linked to its source.', 'Evidence stays visible.', 'Reasoning can be followed.'] : ['The material is assembled.', 'The relevant passages emerge.', 'A disputed line needs review.', 'Compare the exact wording.', 'Make a considered decision.']) });
        for (let i = 0; i < 7; i++) w.box(1.5, 2.85, .007, i % 2 ? paper : c.paper, hinge, v(side * .84, 1.36, -.06 - i * .006));
        for (const y of [-.1, 2.82]) { w.box(1.72, .036, .15, brass, hinge, v(side * .84, y, -.075)); }
        covers.push({ hinge, side, leaf }); w.kineticSubjects.push(hinge);
    }
    // Visible construction: the folio is carried by a hinged spine, not suspended.
    for (const x of [-.5, .5]) {
        c.beam(v(x, -1.8, -.45), v(0, -.7, -.08), .09, .1, brass, root);
        c.beam(v(x, -1.8, -.45), v(x * 1.2, -1.8, .55), .07, .09, dark, root);
    }
    const layers = [];
    const titles = ['The obligation', 'The exception', 'The decision'];
    for (let i = 0; i < 3; i++) {
        const g = w.group(root); g.name = `evidence-layer-${i}`;
        const card = panel(w, c, { width: 1.24, height: 1.8, parent: g, material: paper, depth: .035, draw: evidenceArtwork(titles[i], `0${i + 3} / SOURCE-LINKED EXCERPT`, ['The relevant passage.', 'The surrounding context.', ['The duty is explicit.', 'The exception is conditional.', 'The reasoning is retained.'][i], 'Read together, in full.']) });
        card.position.y = .75; layers.push(g); w.kineticSubjects.push(g);
        const hinge = c.cylinder(.055, .055, .23, brass, g, v(0, -.2, -.05), 20); hinge.rotation.z = PI / 2;
    }
    // A two-axis optical carriage visibly traces the disputed line.
    const rail = w.group(root); rail.name = 'source-comparison-rail'; rail.position.set(0, -.97, .76);
    c.beam(v(-2.6, 0), v(2.6, 0), .075, .075, dark, rail);
    for (const x of [-2.6, 2.6]) c.beam(v(x, 0, 0), v(x, -.83, -.1), .07, .07, brass, rail);
    const carriage = w.group(rail); const lensArm = c.beam(v(0, 0), v(0, 1.2), .055, .055, brass, carriage);
    const lens = w.group(carriage); lens.position.set(0, 1.65, 0); lens.name = 'the-source-tracing-optic';
    rim(w, .45, .048, brass, lens); rim(w, .386, .012, dark, lens, .02);
    w.mesh(new T.CircleGeometry(.382, 64), new T.MeshPhysicalMaterial({ color: '#d0e0d7', transparent: true, opacity: .16, roughness: .12, metalness: .15, side: T.DoubleSide, depthWrite: false }), lens, v(0, 0, .006));
    for (const x of [-.22, .22]) w.path([v(x, -.13, .025), v(x, .13, .025)], .005, brass, lens);
    w.path([v(-.16, 0, .025), v(.16, 0, .025)], .005, brass, lens);
    const highlight = w.box(.95, .09, .007, new T.MeshBasicMaterial({ color: '#c56456', transparent: true, opacity: .25, depthWrite: false }), root, v(.9, 1.01, .09));
    const lensLabel = panel(w, c, { width: .96, height: .19, parent: carriage, position: v(0, .12, .045), depth: .015, draw: (ctx, width, height) => { ctx.fillStyle = '#443136'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#e7cf9f'; ctx.font = '15px monospace'; ctx.textAlign = 'center'; ctx.fillText('TRACE TO SOURCE', width / 2, height * .7); } });
    w.kineticSubjects.push(carriage, lens);
    const shield = w.group(root); shield.name = 'the-evidence-vault'; shield.position.set(0, .5, -.5);
    const glassMat = new T.MeshPhysicalMaterial({ color: '#ac6972', transparent: true, opacity: .13, roughness: .14, metalness: .15, side: T.DoubleSide, depthWrite: false, clearcoat: .6 });
    const shieldGeometry = new T.ShapeGeometry(shieldShape(4.25, 4.55), 40), vault = w.mesh(shieldGeometry, glassMat, shield, v(0, 0, .02));
    const outlinePoints = shieldShape(4.25, 4.55).getPoints(64).map(point => v(point.x, point.y, .045));
    const outline = w.path(outlinePoints, .032, brass, shield); outline.name = 'vault-brass-binding';
    const innerPoints = outlinePoints.map(point => point.clone().multiplyScalar(.947)); w.path(innerPoints, .009, new T.MeshBasicMaterial({ color: '#df9c85' }), shield);
    const wings = [];
    for (const side of [-1, 1]) {
        const hinge = w.group(shield); hinge.position.set(side * 2.125, 1.91, 0);
        const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(-side * 1.9, -.28); shape.lineTo(-side * 1.9, -3.55); shape.lineTo(0, -2.2); shape.closePath();
        w.mesh(new T.ShapeGeometry(shape), glassMat, hinge);
        w.path(shape.getPoints(12).map(point => v(point.x, point.y, .015)), .024, brass, hinge);
        wings.push({ hinge, side }); w.kineticSubjects.push(hinge);
    }
    const seal = w.group(shield); seal.position.set(0, -1.78, .2); rim(w, .23, .027, brass, seal);
    const sealDisk = w.mesh(new T.CircleGeometry(.22, 48), scarlet, seal); sealDisk.position.z = .005;
    const check = w.path([v(-.095, 0, .025), v(-.025, -.065, .025), v(.11, .09, .025)], .015, brass, seal); check.name = 'review-complete';
    w.kineticSubjects.push(shield, seal); w.anchor('brief', book, v(.8, 1.4, .02)); w.anchor('governance-shield', shield, v(0, 2.28, .2));
    w.motions.push(p => {
        const open = range(p, .015, .22), extract = range(p, .22, .47), compare = range(p, .43, .68), bind = range(p, .69, .93), complete = range(p, .9, 1);
        covers.forEach(({ hinge, side }) => { hinge.rotation.y = side * mix(-1.38, -.09, open) + side * bind * -.16; });
        layers.forEach((g, i) => {
            const spread = (i - 1) * 2.05;
            g.position.set(mix((i - 1) * .08, spread, extract) * (1 - bind), mix(mix(-.15, 1.05 + (i === 1 ? .32 : 0), extract), .02 + i * .018, bind), mix(-.08 - i * .025, .25 + i * .13, extract) + bind * (.18 + i * .045));
            g.rotation.y = (i - 1) * -.14 * extract * (1 - bind); g.rotation.z = (i - 1) * -.07 * extract * (1 - bind);
            g.scale.setScalar(mix(.82, 1, extract) - bind * .12); g.visible = p > .14;
        });
        carriage.position.x = mix(2.4, -.68, compare); carriage.position.y = Math.sin(compare * PI) * .15; carriage.position.z = bind * -.34;
        lens.position.y = mix(1.65, 2.58, compare); lensArm.scale.y = (lens.position.y - .45) / 1.2; lensArm.position.y = (lens.position.y - .45) / 2;
        rail.visible = p > .3 && p < .84; lensLabel.visible = rail.visible;
        highlight.position.set(mix(.85, -.68, compare), mix(1.01, 1.61, compare), .105 + extract * .15); highlight.material.opacity = .28 * Math.sin(compare * PI); highlight.visible = p > .3 && p < .73;
        shield.visible = p > .69; shield.scale.setScalar(mix(.86, 1, bind)); shield.position.z = mix(-.8, -.27, bind); vault.material.opacity = .13 * bind;
        wings.forEach(({ hinge, side }) => { hinge.rotation.y = side * mix(-1.35, -.28, bind); });
        seal.scale.setScalar(mix(.05, 1, complete)); seal.rotation.z = (1 - complete) * -.8;
        const chapter = Math.min(3, Math.round(p * 3));
        w.caption = { speaker: ['THE RECORD', 'THE CONTEXT', 'THE REASONING', 'THE FINISHED BRIEF'][chapter], text: ['Open the original. Keep every source close.', 'Relevant passages emerge with their context.', 'Follow the exact line back to the evidence.', 'A clear decision, bound to the reasoning behind it.'][chapter] };
        state(w, p, { phase: ['source', 'context', 'review', 'bound-evidence'][chapter], open, extract, compare, binding: bind, outcome: complete > .99 ? 'The finished evidence folio is bound inside its protective vault.' : 'Source passages remain connected during the review.' });
    });
    return { shots: [
        { p: 0, eye: [1.6, 1.65, 4.3], look: [.15, .85, -.05], fov: 34 },
        { p: .2, eye: [-2.65, 2.45, 6.1], look: [0, .8, 0], fov: 38 },
        { p: .38, eye: [2.6, 3.4, 7.6], look: [.1, 1.15, .05], fov: 38 },
        { p: .61, eye: [-1.1, 2.2, 3.2], look: [-.28, 1.4, .48], fov: 35 },
        { p: .8, eye: [-3.1, 2.15, 6.65], look: [0, .6, .1], fov: 38 },
        { p: 1, eye: [3.1, 2.55, 7.6], look: [0, .55, 0], fov: 38 },
    ] };
}
