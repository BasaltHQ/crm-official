/* Inhabited Basalt worlds: hand-built architecture, useful tools, and human-scale work. */
import { THREE as T } from './three-runtime.js';
import { createFigure } from './figure-study.js';
import { directNarrative } from './narrative-acting.js';
const TAU = Math.PI * 2;
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const seed = i => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const key = (p, values) => { const i = Math.min(2, Math.floor(p * 3)), t = ease(p * 3 - i); return typeof values[0] === 'number' ? T.MathUtils.lerp(values[i], values[i + 1], t) : values[i].clone().lerp(values[i + 1], t); };

const palettes = {
    network: ['#557977', '#283e3c', '#7d8c83', '#b09b6b', '#4b8e82'],
    crystal: ['#615669', '#272431', '#706e7e', '#b4a28c', '#756a8e'],
    constellation: ['#8e7859', '#373e44', '#baae91', '#baa274', '#5c8094'],
    modules: ['#879d98', '#293d40', '#a3a99a', '#b08a63', '#428b8c'],
    pages: ['#a69583', '#484051', '#c3b7a0', '#b9a080', '#9080a6'],
    wave: ['#9a7345', '#39342b', '#8b886b', '#c09857', '#7b8761'],
    shield: ['#735151', '#302d34', '#9b8c84', '#b5a58c', '#735561'],
};
export function craft(w, kind) {
    const { root, group, mesh, box, ring, path } = w;
    const texture = (draw, width = 512, height = 512) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); if (ctx) draw(ctx, width, height);
        const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4; return map;
    };
    const palette = palettes[kind];
    const wood = new T.MeshStandardMaterial({ color: palette[0], roughness: .82, flatShading: true });
    const darkwood = new T.MeshStandardMaterial({ color: palette[1], roughness: .76, flatShading: true });
    const stone = new T.MeshStandardMaterial({ color: palette[2], roughness: .92, flatShading: true });
    const brass = new T.MeshPhysicalMaterial({ color: palette[3], metalness: .58, roughness: .43, flatShading: true });
    const copper = new T.MeshStandardMaterial({ color: palette[4], metalness: .45, roughness: .6, flatShading: true });
    const iron = new T.MeshStandardMaterial({ color: '#302b22', metalness: .73, roughness: .43 });
    const paper = new T.MeshStandardMaterial({ color: '#e6d5af', roughness: .85 });
    const green = new T.MeshStandardMaterial({ color: '#526450', roughness: .88, side: T.DoubleSide, flatShading: true });
    const greenLight = new T.MeshStandardMaterial({ color: '#7d8c68', roughness: .88, side: T.DoubleSide, flatShading: true });
    const terra = new T.MeshStandardMaterial({ color: '#9c563a', roughness: .96 });
    const cloth = new T.MeshStandardMaterial({ color: w.accent.clone().lerp(new T.Color('#938769'), .32), roughness: .94, side: T.DoubleSide });
    const amber = new T.MeshBasicMaterial({ color: new T.Color('#ffcf7b').multiplyScalar(1.4) });
    const cylinder = (r1, r2, h, mat, parent = root, position = v(), sides = 12) => mesh(new T.CylinderGeometry(r1, r2, h, sides), mat, parent, position);
    const structuralLine = new T.LineBasicMaterial({ color: w.accent.clone().lerp(new T.Color('#dcc9a0'), .35), transparent: true, opacity: .27, depthWrite: false });
    function drawing(geometry, parent = root, position = v(), triangles = false) {
        const wire = new T.LineSegments(triangles ? new T.WireframeGeometry(geometry) : new T.EdgesGeometry(geometry, 24), structuralLine); wire.position.copy(position); parent.add(wire); geometry.dispose(); return wire;
    }
    function solid(object, name) { object.name = name; w.solids.push(object); return object; }
    function floor(width, depth, y = -1.43) {
        const g = group();
        const surface=mesh(new T.PlaneGeometry(24,24),new T.ShadowMaterial({color:'#000000',opacity:.23}),g,v(0,y+.04));surface.rotation.x=-Math.PI/2;
        const geometry=new T.PlaneGeometry(width*2,depth*2,Math.ceil(width*2),Math.ceil(depth*2));
        const ink=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:w.accent.clone().lerp(new T.Color('#baa786'),.5)},extent:{value:new T.Vector2(width,depth)}},
            vertexShader:'varying vec2 at;void main(){at=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
            fragmentShader:'uniform vec3 tint;uniform vec2 extent;varying vec2 at;void main(){float fade=1.-smoothstep(.25,1.,length(at/extent));gl_FragColor=vec4(tint,fade*.16);}'});
        const grid=new T.LineSegments(new T.WireframeGeometry(geometry),ink);geometry.dispose();g.add(grid);grid.position.y=y+.043;grid.rotation.x=-Math.PI/2;
        return g;
    }
    function beam(a, b, width, depth, mat = wood, parent = root) {
        const m = box(width, a.distanceTo(b), depth, mat, parent, a.clone().add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize()); return m;
    }
    function gear(radius, parent = root, mat = brass, teeth = 18) {
        const g = group(parent), shape = new T.Shape();
        for (let i = 0; i < teeth * 4; i++) { const a = i / (teeth * 4) * TAU, r = radius * (i % 4 === 1 || i % 4 === 2 ? 1.1 : 1); if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); } shape.closePath();
        const hole = new T.Path(); hole.absarc(0, 0, radius * .69, 0, TAU, true); shape.holes.push(hole);
        mesh(new T.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelSize: .009, bevelThickness: .009, bevelSegments: 2, steps: 1 }), mat, g);
        const hub = cylinder(radius * .16, radius * .16, .13, mat, g, v(0, 0, .04)); hub.rotation.x = Math.PI / 2;
        for (let i = 0; i < 6; i++) { const spoke = box(radius * 1.3, .045, .055, mat, g, v(0, 0, .035), .008); spoke.rotation.z = i * Math.PI / 3; }
        return g;
    }
    function lantern(parent = root, position = v(), size = 1) {
        const g = group(parent); g.position.copy(position); g.scale.setScalar(size);
        box(.3, .055, .3, iron, g, v(0, -.2)); box(.3, .05, .3, brass, g, v(0, .2)); box(.21, .32, .21, amber, g);
        for (const x of [-.13, .13]) for (const z of [-.13, .13]) box(.018, .4, .018, iron, g, v(x, 0, z), .003);
        const cap = mesh(new T.ConeGeometry(.25, .15, 4), copper, g, v(0, .28)); cap.rotation.y = Math.PI / 4;
        const hook = ring(.075, .011, brass, g); hook.position.y = .4;
        return g;
    }
    function plant(parent = root, position = v(), size = 1, hanging = false) {
        const g = group(parent); g.position.copy(position); g.scale.setScalar(size);
        cylinder(.19, .13, .26, terra, g, v(0, .13)); cylinder(.2, .2, .045, terra, g, v(0, .27)); cylinder(.17, .17, .012, darkwood, g, v(0, .28));
        const leaves = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), green, 44), dummy = new T.Object3D(); g.add(leaves);
        for (let stem = 0; stem < 4; stem++) {
            const a = stem * 2.4, height = .5 + seed(stem + 2) * .5;
            const end = v(Math.cos(a) * .35, hanging ? -.5 : height, Math.sin(a) * .35);
            path([v(0, .26), v(end.x * .4, hanging ? .5 : height * .7, end.z * .4), end], .014, green, g);
            for (let j = 0; j < 11; j++) { const s = j / 10, side = j % 2 ? 1 : -1; dummy.position.copy(v(0, .29).lerp(end, s)).add(v(Math.cos(a + 1.5) * .11 * side, .05, Math.sin(a + 1.5) * .11 * side)); dummy.rotation.set(.2 + seed(j) * .4, -a + side * .6, side * .6); dummy.scale.set(.07 + .04 * Math.sin(s * Math.PI), .023, .16); dummy.updateMatrix(); leaves.setMatrixAt(stem * 11 + j, dummy.matrix); }
        }
        return g;
    }
    function arch(parent, width = 2.2, height = 2.8, position = v(), stained = true) {
        const g = group(parent); g.position.copy(position);
        const outline = [v(-width / 2, 0), v(-width / 2, height * .6), v(-width * .4, height * .83), v(0, height), v(width * .4, height * .83), v(width / 2, height * .6), v(width / 2, 0)];
        path(outline, .095, darkwood, g); path(outline.map(p => p.clone().multiply(v(.9, .97, 1))), .025, brass, g);
        if (stained) {
            const shape = new T.Shape(); shape.moveTo(-width / 2 + .08, 0); shape.lineTo(-width / 2 + .08, height * .58); shape.bezierCurveTo(-width / 2 + .08, height * .81, -width * .18, height * .95, 0, height - .08); shape.bezierCurveTo(width * .18, height * .95, width / 2 - .08, height * .81, width / 2 - .08, height * .58); shape.lineTo(width / 2 - .08, 0); shape.closePath();
            const map = texture((ctx, cw, ch) => {
                ctx.fillStyle = '#b8aa63'; ctx.fillRect(0, 0, cw, ch); const color = '#' + w.accent.getHexString();
                for (let y = -64; y < ch + 64; y += 64) for (let x = -32; x < cw + 32; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 32, y + 32); ctx.lineTo(x, y + 64); ctx.lineTo(x - 32, y + 32); ctx.closePath(); ctx.fillStyle = ((x + 32) / 64 + y / 64) % 3 === 0 ? color : (y / 64) % 2 === 0 ? '#c9b66b' : '#708d68'; ctx.globalAlpha = .6; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#5f543a'; ctx.lineWidth = 3; ctx.stroke(); }
            });
            const geo = new T.ShapeGeometry(shape, 24), uv = geo.attributes.uv, pos = geo.attributes.position;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + width / 2) / width, pos.getY(i) / height);
            mesh(geo, new T.MeshStandardMaterial({ map, color: '#e6d7b1', emissive: '#987442', emissiveMap: map, emissiveIntensity: .45, transparent: true, opacity: .65, side: T.DoubleSide, roughness: .5 }), g, v(0, 0, -.04));
            beam(v(0, 0, .025), v(0, height - .06, .025), .045, .045, brass, g);
            beam(v(-width / 2, height * .57, .025), v(width / 2, height * .57, .025), .045, .045, brass, g);
        }
        return g;
    }
    function desk(parent = root, position = v(), width = 3, depth = 1.35) {
        const g = group(parent); g.position.copy(position);
        for (let i = 0; i < 5; i++) solid(box(width, .105, depth / 5 - .008, wood, g, v(0, 0, (i - 2) * depth / 5), .022), 'tabletop');
        box(width - .1, .22, .08, darkwood, g, v(0, -.17, depth / 2 - .1));
        for (const x of [-width * .42, width * .42]) for (const z of [-depth * .33, depth * .33]) {
            solid(box(.14, 1.1, .14, darkwood, g, v(x, -.59, z)), 'table-leg'); cylinder(.11, .12, .08, brass, g, v(x, -1.12, z));
        }
        beam(v(-width * .43, -.95, 0), v(width * .43, -.95, 0), .11, .11, wood, g);
        return g;
    }
    function draftingBoard(parent, position) {
        const g=group(parent);g.position.copy(position);
        solid(box(3.2,.075,1.4,paper,g),'drafting-surface');
        for(const x of [-1.61,1.61])box(.025,.085,1.42,copper,g,v(x));
        // A folded cantilever, with its construction visible through the open centre.
        for(const z of [-.42,.42]){
            solid(beam(v(-1.1,-1.04,z),v(.7,-.12,z),.09,.085,copper,g),'drafting-strut');
            solid(beam(v(.7,-.12,z),v(.7,-1.04,z),.065,.075,brass,g),'drafting-upright');
            beam(v(-1.1,-1.04,z),v(.95,-1.04,z),.055,.095,iron,g);
        }
        drawing(new T.BoxGeometry(2.1,.97,.84,3,2,1),g,v(-.1,-.57),true);
        return g;
    }
    function archiveLectern(parent, position) {
        const g=group(parent);g.position.copy(position);
        solid(box(3.3,.12,1.45,darkwood,g),'archive-counter');
        box(3.35,.025,1.5,brass,g,v(0,.072));
        solid(cylinder(.4,.72,1.06,stone,g,v(0,-.62),6),'archive-plinth');
        drawing(new T.CylinderGeometry(.51,.85,1.09,6,3,true),g,v(0,-.63),true);
        cylinder(.85,.91,.08,darkwood,g,v(0,-1.16),6);
        return g;
    }
    function folio(title, subtitle = 'BASALT GUILD', parent = root, width = .65, height = .85) {
        const g = group(parent);
        box(width + .06, .045, height + .06, darkwood, g, v(0, -.035)); box(width, .065, height, paper, g);
        const map = texture((ctx, cw, ch) => {
            ctx.fillStyle = '#e3d1a5'; ctx.fillRect(0, 0, cw, ch); ctx.strokeStyle = '#9a713d'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, cw - 48, ch - 48);
            ctx.fillStyle = '#5b4029'; ctx.font = 'bold 34px Georgia'; ctx.fillText(title, 48, 90); ctx.fillStyle = '#8e633e'; ctx.font = '16px Georgia'; ctx.fillText(subtitle, 48, 126);
            for (let i = 0; i < 10; i++) { ctx.fillStyle = i < 2 ? '#9a7649' : '#7e6c4b'; ctx.fillRect(48, 176 + i * 24, cw - 100 - seed(i + title.length) * 75, i < 2 ? 5 : 2); }
            ctx.fillStyle = '#' + w.accent.getHexString(); ctx.beginPath(); ctx.arc(cw - 85, ch - 85, 27, 0, TAU); ctx.fill(); ctx.strokeStyle = '#755330'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cw - 85, ch - 85, 20, 0, TAU); ctx.stroke();
        }, 512, 640);
        const face = mesh(new T.PlaneGeometry(width * .96, height * .96), new T.MeshStandardMaterial({ map, roughness: .85 }), g, v(0, .04)); face.rotation.x = -Math.PI / 2;
        return g;
    }
    function letter(parent = root, size = .45) {
        const g = group(parent); box(size, .025, size * .66, paper, g, v(), .008);
        path([v(-size / 2, .017, -size * .33), v(0, .017, .06), v(size / 2, .017, -size * .33)], .003, brass, g);
        const seal = cylinder(.042, .042, .015, cloth, g, v(0, .035, .04), 20); seal.rotation.y = .2; return g;
    }
    function quill(parent = root) {
        const g = group(parent); const ink = cylinder(.065, .08, .12, iron, g, v(0, .06));
        beam(v(0, .13), v(.19, .7), .012, .012, brass, g);
        const feather = mesh(new T.SphereGeometry(1, 16, 12), paper, g, v(.14, .51)); feather.scale.set(.055, .23, .009); feather.rotation.z = -.35;
        ring(.052, .008, brass, g).rotation.x = Math.PI / 2; return { g, ink };
    }
    function person(parent = root, position = v(), garment = cloth, size = 1) {
        if(position.y< -1.38)position.y=-1.39;
        return createFigure(w, parent, position, size, w.people.length);
    }
    return { texture, wood, darkwood, stone, brass, copper, iron, paper, green, greenLight, terra, cloth, amber, cylinder, beam, gear, lantern, plant, arch, drawing, solid, floor, desk, draftingBoard, archiveLectern, folio, letter, quill, person };
}

function correspondence(w, c) {
    const { root, group, box, ring, mesh, anchor } = w;
    // CRM is an open exchange: a horizontal counter and a sweeping record wall.
    c.floor(7.2, 4.8);
    const exchange = group();
    for (let i = 0; i < 9; i++) {
        const a = -.95 + i * .235, x = Math.sin(a) * 3.1, z = -Math.cos(a) * 2.2;
        const height = 1.8 + Math.sin(i / 8 * Math.PI) * 1.6;
        const rib = c.beam(v(x,-1.35,z),v(x,height-1.35,z),.025,.025,c.brass,exchange);
        rib.name='exchange-rib';
        const outline = c.drawing(new T.BoxGeometry(.58,height,.08,1,4,1),exchange,v(x,height/2-1.35,z)); outline.rotation.y=-a;
        if(i%2===0) { const shelf=box(.61,.04,.3,c.copper,exchange,v(x,-.1,z)); shelf.rotation.y=-a; }
    }
    c.plant(root,v(-2.8,-1.36,-.9),1.5); c.plant(root,v(2.8,-1.36,-1.2),1.1);
    const table = c.desk(root, v(0, -.17, .25), 3.4, 1.65);
    const book = c.folio('A shared story', 'THE PERSON BEHIND THE RECORD', table, 1.05, .84); book.position.set(0, .11, .05); book.rotation.y = -.12;
    const quill = c.quill(table); quill.g.position.set(.8, .053, .2);
    c.lantern(table, v(-1.35, .39, -.45), .75); c.plant(table, v(1.35, .08, -.45), .65);
    const holder = group(); holder.position.set(-1.5, .55, -.65);
    for (let i = 0; i < 5; i++) box(1.1, .025, .52, c.darkwood, holder, v(0, (i - 2) * .17), .01);
    box(.06, .85, .55, c.brass, holder, v(-.56)); box(.06, .85, .55, c.brass, holder, v(.56));
    const letters = Array.from({ length: 12 }, (_, i) => { const g = c.letter(root, .4); return { g, i }; });
    const arm = group(); arm.position.set(.95, .25, -.45); c.beam(v(), v(0, 1.05), .055, .055, c.brass, arm); c.beam(v(0, 1.05), v(-.5, 1.16, .2), .045, .045, c.brass, arm);
    const lens = ring(.29, .027, c.brass, arm); lens.position.set(-.55, 1.13, .25); lens.rotation.x = -.5;
    mesh(new T.CircleGeometry(.26, 48), new T.MeshPhysicalMaterial({ color: '#b7d9b6', transmission: .45, roughness: .12, transparent: true, opacity: .35, side: T.DoubleSide }), lens);
    c.person(root, v(.65, -1.4, 1.64), c.cloth, 1.04);
    c.person(root, v(-2.3, -1.4, 1.8), c.wood, 1);
    const seal = c.cylinder(.08, .1, .14, c.brass, table, v(.65, .15, -.28));
    const gears = [c.gear(.31, root), c.gear(.2, root)]; gears[0].position.set(1.9, .03, -.45); gears[1].position.set(2.47, .03, -.45);
    for(const x of [1.9,2.47]){c.beam(v(x,-1.39,-.62),v(x,.03,-.62),.07,.07,c.darkwood);c.beam(v(x,.03,-.65),v(x,.03,-.38),.035,.035,c.brass);}
    box(.81,.08,.4,c.darkwood,root,v(2.185,-1.35,-.61));
    anchor('customer', book, v(0, .15, -.5)); anchor('record-0', letters[0].g, v(0, .1));
    w.motions.push((p, t) => {
        letters.forEach(({ g, i }) => { g.position.copy(key(p, [v((seed(i) - .5) * 3.1, -.1 + i * .003, .25 + (seed(i + 15) - .5) * 1.2), v(-1.5, .22 + (i % 5) * .15, -.65 + Math.floor(i / 5) * .04), i === 0 ? v(.25, .05, .72) : v(-1.5, .22 + (i % 5) * .15, -.65), v(-.95 + i * .16, .07 + i * .012, .45)])); g.rotation.y = key(p, [(seed(i + 3) - .5) * 1.5, 0, i === 0 ? -.15 : 0, .06 * i]); });
        book.rotation.x = key(p, [0, .18, .28, .13]); book.scale.setScalar(key(p, [.8, 1, 1, 1]));
        arm.rotation.y = key(p, [.65, .25, -.35, .35]); seal.position.y = key(p, [.15, .15, .35, .15]);
        gears.forEach((g, i) => { g.rotation.z = p * 1.5 * (i ? -1.5 : 1) + t * .025; });
    });
    return { cameras: [v(6, 3.7, 10.8), v(4.7, 3.1, 10), v(3.1, 3.6, 9.5), v(5.5, 3.5, 11)], target: [v(0, .5), v(0, .45), v(.1, .15), v(0, .45)] };
}

function publishingWorkshop(w, c) {
    const { root, group, box, mesh, anchor } = w;
    // Onyx is vertical: exposed screw press, flywheel, and rising editorial sheets.
    c.floor(5.8,4.3);
    for(const x of [-1.45,1.45]) {
        c.beam(v(x,-1.36,-.75),v(x,3.6,-.75),.13,.16,c.darkwood);
        c.beam(v(x,3.6,-.75),v(0,4.2,-.75),.085,.085,c.brass);
        c.drawing(new T.BoxGeometry(.45,4.95,.65,1,8,1),root,v(x,1.12,-.8));
    }
    const canopy = c.drawing(new T.CylinderGeometry(1.95,1.95,.7,12,1,true,0,Math.PI),root,v(0,2.65,-.75),true); canopy.rotation.x=Math.PI/2;
    c.plant(root,v(-2.25,-1.36,-1),1.25);
    const press = group(); press.position.set(0, -.6, .05);
    const bench = c.desk(press, v(0, .15), 2.5, 1.4);
    for (const x of [-.9, .9]) { box(.15, 2.1, .18, c.iron, press, v(x, 1.05, -.12)); c.cylinder(.13, .13, .12, c.brass, press, v(x, 2.12, -.12)); }
    box(2.1, .17, .28, c.darkwood, press, v(0, 2.05, -.12));
    const screw = group(press); screw.position.set(0, 1.65, -.12); c.cylinder(.045, .045, 1, c.iron, screw);
    for (let i = 0; i < 18; i++) { const thread = w.ring(.065, .012, c.brass, screw); thread.rotation.x = Math.PI / 2; thread.position.y = (i - 9) * .049; }
    const wheel = c.gear(.48, screw, c.darkwood, 22); wheel.position.y = .5; wheel.rotation.x = Math.PI / 2;
    const platen = group(press); box(1.45, .1, 1, c.brass, platen); box(1.4, .09, .95, c.iron, platen, v(0, -.08));
    const draft = c.folio('Your voice', 'AN IDEA FOR YOUR AUDIENCE', bench, 1.2, .8); draft.position.y = .12;
    const rollers = [];
    for (const x of [-.73, .73]) { const r = c.cylinder(.12, .12, 1.15, c.iron, press, v(x, .48, .12)); r.rotation.x = Math.PI / 2; rollers.push(r); }
    const largeGear = c.gear(.6, root), smallGear = c.gear(.27, root); largeGear.position.set(1.38, .15, .2); smallGear.position.set(2.04, .85, .2);
    for(const [x,y]of [[1.38,.15],[2.04,.85]]){c.beam(v(x,-1.39,-.04),v(x,y,-.04),.075,.1,c.iron);c.beam(v(x,y,-.04),v(x,y,.28),.06,.06,c.brass);}
    const drafts = Array.from({ length: 7 }, (_, i) => { const page = c.folio(i % 2 ? 'Notes' : 'A thought', 'EDITORIAL / WORK IN PROGRESS', root, .42, .56); return page; });
    const destinations = ['X', 'LinkedIn', 'Facebook', 'Instagram'].map((title, i) => {
        const g = group(), sign = c.folio(title, 'YOUR AUDIENCE', g, .63, .83); sign.rotation.x = Math.PI / 2; sign.position.y = .6;
        c.beam(v(-.4, 1.1), v(.4, 1.1), .05, .05, c.brass, g); c.beam(v(0, 1.1), v(0, 1.55), .03, .03, c.brass, g);
        anchor(`platform-${i}`, g, v(0, 1.5)); return g;
    });
    c.person(root, v(-1.65, -1.4, 1.8), c.cloth, 1.04);
    c.quill(root).g.position.set(-1.45, -.31, -.35); c.plant(root, v(2.2, -1.38, 1), 1.05);
    w.motions.push((p, t) => {
        platen.position.y = key(p, [1.2, .85, .6, .47]); screw.rotation.y = p * TAU * 1.5 + Math.sin(t * .3) * .015;
        largeGear.rotation.z = p * 2 + t * .045; smallGear.rotation.z = -p * 4.4 - t * .1; rollers.forEach(r => { r.rotation.y = p * 3; });
        drafts.forEach((g, i) => { g.position.copy(key(p, [v(-1.9 + seed(i) * .55, -.31 + i * .018, -.2 + seed(i + 4) * .45), v(-1.75, -.22 + i * .025, -.15), v(-1.75, -.22 + i * .025, -.15), v(1.45, -.15 + i * .06, .4)])); g.rotation.y = key(p, [(seed(i) - .5) * 1.6, 0, 0, .1]); });
        destinations.forEach((g, i) => { const x = (i - 1.5) * 1.1; g.position.copy(key(p, [v(x, -.1, -1.4), v(x, .05, -1.4), v(x, .65, -.75), v(x, .85, -.65)])); g.scale.setScalar(key(p, [.01, .08, 1, 1])); g.rotation.y = (i - 1.5) * -.07; });
    });
    return { cameras: [v(5.3, 3.1, 12), v(3.2, 2.9, 10.8), v(-3.4, 3.2, 12), v(4.6, 3.2, 12.1)], target: [v(0, .85), v(0, .8), v(0, 1.15), v(0, 1)] };
}

function guildTown(w, c) {
    const { root, group, box, mesh, anchor } = w;
    const terrace = group(), land = new T.PlaneGeometry(16, 16, 20, 20), vertices = land.attributes.position;
    for (let i = 0; i < vertices.count; i++) { const x = vertices.getX(i), y = vertices.getY(i), outside = Math.max(0, Math.hypot(x, y) - 4.5); vertices.setZ(i, Math.sin(x * .8) * Math.cos(y * .6) * Math.min(.48, outside * .16)); }
    land.computeVertexNormals();
    const edgeFade = c.texture((ctx, width, height) => { const fade = ctx.createRadialGradient(width / 2, height / 2, width * .17, width / 2, height / 2, width * .49); fade.addColorStop(0, '#ffffff'); fade.addColorStop(.45, '#eeeeee'); fade.addColorStop(1, '#000000'); ctx.fillStyle = fade; ctx.fillRect(0, 0, width, height); }); edgeFade.colorSpace = T.NoColorSpace;
    const ground = new T.MeshStandardMaterial({ color: '#424d44', roughness: 1, flatShading:true, alphaMap: edgeFade, transparent: true, depthWrite: false });
    const green = mesh(land, ground, terrace, v(0, -1.27)); green.rotation.x = -Math.PI / 2;
    const contour=c.drawing(land.clone(),terrace,v(0,-1.259),true); contour.rotation.x=-Math.PI/2;
    for (let i = 0; i < 7; i++) {
        const tree = group(); tree.position.set((i - 3) * 1.3, -1.32, -3.7 - Math.sin(i) * .35); tree.scale.setScalar(.8 + seed(i + 31) * .45);
        c.cylinder(.055, .11, 1.25, c.darkwood, tree, v(0, .625), 10);
        c.beam(v(0, .6), v(-.35, 1.25, .1), .055, .05, c.darkwood, tree); c.beam(v(0, .75), v(.28, 1.38, -.12), .045, .045, c.darkwood, tree);
        for (let j = 0; j < 3; j++) { const crown = mesh(new T.IcosahedronGeometry(.38, 0), j % 2 ? c.green : c.greenLight, tree, v(Math.cos(j * 2.4) * .19, 1.3 + j * .14, Math.sin(j * 2.4) * .17)); crown.scale.set(.8, 1.35, .8); }
    }
    const buildings = [], colors = ['#52e6df', '#c3a0ff', '#2bfff8', '#b7a5ff', '#ffc029', '#ff616c', '#ff8157'];
    const names = ['CRM', 'ONYX', 'ERP', 'CMS', 'ECHO', 'VIGIL', 'SURGE'];
    function createHouse(i, scale = 1) {
        const g = group(), h = .65 + (i % 3) * .18;
        c.solid(box(.7, h, .65, c.stone, g, v(0, h / 2)),'guild-house');
        for (const x of [-.34, .34]) box(.065, h + .04, .69, c.darkwood, g, v(x, h / 2));
        box(.75, .07, .7, c.wood, g, v(0, h));
        const roof = mesh(new T.ConeGeometry(.62, i%3===0?.92:.62, i%3===1?6:4), c.copper, g, v(0, h + .32)); roof.rotation.y = Math.PI / 4;
        if(i%3===2){const annex=box(.39,.45,.6,c.wood,g,v(.45,.225)); c.drawing(new T.BoxGeometry(.4,.8,.6,1,2,1),g,v(.46,.4)); annex.rotation.y=.1;}
        const scaffold=c.drawing(new T.BoxGeometry(.8,h+.5,.75,1,3,1),g,v(0,(h+.5)/2)); scaffold.rotation.y=.02;
        for (const x of [-.21, .21]) { box(.12, .18, .014, c.amber, g, v(x, h * .58, .333)); box(.018, .2, .025, c.darkwood, g, v(x, h * .58, .35)); }
        box(.14, .27, .025, c.darkwood, g, v(0, .135, .34));
        const chimney = box(.1, .35, .13, c.stone, g, v(.24, h + .4, -.1)); chimney.rotation.z = -.03;
        const flag = box(.25, .13, .012, new T.MeshStandardMaterial({ color: colors[i], roughness: .8, side: T.DoubleSide }), g, v(.18, h + .89, 0));
        c.beam(v(0, h + .5), v(0, h + 1.03), .018, .018, c.brass, g);
        const sign = c.folio(names[i], 'BASALT GUILD', g, .44, .23); sign.rotation.x = Math.PI / 2; sign.position.set(0, h * .22 + .04, .4);
        g.scale.setScalar(scale); return { g, flag };
    }
    const hall = group();
    c.solid(c.cylinder(.6, .68, 2, c.stone, hall, v(0, -.2), 6),'guild-hall'); const hallRoof = mesh(new T.ConeGeometry(.88, 1.1, 6), c.copper, hall, v(0, 1.23));
    c.drawing(new T.CylinderGeometry(.92,.92,3.35,6,5,true),hall,v(0,.35));
    const clock = c.gear(.27, hall, c.brass, 24); clock.position.set(0, -.03, .625);
    const dial = c.cylinder(.205, .205, .015, c.paper, clock); dial.rotation.x = Math.PI / 2; dial.position.z = .08;
    box(.016, .15, .025, c.iron, clock, v(0, .06, .11)); const hand = box(.12, .015, .025, c.iron, clock, v(.05, 0, .12)); hand.rotation.z = .25;
    c.lantern(hall, v(0, -.9, .72), .48);
    const roads = [];
    for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + .2, house = createHouse(i, .94); buildings.push(house);
        anchor(`application-${i}`, house.g, v(0, 1.9));
        const road = box(.28, .025, 2.2, c.paper, terrace, v(Math.sin(a) * 1.4, -1.28, Math.cos(a) * 1.4), .01); road.rotation.y = a; roads.push(road);
        c.plant(root, v(Math.cos(a + .4) * 2.95, -1.32, Math.sin(a + .4) * 2.95), .8);
    }
    c.person(root, v(.9, -1.27, 1.15), c.cloth, .3), c.person(root, v(-.95, -1.27, .85), c.wood, .29);
    const solar = group(); solar.position.set(-1.7, -.5, -2.3); box(1, .08, .72, c.darkwood, solar); for (let i = 0; i < 5; i++) box(.16, .02, .66, c.copper, solar, v((i - 2) * .18, .055)); solar.rotation.x = .38;
    const wheel = c.gear(.48, root, c.wood, 22); wheel.position.set(2.5, -.78, .2);
    w.motions.push((p, t) => {
        buildings.forEach(({ g, flag }, i) => { const a = i * TAU / 7 + .2; const r = key(p, [3.2, 2.35, 2.15, 2.32]); g.position.set(Math.sin(a) * r, -1.28, Math.cos(a) * r); g.rotation.y = a + Math.PI; flag.rotation.y = Math.sin(t * .8 + i) * .08; roads[i].scale.z = key(p, [.05, .7, 1, 1.05]); });
        hall.scale.setScalar(key(p, [.6, .95, 1, 1.12])); hallRoof.rotation.y = 0; clock.rotation.z = .05 * p;
        wheel.rotation.z = p * 2 + t * .025; green.rotation.y = 0;
    });
    return { cameras: [v(7.2, 5.1, 12.4), v(6, 4.5, 11.3), v(4.3, 5.6, 11.7), v(6.2, 4.8, 12.3)], target: [v(0, -.2), v(0, -.2), v(0, -.25), v(0, -.1)] };
}

function makersMill(w, c) {
    const { root, group, box, mesh, anchor } = w;
    // ERP spans a factory bay: horizontal modules and an exposed overhead lifting gantry.
    c.floor(9,5);
    for(const x of [-3.35,3.35]){
        c.beam(v(x,-1.36,-.9),v(x,2.5,-.9),.09,.13,c.iron);
        c.beam(v(x,-1.36,.25),v(x,2.5,-.9),.035,.035,c.brass);
        c.drawing(new T.BoxGeometry(.42,3.85,.65,1,5,1),root,v(x,.56,-.9),true);
    }
    box(7,.12,.2,c.copper,root,v(0,2.5,-.9));
    for(let i=0;i<11;i++)c.beam(v(-3.3+i*.6,2.5,-.9),v(-3+i*.6,2.85,-.9),.025,.025,c.brass);
    c.beam(v(-3.4,2.85,-.9),v(3.4,2.85,-.9),.05,.05,c.brass);
    const mill = group(); mill.position.set(-1.8, -.25, -.2);
    const wheel = c.gear(1.08, mill, c.darkwood, 28);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const paddle = box(.24, .08, .56, c.wood, wheel, v(Math.cos(a), Math.sin(a), .02)); paddle.rotation.z = a; }
    w.ring(.83, .024, c.brass, wheel).position.z = .19;
    c.beam(v(0, -1.1, -.25), v(0, .75, -.25), .19, .2, c.darkwood, mill);
    const gears = [c.gear(.36, root), c.gear(.22, root)]; gears[0].position.set(-.28, .18, -.2); gears[1].position.set(.36, .18, -.2);
    for(const x of [-.28,.36]){c.beam(v(x,-1.39,-.42),v(x,.18,-.42),.075,.075,c.iron);c.beam(v(x,.18,-.44),v(x,.18,-.12),.045,.045,c.brass);}
    const stations = [], names = ['STOCK', 'RESOURCES', 'TEAM', 'WORKFLOW', 'REPORT', 'YOUR IDEA'];
    for (let i = 0; i < 6; i++) {
        const g = group();
        box(.78, .13, .69, c.wood, g); box(.71, .12, .61, c.iron, g, v(0, -.12));
        for (let j = 0; j < 6; j++) { const roller = c.cylinder(.039, .039, .57, c.brass, g, v((j - 2.5) * .11, .105)); roller.rotation.z = Math.PI / 2; }
        for (const x of [-.34, .34]) box(.035, .075, .67, c.brass, g, v(x, .17));
        const label = c.folio(names[i], 'THE WORKSHOP', g, .52, .19); label.rotation.x = Math.PI / 2; label.position.set(0, -.12, .36);
        stations.push(g); anchor(`module-${i}`, g, v(0, .35));
    }
    const frame = group(); c.beam(v(.6, -1.3, -.7), v(.6, 2.05, -.7), .15, .18, c.darkwood, frame); c.beam(v(.6, 2.05, -.7), v(2.2, 2.05, -.7), .15, .18, c.darkwood, frame);
    const pulley = c.gear(.18, frame); pulley.position.set(1.85, 1.9, -.7);
    const rope = c.beam(v(1.85, 1.9, -.68), v(1.85, .1, -.68), .014, .014, c.paper, frame);
    const hook = w.ring(.1, .015, c.brass, frame, Math.PI * 1.55); hook.position.set(1.85, .08, -.68);
    const crates = [];
    for (let i = 0; i < 5; i++) {
        const g = group(); box(.27, .25, .27, c.wood, g);
        for (const x of [-.1, .1]) { box(.022, .27, .29, c.darkwood, g, v(x)); }
        box(.29, .025, .29, c.brass, g, v(0, .03)); crates.push(g);
    }
    c.person(root, v(.15, -1.4, 1.9), c.cloth, 1.03);
    const plan = c.folio('The next shift', 'FOLLOW THE CHANGE', root, .8, .65); plan.position.set(2.5, -.35, 1.05); plan.rotation.x = .9;
    w.motions.push((p, t) => {
        wheel.rotation.z = p * 1.6 + t * .065; gears.forEach((g, i) => { g.rotation.z = (-p * 3 - t * .1) * (i ? -1.6 : 1); });
        stations.forEach((g, i) => { g.position.copy(key(p, [v(-.8+(i%3)*1.1,-.72+Math.floor(i/3)*.75,.4-Math.floor(i/3)*.9),v(-1.3+i*.82,-.5,.3),v(i===5?1.85:-1.3+i*.82,i===5?1.15:-.5,i===5?-.68:.3),v(-1.3+i*.82,-.5,.3)])); g.rotation.y = key(p, [(i%3-1)*.3,0,i===5?.18:0,0]); });
        hook.position.y = key(p, [.08, .08, 1.45, .08]); rope.scale.y = key(p, [1, 1, .22, 1]); rope.position.y = key(p, [1, 1, 1.7, 1]);
        crates.forEach((g, i) => { const flow = (t*.045+i/5)%1; g.position.copy(key(p,[v(-2.1+i*.34,-1.15,1.05),v(-1.3+i*.82,-.22,.3),v(-1.3+i*.82,-.22,.3),v(-1.5+flow*4.4,-.22,.3)])); });
        plan.rotation.y = key(p, [-.6, -.5, -.3, .1]);
    });
    return { cameras: [v(7.2,4.3,13.5),v(4.4,3.7,13),v(5.5,4.2,12.5),v(3.5,4.3,14)], target: [v(0,.4),v(.2,.4),v(.7,.7),v(.2,.4)] };
}

function illuminatedStudio(w, c) {
    const { root, group, box, mesh, anchor } = w;
    // CMS is a paper landscape: a small drafting bench beneath two folded manuscript sails.
    c.floor(6.2,4.5);
    const sails=[];
    for(const side of [-1,1]){
        const sail=group(); const geometry=new T.PlaneGeometry(2.25,4.15,5,8),positions=geometry.attributes.position;
        for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i);positions.setZ(i,.27*Math.cos(y*.9)+Math.abs(x)*.3);}
        geometry.computeVertexNormals();
        const sheet=new T.MeshStandardMaterial({color:side===1?'#b7a6c5':'#d4c3a5',side:T.DoubleSide,transparent:true,opacity:.13,roughness:.85,flatShading:true,depthWrite:false});
        mesh(geometry,sheet,sail);c.drawing(geometry.clone(),sail,v(),true);sail.position.set(side*1.5,.8,-1.1);sail.rotation.y=side*.42;sail.rotation.z=side*-.15;sails.push(sail);
    }
    c.plant(root,v(-2.6,-1.36,-.4),1.1);
    const table = c.draftingBoard(root, v(0, -.3, .3));
    const stand = group(table); stand.position.set(.1, .12, -.25); stand.rotation.x = -.45;
    for (const x of [-.7, .7]) c.beam(v(x, 0, .22), v(x, .7, -.3), .065, .08, c.darkwood, table);
    const pages = [];
    function manuscript(width, height, title) {
        const g = group(), book = c.folio(title, 'A STORY FOR YOUR AUDIENCE', g, width, height);
        const map = c.texture((ctx, cw, ch) => {
            ctx.fillStyle = '#e7d6ad'; ctx.fillRect(0, 0, cw, ch);
            ctx.strokeStyle = '#a88948'; ctx.lineWidth = 7; ctx.strokeRect(16, 16, cw - 32, ch - 32);
            ctx.fillStyle = '#6b4d35'; ctx.font = 'bold 46px Georgia'; ctx.fillText('Let the story', 45, 91); ctx.fillText('take root.', 45, 143);
            // An illuminated botanical plate: original stems, leaves and sun, painted in code.
            ctx.fillStyle = '#6f7645'; ctx.fillRect(45, 175, cw - 90, 288); ctx.strokeStyle = '#d2c182'; ctx.lineWidth = 4;
            for (let i = 0; i < 9; i++) { const x = 95 + i * 40; ctx.beginPath(); ctx.moveTo(x, 448); ctx.bezierCurveTo(x - 42, 347, x + 45, 300, x, 202); ctx.stroke(); for (let j = 0; j < 5; j++) { ctx.save(); ctx.translate(x + Math.sin(j + i) * 14, 236 + j * 42); ctx.rotate(j % 2 ? .55 : -.55); ctx.fillStyle = j % 2 ? '#e2c77a' : '#aaba74'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 23, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
            ctx.fillStyle = '#957c51'; for (let i = 0; i < 5; i++) ctx.fillRect(45, 505 + i * 20, cw - 100 - (i % 3) * 35, 3);
            ctx.fillStyle = '#' + w.accent.getHexString(); ctx.fillRect(45, 617, 142, 12);
        }, 512, 680);
        const art = mesh(new T.PlaneGeometry(width * .95, height * .95), new T.MeshStandardMaterial({ map, roughness: .8 }), book, v(0, .047)); art.rotation.x = -Math.PI / 2;
        return g;
    }
    for (let i = 0; i < 3; i++) { const g = manuscript([1.22, .83, .49][i], [1.55, 1.13, .95][i], ['CANVAS', 'TABLET', 'MOBILE'][i]); pages.push(g); anchor(`canvas-${i}`, g, v(0, .15, -.7)); }
    const ingredients = ['A headline', 'An image', 'A thought', 'A direction'].map(title => c.folio(title, 'THE INGREDIENTS', root, .55, .7));
    const inks = [];
    for (let i = 0; i < 5; i++) { const g = group(table); g.position.set(-1.4 + i * .16, .12, .55); c.cylinder(.047, .055, .13, i % 2 ? c.cloth : c.copper, g); c.cylinder(.042, .042, .023, c.brass, g, v(0, .08)); inks.push(g); }
    c.quill(table).g.position.set(1.24, .08, .42); c.lantern(table, v(-1.4, .37, -.48), .8);
    const arm = group(table); c.beam(v(1.3, .08, -.55), v(1.3, 1.3, -.55), .045, .045, c.brass, arm); c.beam(v(1.3, 1.3, -.55), v(.5, 1.4, -.2), .045, .045, c.brass, arm);
    const magnifier = w.ring(.22, .027, c.brass, arm); magnifier.position.set(.42, 1.4, -.13); magnifier.rotation.x = -.9;
    c.person(root, v(.9, -1.4, 1.7), c.cloth, 1);
    w.motions.push((p, t) => {
        pages.forEach((g, i) => { g.position.copy(key(p, [v((i - 1) * .45, -.15 + i * .06, .4), v(i === 0 ? 0 : -.5 + i * .13, i === 0 ? .6 : .1, -.2 - i * .12), v((i - 1) * 1.15, .72, -.1 + i * .08), v(i === 0 ? .35 : -1.2 + i * .1, i === 0 ? .83 : .3, i === 0 ? .1 : -.2)])); g.rotation.set(key(p, [0, 1.1, 1.3, i === 0 ? 1.25 : .4]), key(p, [(i - 1) * .3, -.08, (i - 1) * -.14, -.12]), 0); g.scale.setScalar(key(p, [.72, i === 0 ? 1.15 : .6, 1, i === 0 ? 1.25 : .55])); });
        ingredients.forEach((g, i) => { g.position.copy(key(p, [v(-1.3 + i * .72, -.17 + i * .01, .72), v(-1.3, -.1 + i * .035, .25), v(-1.3, -.1 + i * .035, .25), v(-1.5, -.1 + i * .035, .3)])); g.rotation.y = key(p, [(i - 1.5) * .3, -.12, -.12, -.12]); });
        arm.rotation.y = key(p, [.3, -.2, .5, .65]);
        sails.forEach((s,i)=>{s.rotation.y=key(p,[i?.42:-.42,i?.3:-.3,i?.65:-.65,i?.52:-.52]);});
    });
    return { cameras: [v(5.6, 3.9, 11.4), v(3.8, 2.8, 10), v(3.2, 2.8, 11), v(4.8, 3, 10.5)], target: [v(0, .45), v(0, .6), v(0, .75), v(0, .7)] };
}

function conversationGarden(w, c) {
    const { root, group, mesh, box, anchor } = w;
    // Echo is an acoustic pavilion: radial copper ribs open like the shell of an instrument.
    c.floor(7.2,6.1);
    const shell=group(); shell.position.set(0,.15,-1.7);
    const shellGeo=new T.SphereGeometry(2.7,16,10,Math.PI*.12,Math.PI*.76,Math.PI*.08,Math.PI*.88);
    const shellMesh=mesh(shellGeo,new T.MeshStandardMaterial({color:'#b6a078',transparent:true,opacity:.1,roughness:.8,flatShading:true,side:T.DoubleSide,depthWrite:false}),shell);
    shell.rotation.y=Math.PI; shell.scale.set(1.18,1,.4);c.drawing(shellGeo.clone(),shell,v(),true);
    for(let i=0;i<7;i++){
        const a=(i/6-.5)*2.25,points=[];for(let j=0;j<=12;j++){const t=j/12*Math.PI*.82;points.push(v(Math.sin(a)*Math.sin(t)*2.9,Math.cos(t)*2.9,Math.cos(a)*Math.sin(t)*.9));}
        w.path(points,.013,c.brass,shell);
    }
    const pedestal = group(); c.cylinder(.78, .88, .15, c.darkwood, pedestal, v(0, -.45)); c.cylinder(.12, .2, .82, c.brass, pedestal, v(0, -.92)); c.cylinder(.5, .62, .12, c.stone, pedestal, v(0, -1.3));
    const record = c.cylinder(.58, .58, .05, c.iron, pedestal, v(0, -.33));
    for (let i = 0; i < 9; i++) { const groove = w.ring(.21 + i * .037, .002, c.brass, record); groove.rotation.x = Math.PI / 2; groove.position.y = .029; }
    c.cylinder(.11, .11, .02, c.cloth, record, v(0, .04));
    function horn(x,z,index) {
        const g=group();g.name=`echo-instrument-${index}`;g.position.set(x,-1.39,z);
        c.cylinder(.25,.36,.08,c.iron,g,v(0,.04),12);
        c.cylinder(.2,.25,.07,c.brass,g,v(0,.1),12);
        c.cylinder(.036,.059,1.06,c.brass,g,v(0,.66),12);
        for(const side of [-1,1])c.beam(v(side*.24,.1,0),v(0,.5,0),.018,.018,c.copper,g);
        const swivel=group(g);swivel.position.y=1.2;
        const joint=c.gear(.085,swivel,c.brass,12);joint.position.z=.025;
        const arm=group(swivel);const points=[];
        w.path([v(0,0),v(.12,.15),v(.1,.29),v(0,.38)],.052,c.brass,arm);
        const head=group(arm);head.position.y=.38;
        for (let i = 0; i <= 12; i++) { const s = i / 12; points.push(new T.Vector2(.055 + Math.pow(s, 2.6) * .53, s * .9)); }
        const trumpet = mesh(new T.LatheGeometry(points, 16), new T.MeshPhysicalMaterial({ color: '#bf9751', metalness: .58, roughness: .43, side: T.DoubleSide,flatShading:true }), head); trumpet.rotation.z = -.52;
        c.drawing(trumpet.geometry.clone(),trumpet,v(),true);
        const rim = w.ring(.585, .023, c.brass, trumpet); rim.rotation.x = Math.PI / 2; rim.position.y = .9;
        const mouth=group(trumpet);mouth.position.y=.9;
        // Tube, bell, hinge, and mast share an actual transform hierarchy: no detached horn.
        return {g,swivel,arm,mouth};
    }
    const horns = [horn(-1.15,.15,0),horn(1.15,.15,1),horn(-1.05,-1.55,2),horn(1.05,-1.55,3)];
    w.mounts=horns.map(({g,swivel,arm})=>({base:g,pivot:swivel,arm}));
    const benches = [];
    for (const x of [-2.15, 2.15]) { const bench = c.desk(root, v(x, -.79, -.3), .85, .58); bench.scale.y=.5; benches.push(bench); }
    c.person(root, v(-1.35, -1.4, 2.25), c.cloth, 1), c.person(root, v(1.35, -1.4, 2.25), c.wood, 1.03);
    for (let i = 0; i < 5; i++) { const a = .6+i*.48; c.plant(root, v(Math.cos(a)*3,-1.36,-Math.sin(a)*2), .75 + seed(i)*.5); }
    const signals=Array.from({length:3},()=>{
        const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(49*3),3));
        const material=new T.LineBasicMaterial({color:'#e4c58d',transparent:true,opacity:.15,depthWrite:false});const line=new T.Line(geometry,material);root.add(line);
        const dots=Array.from({length:8},()=>mesh(new T.IcosahedronGeometry(.018,0),c.amber));
        return{line,dots,curve:new T.CubicBezierCurve3(v(),v(),v(),v())};
    });
    anchor('assistant-context', horns[0].mouth, v(0,.16));
    w.motions.push((p, t) => {
        horns.forEach(({swivel,arm},i)=>{
            const deploy=i===0?1:i===1?ease((p-.37)/.23):ease((p-.7)/.26);
            const aim=i%2===0?0:Math.PI;
            swivel.rotation.y=key(p,[aim+.38,aim+.2,aim,aim+(i>1?-.35:.12)]);
            arm.rotation.z=T.MathUtils.lerp(1.34,-.06,deploy);
        });
        record.rotation.y = p * TAU*.4 + t * .12;
        root.updateMatrixWorld(true);
        signals.forEach(({line,dots,curve},i)=>{
            const a=horns[i].mouth.getWorldPosition(v()),b=horns[i+1].mouth.getWorldPosition(v());
            curve.v0.copy(a);curve.v3.copy(b);curve.v1.copy(a).lerp(b,.32).add(v(0,.65));curve.v2.copy(a).lerp(b,.68).add(v(0,.65));
            const activation=i===0?ease((p-.35)/.25):ease((p-.72)/.24);
            const points=line.geometry.attributes.position;
            for(let j=0;j<=48;j++){const at=curve.getPoint(j/48);points.setXYZ(j,at.x,at.y,at.z);}points.needsUpdate=true;line.geometry.computeBoundingSphere();
            line.material.opacity=activation*.13;
            dots.forEach((dot,j)=>{const s=(j/8+t*.13+i*.17)%1;dot.position.copy(curve.getPoint(s));dot.scale.setScalar(activation*Math.sin(s*Math.PI)*(.45+.3*Math.sin(t*2+i)));});
        });
        shellMesh.material.opacity=key(p,[.035,.05,.065,.08]);
    });
    return { cameras: [v(5.8, 3.6, 11.5), v(4.7, 3, 10.8), v(3.6, 3.3, 11.5), v(5.5, 3.8, 12)], target: [v(0, .55), v(0, .65), v(0, .65), v(0, .55)] };
}

function counselLibrary(w, c) {
    const { root, group, box, anchor } = w;
    // Vigil is an archive tower: scarlet flying buttresses and a stepped wall of evidence.
    c.floor(6.7,4.8);
    for(const side of [-1,1]){
        const x=side*2.65;
        c.beam(v(x,-1.35,-1.1),v(side*1.6,3.65,-1.35),.15,.15,c.darkwood);
        c.beam(v(side*1.6,3.65,-1.35),v(0,4.35,-1.35),.09,.09,c.brass);
        c.drawing(new T.ConeGeometry(1,4.6,4,6,true),root,v(x*.83,.85,-1.55),true).scale.set(.35,1,.6);
    }
    for(let i=0;i<5;i++){
        const shelf=box(3.2-i*.33,.045,.44,c.wood,root,v(.2,1.3+i*.48,-1.32));
        for(let j=0;j<8-i;j++)box(.13,.27,.21,j%3?c.darkwood:c.copper,shelf,v((j-(7-i)/2)*.27,.16));
    }
    const shelves = group(); shelves.position.set(-1.78, -.2, -.7);
    for (let i = 0; i < 4; i++) box(1.15, .065, .54, c.darkwood, shelves, v(0, (i - 1.5) * .54));
    for (const x of [-.58, .58]) box(.09, 2.1, .57, c.wood, shelves, v(x));
    for (let i = 0; i < 21; i++) { const book = box(.1, .3 + seed(i) * .1, .35, i % 3 === 0 ? c.cloth : i % 3 === 1 ? c.copper : c.darkwood, shelves, v(-.45 + (i % 7) * .145, -.62 + Math.floor(i / 7) * .54, 0), .008); book.rotation.z = (seed(i + 2) - .5) * .08; for (const y of [-.1, .1]) box(.104, .009, .015, c.brass, book, v(0, y, .183), .002); }
    const table = c.archiveLectern(root, v(.15, -.2, .4));
    const draft = c.folio('The matter', 'REASONING BESIDE THE WORK', root, 1.18, 1.2); draft.position.set(.2, .08, .3); draft.rotation.x = -.65;
    const findings = Array.from({ length: 6 }, (_, i) => c.folio(['Research', 'Requirements', 'Findings', 'Drafting', 'Review', 'Governance'][i], 'CONTEXT TO CONSIDER', root, .45, .58));
    const balance = group(); balance.position.set(1.35, -.12, -.24);
    c.cylinder(.28, .34, .1, c.brass, balance); c.cylinder(.025, .045, 1.2, c.brass, balance, v(0, .63));
    const beam = group(balance); beam.position.y = 1.22; box(1.03, .035, .045, c.brass, beam);
    for (const x of [-.43, .43]) { w.path([v(x - .16, -.48), v(x, 0), v(x + .16, -.48)], .008, c.brass, beam); c.cylinder(.2, .09, .065, c.brass, beam, v(x, -.51)); }
    const cabinet = c.arch(root, 2.2, 2.7, v(.5, -.78, -.9), false);
    const doors = [];
    for (const side of [-1, 1]) { const hinge = group(cabinet); hinge.position.set(side * 1.03, 0, 0); const panel = box(.97, 1.9, .055, c.darkwood, hinge, v(-side * .5, .95, 0)); box(.84, 1.61, .015, new T.MeshPhysicalMaterial({ color: '#c9aa70', transparent: true, opacity: .2, roughness: .14, metalness: .2, side: T.DoubleSide }), panel, v(0, 0, .04)); c.cylinder(.032, .032, .025, c.brass, hinge, v(-side * .9, .9, .06)).rotation.x = Math.PI / 2; doors.push(hinge); }
    c.quill(table).g.position.set(-.72, .08, .33); c.lantern(table, v(-1.34, .38, -.43), .8);
    c.person(root, v(.05, -1.4, 1.82), c.cloth, 1.02);
    anchor('brief', draft, v(0, .18, -.6)); anchor('governance-shield', cabinet, v(0, 2.9));
    w.motions.push((p, t) => {
        draft.position.copy(key(p, [v(.2, -.1, .4), v(.1, .15, .35), v(-.15, .43, .35), v(.5, .3, -.3)])); draft.rotation.x = key(p, [.15, .6, 1.1, 1.15]);
        findings.forEach((g, i) => { g.position.copy(key(p, [v(-1.1 + i * .35, -.08 + i * .012, .64), v(-.8 + (i % 3) * .63, .12 + Math.floor(i / 3) * .42, -.25 - Math.floor(i / 3) * .28), v(i < 3 ? -1.1 : .85, .14 + (i % 3) * .31, .1), v(.45 + (i % 3) * .06, .08 + i * .045, -.32)])); g.rotation.set(key(p, [0, .45, .8, .5]), key(p, [(seed(i) - .5) * 1.2, -.05, i < 3 ? .16 : -.16, 0]), 0); });
        beam.rotation.z = key(p, [.17, -.12, .06, 0]) + Math.sin(t * .45) * .008;
        cabinet.scale.setScalar(key(p, [.62, .72, .8, 1])); doors.forEach((g, i) => { g.rotation.y = key(p, [i ? -1.55 : 1.55, i ? -1.55 : 1.55, i ? -1.55 : 1.55, i ? -.45 : .45]); });
    });
    return { cameras: [v(-5.3,3.2,12.6),v(-3.5,3,11.8),v(3.2,2.9,11.5),v(4.1,3.3,12.5)], target: [v(0,.8),v(0,.8),v(0,.85),v(0,1)] };
}

const worlds = { network: correspondence, crystal: publishingWorkshop, constellation: guildTown, modules: makersMill, pages: illuminatedStudio, wave: conversationGarden, shield: counselLibrary };
export function buildCraftedWorld(w, kind) {
    const c=craft(w,kind),result=worlds[kind](w,c);
    directNarrative(w,c,kind);
    // Surface/edge contrast unifies the family without imposing the same room on every app.
    const ink = new T.LineBasicMaterial({ color: w.accent.clone().lerp(new T.Color('#cabc9f'), .4), transparent:true, opacity:.2, depthWrite:false });
    const surfaces=[]; w.root.traverse(object=>{if(object.isMesh&&!object.userData.figure&&!object.isInstancedMesh)surfaces.push(object);});
    for(const object of surfaces){
        if(!object.material.map) { object.material.flatShading=true; object.material.needsUpdate=true; }
        if(!object.material.transparent){object.material.polygonOffset=true;object.material.polygonOffsetFactor=1;object.material.polygonOffsetUnits=1;}
        object.geometry.computeBoundingSphere();
        if(object.geometry.boundingSphere.radius>.32 && !object.material.transparent){
            const edges=new T.LineSegments(new T.EdgesGeometry(object.geometry,28),ink);object.add(edges);
        }
        if(!object.material.transparent&&!object.userData.heldProp&&!w.solids.includes(object))w.solids.push(object);
    }
    return result;
}
