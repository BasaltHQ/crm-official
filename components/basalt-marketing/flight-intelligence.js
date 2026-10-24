/* The voice has a route. The case keeps its sources.
 * These films are deterministic: scroll is the score, not an elapsed-time loop.
 * Only restrained membrane flutter and lamplight use ambient time. */
import { T, V, flightPath, batchArchitecture } from './flight-kit.js';

const PI = Math.PI;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const beat = (p, a, b) => smooth((p - a) / (b - a));
const mix = (a, b, u) => a + (b - a) * u;

// Bake only rigid opaque parts. Keep every changing object in its original
// hierarchy and preserve transparent sorting. Mirrored sails/covers are batched
// inside their own roots, so their determinant and triangle winding stay intact.
function batchRigid(root, animated = []) {
    const separate = new Set(animated);
    root.traverse(object => {
        if (!object.isMesh || !object.material?.transparent) return;
        let ancestor = object.parent;
        while (ancestor && ancestor !== root) {
            if (separate.has(ancestor)) return;
            ancestor = ancestor.parent;
        }
        separate.add(object);
    });
    const retained = [...separate].map(object => ({ object, parent: object.parent }));
    retained.forEach(({ object }) => object.removeFromParent());
    batchArchitecture(root);
    retained.forEach(({ object, parent }) => parent.add(object));
}

function route(points) {
    const curve = new T.CatmullRomCurve3(points.map(p => V(...p)), false, 'centripetal');
    return p => curve.getPoint(clamp(p));
}

function metal(base, color, roughness = .32) {
    const result = base.clone(); result.color.set(color); result.roughness = roughness;
    result.metalness = .74; return result;
}

function rib(w, points, radius, material, parent) {
    return w.tube(points.map(point => Array.isArray(point) ? V(...point) : point), radius, material, parent);
}

function cylinder(w, parent, radius, height, material, position, segments = 24) {
    return w.mesh(new T.CylinderGeometry(radius, radius, height, segments), material, parent, position);
}

function plaque(w, parent, position, text, subtitle = '', width = 3.2) {
    const plate = w.group(parent), height = width * .31;
    plate.position.copy(position);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ede3ca'; ctx.fillRect(0, 0, 1024, 320);
    ctx.strokeStyle = '#b69b6a'; ctx.lineWidth = 2; ctx.strokeRect(19, 19, 986, 282);
    ctx.fillStyle = '#3c443a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '42px Georgia'; ctx.fillText(text, 512, subtitle ? 121 : 162, 920);
    if (subtitle) {
        ctx.strokeStyle = '#b69b6a'; ctx.beginPath(); ctx.moveTo(350, 168); ctx.lineTo(674, 168); ctx.stroke();
        ctx.fillStyle = '#6e685b'; ctx.font = '26px Arial'; ctx.fillText(subtitle, 512, 218, 900);
    }
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 8;
    w.box(width, height, .035, w.materials.paper, plate);
    w.mesh(new T.PlaneGeometry(width * .992, height * .99), new T.MeshStandardMaterial({ map, roughness: .8 }), plate, V(0, 0, .022));
    return plate;
}

function deck(w, parent, position, width, depth) {
    const { brass, bronze, stone } = w.materials, g = w.group(parent); g.position.copy(position);
    w.box(width, .35, depth, stone, g, V(0, -.2, 0));
    for (let s of [-1, 1]) {
        w.beam(V(s * width / 2, 0, -depth / 2), V(s * width / 2, 0, depth / 2), .08, brass, g);
        for (let z of [-depth / 2, depth / 2]) {
            w.beam(V(s * width / 2, 0, z), V(s * width / 2, -4, z - 1.4), .13, bronze, g);
        }
    }
    return g;
}

/* A single curved membrane is pinned at both ends of its mast. The billow
 * vanishes on its sewn perimeter so sound never tears it away from the frame. */
function acousticSail(w, parent, position, side, index) {
    const g = w.group(parent); g.position.copy(position); g.scale.x = side;
    const { brass, bronze, iron, cloth, stone } = w.materials;
    const height = 21 + index * 1.6, width = 10.8 + index * .55, bow = 1.5;
    const material = cloth.clone(); material.color.set(index % 2 ? '#e5c887' : '#f1e1bc');
    material.emissive = new T.Color('#bb7927'); material.emissiveIntensity = .015; material.side = T.DoubleSide;
    const vertices = [], uv = [], indices = [], nx = 28, ny = 36;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = j / ny, v = i / nx, span = Math.pow(Math.sin(PI * u), .72);
        vertices.push(width * span * v, height * (u - .5), bow * Math.sin(PI * v) * Math.sin(PI * u));
        uv.push(v, u);
        if (i < nx && j < ny) { const k = j * (nx + 1) + i; indices.push(k, k + 1, k + nx + 2, k, k + nx + 2, k + nx + 1); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    const membrane = w.mesh(geo, material, g); membrane.name = `echo-anchored-acoustic-sail-${index}`;
    const top = V(0, height / 2, 0), bottom = V(0, -height / 2, 0);
    w.beam(bottom, top, .12, brass, g);
    const rim = Array.from({ length: 21 }, (_, i) => {
        const u = i / 20; return V(width * Math.pow(Math.sin(PI * u), .72), height * (u - .5), 0);
    });
    w.tube(rim, .065, brass, g);
    // Three sewn stiffeners make the membrane read as a crafted, immense sail.
    for (let k = 1; k <= 3; k++) {
        const v = k / 4;
        const seam = Array.from({ length: 25 }, (_, i) => {
            const u = i / 24;
            return V(width * Math.pow(Math.sin(PI * u), .72) * v, height * (u - .5), bow * Math.sin(PI * v) * Math.sin(PI * u) + .025);
        });
        w.tube(seam, .018, bronze, g);
    }
    // All suspension cables visibly terminate in the rock-side buttress.
    const rockTie = V(width + 4, height * .42, -8);
    w.beam(top, rockTie, .075, iron, g); w.beam(bottom, V(width + 4, -height * .32, -8), .075, iron, g);
    w.beam(V(width, 0, 0), V(width + 4, 3, -8), .055, bronze, g);
    w.box(1.8, height + 8, 3.1, stone, g, V(width + 4.5, -1, -8.2));
    for (let y of [-height / 2, height / 2]) {
        const pin = cylinder(w, g, .2, .44, brass, V(0, y, 0)); pin.rotation.x = PI / 2;
    }
    batchRigid(g, [membrane]);
    return {
        group: g,
        update(strength, p, t) {
            const data = geo.attributes.position;
            for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
                const u = j / ny, v = i / nx, k = j * (nx + 1) + i;
                const boundary = Math.sin(PI * v) * Math.sin(PI * u);
                const sound = Math.sin(u * 15 - p * 28) * .45 * strength;
                const wind = Math.sin(u * 8 + t * .55 + index) * .065;
                data.setZ(k, (bow + sound + wind) * boundary);
            }
            data.needsUpdate = true;
            material.emissiveIntensity = .015 + strength * .12;
        },
    };
}

function voiceShuttle(w, parent) {
    const g = w.group(parent), { brass, bronze, paper, glass } = w.materials;
    g.name = 'echo-one-voice-instrument';
    const ivory = paper.clone(); ivory.color.set('#f6e7bd'); ivory.side = T.DoubleSide;
    const goldenGlass = glass.clone(); goldenGlass.color.set('#efc873');
    const shell = new T.Shape();
    shell.moveTo(-3.8, -.15); shell.bezierCurveTo(-2.8, .8, 1.5, .9, 3.9, .12);
    shell.bezierCurveTo(2.1, -.7, -1.9, -.85, -3.8, -.15); shell.closePath();
    const reed = w.mesh(new T.ExtrudeGeometry(shell, { depth: .13, bevelEnabled: true, bevelThickness: .045, bevelSize: .045, bevelSegments: 3, curveSegments: 32 }), bronze, g, V(0, 0, -.12));
    reed.name = 'echo-bowed-bronze-reed'; reed.scale.y = .12;
    const profiles = [];
    for (let side of [-1, 1]) {
        const points = [[-3.9, -.04, .11], [-2, side * 1.05, .24], [.8, side * 1.24, .35], [3.9, .06, .11]];
        rib(w, points, .065, brass, g);
    }
    // An actual folded waveform, tensioned between two bronze reeds.
    const nx = 80, ny = 8, verts = [], ind = [], uvs = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const u = i / nx, v = j / ny, envelope = Math.sin(PI * u);
        verts.push((u - .5) * 7.3, (v - .5) * 1.75 * envelope, .27 + Math.sin(u * PI * 8) * .23 * envelope);
        uvs.push(u, v);
        if (i < nx && j < ny) { const k = j * (nx + 1) + i; ind.push(k, k + 1, k + nx + 2, k, k + nx + 2, k + nx + 1); }
    }
    const clothGeo = new T.BufferGeometry(); clothGeo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    clothGeo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); clothGeo.setIndex(ind); clothGeo.computeVertexNormals();
    w.mesh(clothGeo, ivory, g);
    for (let i = 0; i < 7; i++) {
        const x = (i - 3) * .85, h = Math.sin((i + 1) / 8 * PI) * .85;
        const vane = w.group(g); vane.position.set(x, 0, .65);
        w.box(.08, h * 2, .07, brass, vane); profiles.push(vane);
    }
    const lens = w.mesh(new T.SphereGeometry(.34, 32, 20), goldenGlass, g, V(0, 0, .66)); lens.scale.set(1, 1, .4);
    const line = plaque(w, g, V(0, -.72, .8), 'ONE SPOKEN QUESTION', 'A thought takes flight', 3.7); line.scale.setScalar(.6);
    const context = ['PERSONALITY', 'LANGUAGE', 'KNOWLEDGE'].map((word, i) => {
        const item = plaque(w, g, V((i - 1) * 2.08, .85, .48), word, '', 1.8);
        item.scale.setScalar(.72); return item;
    });
    const answer = plaque(w, g, V(0, -.7, .82), 'A THOUGHTFUL REPLY', 'The conversation continues', 3.7); answer.scale.setScalar(.6);
    batchRigid(g, [...profiles, ...context, line, answer, lens]);
    return { group: g, update(p, t) {
        const tuning = beat(p, .25, .48), reply = beat(p, .51, .62);
        context.forEach((item, i) => { const arrival = beat(p, .22 + i * .065, .34 + i * .065); item.visible = arrival > .005; item.position.y = mix(2.5, .85, arrival); item.scale.setScalar(.72 * Math.max(.001, arrival)); });
        line.visible = reply < .5; answer.visible = reply >= .5;
        profiles.forEach((vane, i) => { vane.rotation.y = Math.sin(p * 30 + i * .6) * .22 * (1 - tuning * .65) + Math.sin(t * .7 + i) * .025; });
        lens.material.emissive = new T.Color('#e4b65b'); lens.material.emissiveIntensity = .07 + reply * .15;
    } };
}

function buildEcho(w) {
    const set = w.group(w.root); set.name = 'echo-cathedral-of-listening';
    const { brass, bronze, iron, stone, green, glow } = w.materials;
    const sails = [
        acousticSail(w, set, V(-4.5, 11, 1), -1, 0),
        acousticSail(w, set, V(5.8, 12, -7), 1, 1),
        acousticSail(w, set, V(-4.5, 13, -16), -1, 2),
        acousticSail(w, set, V(5, 14, -24), 1, 3),
    ];
    // A harp-string route leads the eye deep into the ravine, never a ring tunnel.
    const outbound = [[0, 6, 15], [-1, 8, 6], [1, 11, -3], [0, 14, -14]];
    const returnRoute = [[0, 14, -14], [2.1, 13.2, -5], [1.5, 12.5, 4], [0, 20, 12]];
    const outPath = route(outbound), backPath = route(returnRoute);
    const track = new T.CatmullRomCurve3(outbound.map(x => V(...x)), false, 'centripetal');
    w.tube(track.getPoints(72), .034, brass, set);
    for (let s of [-1, 1]) {
        const cable = track.getPoints(72).map(v => v.add(V(s * .44, -.3, -.08)));
        w.tube(cable, .016, bronze, set);
    }
    const start = deck(w, set, V(0, 3.9, 15), 7.8, 4.7);
    plaque(w, start, V(0, 1.8, -.8), 'SAY THE FIRST THING', 'A question begins the journey', 4.4);
    const listen = deck(w, set, V(0, 11.5, -18), 10, 7);
    // The far chamber is a vaulted instrument with open sides, not a floating horn.
    for (let j = 0; j < 5; j++) {
        const z = -20 + j * 1.65;
        rib(w, [[-6, 11.5, z], [-5.5, 19.5, z], [0, 24, z], [5.5, 19.5, z], [6, 11.5, z]], .13, brass, set);
        w.beam(V(-6, 11.5, z), V(-13, -8, z - 4), .14, iron, set);
        w.beam(V(6, 11.5, z), V(13, -8, z - 4), .14, iron, set);
    }
    plaque(w, listen, V(0, 2, -2), 'LISTEN. RESPOND. CONTINUE.', 'A live exchange', 5);
    const shared = w.group(set); shared.name = 'echo-shared-listening-terraces';
    for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 13, y = 1 + i * 3, z = -8 - i * 6;
        const terrace = deck(w, shared, V(x, y, z), 7, 4);
        w.box(1.4, 34, 1.6, stone, terrace, V(-3, -17, -1.3));
        for (let j = 0; j < 4; j++) {
            const leaf = w.mesh(new T.SphereGeometry(.65, 10, 7), green, terrace, V(-2.4 + j * 1.5, .25, -1.5)); leaf.scale.set(1, .35, .65);
        }
        plaque(w, terrace, V(0, 1, 0), ['A CONVERSATION', 'A MEETING', 'A SHARED SESSION'][i], '', 4.3);
        const wire = [V(x, y + 1.8, z), V(x * .6, 10, z + 6), V(0, 18, 12)];
        w.tube(wire, .025, brass, set);
    }
    const shuttle = voiceShuttle(w, set);
    batchRigid(set, [...sails.map(sail => sail.group), shuttle.group]);
    const camera = flightPath([
        { p: 0, eye: [14, 10, 29], target: [0, 7, 12], fov: 43, roll: -.035 },
        { p: .18, eye: [12, 12, 19], target: [-1, 8, 5], fov: 47, roll: -.07 },
        { p: .38, eye: [12, 17, 6], target: [0, 12, -8], fov: 48, roll: .04 },
        { p: .55, eye: [10, 18, 0], target: [0, 14, -14], fov: 43, roll: 0 },
        { p: .72, eye: [13, 18, 16], target: [2, 13, -1], fov: 47, roll: -.045 },
        { p: 1, eye: [23, 31, 39], target: [0, 15, 2], fov: 53, roll: 0 },
    ]);
    return {
        title: 'The cathedral of listening',
        stages: ['A question takes flight', 'A voice finds its context', 'An answer finds its way back', 'An exchange becomes shared'],
        camera,
        update(p, t) {
            const outgoing = beat(p, .04, .49), returning = beat(p, .55, .98);
            const position = p < .53 ? outPath(outgoing) : backPath(returning);
            shuttle.group.position.copy(position);
            // This is a bidirectional acoustic shuttle on a tensioned route;
            // the reply travels back through it without hiding the voice face.
            shuttle.group.rotation.set(-.08 + Math.sin(p * PI) * .12, -.12 + Math.sin(p * PI) * .2, Math.sin(p * PI * 2) * .12);
            shuttle.update(p, t);
            sails.forEach((sail, i) => {
                const crest = .13 + i * .105;
                const strength = Math.exp(-(((p - crest) / .075) ** 2)) + .8 * Math.exp(-(((p - (.79 - i * .065)) / .055) ** 2));
                sail.update(Math.min(1, strength), p, t);
            });
            w.narrative = { chapter: Math.min(3, Math.floor(p * 4)), subject: 'One spoken question', action: p < .25 ? 'The question enters the listening corridor' : p < .5 ? 'Personality, language and knowledge tune the voice' : p < .75 ? 'A reply returns along the same path' : 'The exchange opens into shared sessions', anchoredSails: 4, returning: p >= .55, sourceRetained: true };
        },
    };
}

/* A source folio has a light-carrying spine and two articulated protective covers.
 * Thin source ribbons are sewn into that spine, not orphaned particles. */
function evidenceFolio(w, parent) {
    const g = w.group(parent), { brass, bronze, iron, paper, glass, glow } = w.materials;
    g.name = 'vigil-source-carrying-lantern-folio';
    const crimson = metal(bronze, '#672d35', .36), ivory = paper.clone(); ivory.color.set('#e8debf');
    const spine = w.box(.28, 5.4, .5, brass, g);
    w.box(.13, 4.8, .58, iron, g, V(0, 0, 0));
    const lantern = w.mesh(new T.BoxGeometry(.12, 3.75, .13), glow, g, V(0, 0, .36));
    const shellShape = new T.Shape(); shellShape.moveTo(0, 2.7); shellShape.bezierCurveTo(1.4, 2.9, 2.8, 2.3, 3.5, 1.4);
    shellShape.lineTo(3.1, -1.8); shellShape.quadraticCurveTo(1.7, -2.1, 0, -2.8); shellShape.closePath();
    const shellGeo = new T.ExtrudeGeometry(shellShape, { depth: .07, bevelEnabled: true, bevelThickness: .055, bevelSize: .055, bevelSegments: 3, curveSegments: 28 });
    const covers = [];
    for (let side of [-1, 1]) {
        const hinge = w.group(g); hinge.scale.x = side;
        w.mesh(shellGeo, crimson, hinge, V(0, 0, -.13));
        const inset = w.mesh(new T.ShapeGeometry(shellShape, 28), ivory, hinge, V(0, 0, .018)); inset.scale.set(.94, .94, 1);
        rib(w, [[0, 2.7, .08], [1.7, 2.5, .08], [3.5, 1.4, .08], [3.1, -1.8, .08], [0, -2.8, .08]], .045, brass, hinge);
        for (let i = 1; i <= 3; i++) {
            rib(w, [[.07, -1.4 + i * .95, .1], [1.7, -1.2 + i * .88, .1], [3.2, -.9 + i * .65, .1]], .022, bronze, hinge);
        }
        batchRigid(hinge);
        covers.push(hinge);
    }
    const question = plaque(w, g, V(0, .55, .75), 'THE MATTER', 'Requirements and context', 3.4); question.scale.setScalar(.92);
    const draft = plaque(w, g, V(0, -.8, .77), 'DRAFT / FOR REVIEW', 'The judgment stays with you', 3.4); draft.scale.setScalar(.92);
    // The retained sources are distinct vellum leaves, bound into the same spine.
    const sources = ['RESEARCH', 'DRAFTING', 'GOVERNANCE'].map((text, i) => {
        const leaf = plaque(w, g, V((i - 1) * 2.3, -3.5, .2), text, 'SOURCE RETAINED', 2);
        leaf.rotation.z = (i - 1) * -.14;
        const tether = rib(w, [[0, -.8, .42], [(i - 1) * 1.1, -2, .47], [(i - 1) * 2.3, -3.2, .2]], .024, brass, g);
        return { leaf, tether };
    });
    // The canopy-like top fin gives the case lift without turning it into another plane.
    rib(w, [[-3.5, 2.8, -.2], [-2, 4, -.9], [0, 4.5, -1.2], [2, 4, -.9], [3.5, 2.8, -.2]], .07, brass, g);
    const fin = w.mesh(new T.SphereGeometry(3.6, 40, 16, 0, PI * 2, 0, PI * .35), ivory, g, V(0, 2.3, -1.2));
    fin.scale.set(1, .6, .36); fin.material.side = T.DoubleSide;
    batchRigid(g, [...covers, question, draft, ...sources.flatMap(source => [source.leaf, source.tether])]);
    return { group: g, update(p) {
        const open = beat(p, .19, .42), review = beat(p, .48, .62), finish = beat(p, .75, .94);
        covers.forEach((cover, i) => { cover.rotation.y = (i ? -1 : 1) * mix(.95, .12, open) + (i ? -1 : 1) * finish * .18; });
        sources.forEach((source, i) => { const available = beat(p, .24 + i * .055, .35 + i * .055); source.leaf.visible = source.tether.visible = available > .03; source.leaf.scale.setScalar(Math.max(.001, available)); });
        draft.visible = review > .5;
        question.position.y = mix(.55, 1.2, review);
    } };
}

function sourceBeacon(w, parent, position, label, index) {
    const { brass, bronze, iron, stone, glass, glow } = w.materials, g = w.group(parent); g.position.copy(position);
    g.name = `vigil-${label.toLowerCase()}-source-buttress`;
    w.box(3.5, 34, 4, stone, g, V(0, -17, -1.8));
    deck(w, g, V(0, 0, 0), 5.5, 4.5);
    const housing = w.group(g); housing.position.set(0, 2, .8);
    const lanternGlass = glass.clone(); lanternGlass.color.set('#f2c499');
    w.box(1.9, 2.5, 1.35, lanternGlass, housing);
    const light = w.box(.32, 1.8, .28, glow, housing);
    for (let x of [-1, 1]) for (let z of [-.72, .72]) w.beam(V(x, -1.3, z), V(x, 1.3, z), .055, brass, housing);
    for (let y of [-1.3, 1.3]) {
        w.beam(V(-1, y, -.72), V(1, y, -.72), .055, brass, housing);
        w.beam(V(-1, y, .72), V(1, y, .72), .055, brass, housing);
    }
    const roof = w.mesh(new T.ConeGeometry(1.7, .85, 4), bronze, housing, V(0, 1.7, 0)); roof.rotation.y = PI / 4;
    plaque(w, g, V(0, -.75, 2.33), label, 'A visible contribution', 4.2);
    w.beam(V(0, .1, -1), V((index % 2 ? -1 : 1) * 5, 9, -9), .1, iron, g);
    return { group: g, light };
}

function buildVigil(w) {
    const set = w.group(w.root); set.name = 'vigil-passage-of-evidence';
    const { brass, bronze, iron, stone, glass } = w.materials;
    const beacons = [
        sourceBeacon(w, set, V(-8.5, 6, 4), 'RESEARCH', 0),
        sourceBeacon(w, set, V(8, 10, -5), 'DRAFTING', 1),
        sourceBeacon(w, set, V(-8, 14, -14), 'GOVERNANCE', 2),
    ];
    const course = route([[0, 5, 16], [-1.8, 7.5, 6], [1.6, 11.5, -3], [0, 15, -11], [0, 17, -13], [4, 23, -4], [3, 28, 10]]);
    // Source lines continue across the passage: context remains physically visible.
    const retainedLines = beacons.map((beacon, i) => {
        const a = beacon.group.position.clone().add(V(0, 2, 1.4));
        return rib(w, [a, V(a.x * .55, a.y + 1.5, a.z + 1), V((i - 1) * 4.2, 13.25, -13.4)], .032, brass, set);
    });
    // The review shelter is a high, open-ended vault: its roof rests on buttresses.
    const shelter = w.group(set); shelter.position.set(0, 12.5, -15.5);
    deck(w, shelter, V(0, 0, 0), 14, 8);
    for (let z of [-4, -1.3, 1.3, 4]) {
        rib(w, [[-7, 0, z], [-6.2, 8, z], [0, 12, z], [6.2, 8, z], [7, 0, z]], .16, brass, shelter);
        for (let side of [-1, 1]) {
            w.box(1.2, 28, 1.4, stone, shelter, V(side * 7.2, -14, z));
            w.beam(V(side * 7, 1, z), V(side * 11.5, -12, z - 3), .18, iron, shelter);
        }
    }
    // Small overlapping glass facets form a tangible weather canopy.
    const roofMat = glass.clone(); roofMat.color.set('#d1c8a4'); roofMat.opacity = .34; roofMat.transparent = true; roofMat.depthWrite = false;
    for (let side of [-1, 1]) for (let j = 0; j < 4; j++) {
        const panel = w.box(6.7, .06, 2.45, roofMat, shelter, V(side * 3.2, 9.4, -3.8 + j * 2.5));
        panel.rotation.z = side * -.4;
    }
    plaque(w, shelter, V(0, -.9, 4.08), 'MAKE TIME FOR JUDGMENT', 'Sources beside the draft', 5.8);
    // Sparse distant storm banners create scale, with no noisy particle weather.
    for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1, x = side * (22 + i * 6), y = 12 + i * 4, z = -22 - i * 4;
        const tower = w.group(set); tower.position.set(x, y, z);
        w.box(3, 55, 3, stone, tower, V(0, -25, 0));
        w.beam(V(0, 2, 0), V(side * 9, 5, 0), .14, bronze, tower);
        const banner = w.materials.cloth.clone(); banner.color.set('#552b35'); banner.side = T.DoubleSide;
        const flag = w.mesh(new T.PlaneGeometry(5, 12, 4, 14), banner, tower, V(side * 5, -3, 0)); flag.rotation.y = side * -.3;
        w.beam(V(side * 3, 3, 0), V(side * 7, 3, 0), .05, brass, tower);
    }
    const folio = evidenceFolio(w, set);
    batchRigid(set, [folio.group, ...retainedLines, ...beacons.map(beacon => beacon.light)]);
    const camera = flightPath([
        { p: 0, eye: [14, 11, 32], target: [0, 6, 14], fov: 43, roll: -.025 },
        { p: .2, eye: [12, 13, 19], target: [-1.5, 8, 5], fov: 47, roll: .045 },
        { p: .42, eye: [13, 17, 9], target: [0, 13, -6], fov: 46, roll: -.04 },
        { p: .64, eye: [12, 20, 4], target: [0, 17, -12], fov: 41, roll: 0 },
        { p: .79, eye: [16, 27, 13], target: [2, 21, -5], fov: 46, roll: -.04 },
        { p: 1, eye: [25, 38, 32], target: [0, 21, -3], fov: 53, roll: 0 },
    ]);
    return {
        title: 'The passage of evidence',
        stages: ['A question enters the weather', 'Every contribution has a source', 'A sheltered moment for judgment', 'The reasoning travels with the work'],
        camera,
        update(p, t) {
            // The review hold preserves the same frame before the final climb.
            const travel = p < .52 ? mix(0, .59, beat(p, 0, .52)) : p < .69 ? mix(.59, .64, beat(p, .52, .69)) : mix(.64, 1, beat(p, .69, 1));
            folio.group.position.copy(course(travel));
            folio.group.rotation.set(-.07 + beat(p, .72, .97) * -.12, Math.sin(p * PI * 1.8) * .17, Math.sin(p * PI * 2) * .095);
            folio.update(p);
            retainedLines.forEach((line, i) => { line.visible = p > .22 + i * .07; });
            beacons.forEach((beacon, i) => { const active = beat(p, .16 + i * .09, .28 + i * .09); beacon.light.scale.y = .6 + active * .4; });
            w.narrative = { chapter: Math.min(3, Math.floor(p * 4)), subject: 'One case with retained sources', action: p < .25 ? 'The question and constraints enter the passage' : p < .5 ? 'Research, drafting and governance establish a supported route' : p < .75 ? 'The draft pauses with its sources for judgment' : 'The reviewed context climbs into clearer weather', sourceCount: 3, sourcesRetained: true, automaticApproval: false, reviewHold: p >= .52 && p <= .69 };
        },
    };
}

export const flightIntelligence = { wave: buildEcho, shield: buildVigil };
