/* Two publishing films: a message finds its audience; a page becomes useful.
 * The same artwork stays on screen through each transformation. Scroll owns
 * the machinery, the blocking, and the camera; idle time cannot advance work. */
import { T, v, range, frame, actor, perform, reach, held, placard, architecture, finishStory } from './cinematic-kit.js';

const lerp = T.MathUtils.lerp;
const TAU = Math.PI * 2;

function pressResponse(h,index,button,amount){
    const rig=h.joints[index],finger=rig.fingers.find(f=>f.anatomy===0),rest=h.restHands[index];
    h.grip(index,.48,true);h.g.updateMatrixWorld(true);button.updateWorldMatrix(true,true);
    const orientation=h.g.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(-.75,0,0)));
    const localPad=rig.hand.worldToLocal(finger.pad.getWorldPosition(v())).multiplyScalar(h.g.scale.x).applyQuaternion(orientation);
    const point=button.localToWorld(v(0,.0175,0)),wrist=point.clone().sub(localPad);
    h.handTo(index,rest.position.clone().lerp(wrist,amount),rest.orientation.clone().slerp(orientation,amount),lerp(.22,.48,amount),amount);
    return {pad:finger.pad,point};
}

// Small repeated hardware is instanced; it gives the close passes real joinery
// without turning the architecture into hundreds of independent draw calls.
function fasteners(w, c, parent, positions, radius = .021) {
    const mesh = new T.InstancedMesh(new T.SphereGeometry(radius, 8, 5), c.brass, positions.length), dummy = new T.Object3D();
    positions.forEach((point, i) => { dummy.position.copy(point); dummy.scale.set(1, 1, .45); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.castShadow = true; parent.add(mesh); return mesh;
}

function roller(w, c, parent, position, length, radius = .032) {
    const g = w.group(parent); g.position.copy(position);
    const body = c.cylinder(radius, radius, length, c.copper, g); body.rotation.x = Math.PI / 2;
    for (const z of [-length / 2, length / 2]) {
        const bearing = c.cylinder(radius * 1.5, radius * 1.5, .034, c.brass, parent, position.clone().add(v(0, 0, z))); bearing.rotation.x = Math.PI / 2;
    }
    // An inlaid seam makes rotation readable on an otherwise round roller.
    w.box(.008, .005, length * .91, c.brass, g, v(0, radius, 0));
    return g;
}

function imagePlate(w, c, parent, width, height, map, color = '#eee0bc') {
    const g = w.group(parent);
    w.box(width + .045, height + .045, .035, c.brass, g, v(0, 0, -.025));
    const face = w.mesh(new T.PlaneGeometry(width, height), new T.MeshStandardMaterial({ map, color, roughness: .84, side: T.DoubleSide }), g, v(0, 0, .002));
    return { g, face };
}

function label(w, c, words, width, height, parent, position, size = 50, background = '#e8ddc0') {
    const map = c.texture((ctx, cw, ch) => {
        ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#383129'; ctx.font = `600 ${size}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        words.split('\n').forEach((line, i, lines) => ctx.fillText(line, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * size * 1.17, cw - 36));
    }, 768, Math.round(768 * height / width));
    const plane = w.mesh(new T.PlaneGeometry(width, height), new T.MeshStandardMaterial({ map, roughness: .9, side: T.DoubleSide }), parent, position);
    return plane;
}

// An original botanical mark and image, reused on the draft, press, dispatch
// versions, display, and reply. Object continuity makes the film legible.
function campaignArtwork(c, mode = 'poster', format = 'poster') {
    const landscape = format === 'banner', square = format === 'post';
    return c.texture((ctx, width, height) => {
        ctx.fillStyle = '#ece0bd'; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#7f7096'; ctx.lineWidth = 10; ctx.strokeRect(18, 18, width - 36, height - 36);
        ctx.fillStyle = '#423650'; ctx.textAlign = 'center'; ctx.font = '600 28px Georgia'; ctx.fillText('THE ROOFTOP GUILD', width / 2, 69);
        const bounds = landscape ? [43, 104, width * .38, height * .65] : [45, 102, width - 90, height * (square ? .44 : .49)];
        const [bx, by, bw, bh] = bounds, cy = by + bh * .36;
        ctx.fillStyle = '#76668a'; ctx.fillRect(...bounds);
        ctx.save(); ctx.beginPath(); ctx.rect(...bounds); ctx.clip();
        ctx.fillStyle = '#dbc283'; ctx.beginPath(); ctx.arc(bx + bw * .73, cy, bw * .135, 0, TAU); ctx.fill();
        for (let i = 0; i < 7; i++) {
            const x = bx + bw * (.1 + i * .13), top = cy + 25 + Math.sin(i * 2.1) * 30;
            ctx.strokeStyle = i % 2 ? '#b5ba91' : '#d9ceaa'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.bezierCurveTo(x - 30, by + bh * .77, x + 29, top + 40, x, top); ctx.stroke();
            for (let j = 0; j < 4; j++) {
                ctx.save(); ctx.translate(x + (j % 2 ? 14 : -14), top + 32 + j * 34); ctx.rotate(j % 2 ? -.7 : .7); ctx.fillStyle = j % 2 ? '#d9ceaa' : '#a5b594'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 22, 0, 0, TAU); ctx.fill(); ctx.restore();
            }
        }
        ctx.globalAlpha = .13; ctx.strokeStyle = '#e7d6b1'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 80; i++) { const y = by + i * 5.7; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke(); }
        ctx.restore();
        const tx = landscape ? width * .71 : width / 2;
        ctx.fillStyle = '#423650'; ctx.font = `bold ${landscape ? 54 : square ? 56 : 50}px Georgia`;
        ctx.fillText(mode === 'reply' ? 'Count me in.' : 'Good things', tx, height * (landscape ? .41 : .72));
        ctx.fillText(mode === 'reply' ? 'See you there.' : 'grow together.', tx, height * (landscape ? .55 : .8));
        ctx.font = `${landscape ? 23 : 24}px Georgia`; ctx.fillText(mode === 'reply' ? 'A REPLY FROM YOUR AUDIENCE' : 'OPEN ROOFTOP / SATURDAY', tx, height * (landscape ? .73 : .91));
        // Printer's furniture: a fine engraved border, registration marks and
        // restrained ink hatching stay identical from proof through dispatch.
        ctx.strokeStyle = '#aa9270'; ctx.lineWidth = 1.2; ctx.strokeRect(28, 28, width - 56, height - 56);
        for (const x of [35, width - 35]) for (const y of [88, height - 47]) {
            ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
        }
    }, landscape ? 1056 : square ? 800 : 640, landscape ? 600 : 800);
}

function rooftop(w, c) {
    architecture(w, c, { width: 17, depth: 11, height: 5.2 });
    // The workshop opens onto a city. The parapet is behind all actor paths.
    w.box(17, .42, .32, c.stone, w.root, v(.5, .21, -3.35));
    w.box(17.2, .09, .48, c.brass, w.root, v(.5, .465, -3.35));
    for (let i = 0; i < 15; i++) {
        const x = -9 + i * 1.27, h = 1.3 + (i * 7 % 5) * .47, z = -7 - (i % 3) * .6;
        w.box(1.04, h, .9, i % 3 ? c.darkwood : c.wood, w.root, v(x, h / 2 - .4, z));
        const roof = w.mesh(new T.ConeGeometry(.88, .8, 4), c.copper, w.root, v(x, h, z)); roof.rotation.y = Math.PI / 4;
        w.box(1.15, .09, 1.02, c.brass, w.root, v(x, h - .4, z));
        w.box(.17, .67, .2, c.stone, w.root, v(x + .32, h + .18, z - .15));
        w.box(.24, .05, .26, c.iron, w.root, v(x + .32, h + .535, z - .15));
        for (const dx of [-.26, .26]) for (let j = 0; j < 2; j++) w.box(.13, .24, .02, c.amber, w.root, v(x + dx, h - .7 - j * .6, z + .46));
        for (const dx of [-.26, .26]) {
            w.box(.27, .035, .13, c.brass, w.root, v(x + dx, h - .85, z + .5));
            c.beam(v(x + dx, h - .82, z + .48), v(x + dx, h - .58, z + .48), .018, .035, c.darkwood);
        }
        if (i % 3 === 0) c.drawing(new T.BoxGeometry(1.07, h + .08, .93, 1, 3, 1), w.root, v(x, h / 2 - .4, z));
    }
    // Rooftop solar collectors and growing beds make this a lived-in city,
    // with a low horizon that leaves the moving message in silhouette.
    for (const x of [-6.1, -4.8, 5.6, 7.0]) {
        const collector = w.group(); collector.position.set(x, .72, -4.65); collector.rotation.x = -.52;
        w.box(1.08, .72, .065, c.iron, collector);
        for (let j = 0; j < 5; j++) w.box(.18, .65, .012, c.copper, collector, v((j - 2) * .203, 0, .042));
        for (const dx of [-.43, .43]) c.beam(v(x + dx, 0, -4.8), v(x + dx, .72, -4.65), .045, .045, c.brass);
    }
    for (const x of [-5.3, 6.6]) {
        w.box(2.15, .36, .72, c.darkwood, w.root, v(x, .18, -2.9));
        for (let i = 0; i < 4; i++) c.plant(w.root, v(x + (i - 1.5) * .49, .36, -2.9), .85);
    }
    for (const x of [-4.2, 1.8]) {
        // Keep the right upright outside the press wheel's camera silhouette.
        const postX=x===1.8?3.4:x;
        c.beam(v(postX, 0, -1.8), v(postX, 3.7, -1.8), .12, .12, c.darkwood);
        if(postX!==x){
            c.beam(v(postX,3.7,-1.8),v(x,3.7,-1.8),.12,.12,c.darkwood);
            c.beam(v(postX,3.12,-1.8),v(x+.4,3.7,-1.8),.065,.065,c.brass);
        }
        c.beam(v(x, 3.7, -1.8), v(x, 3.1, 1.4), .07, .07, c.brass);
        c.lantern(w.root, v(postX, 2.5, -1.55), .7);
    }
    const awning = w.mesh(new T.PlaneGeometry(6, 3.26, 12, 6), new T.MeshStandardMaterial({ color: '#8d789c', roughness: .92, transparent: true, opacity: .25, side: T.DoubleSide }), w.root, v(-1.2, 3.4, -.2));
    awning.rotation.x = -Math.PI / 2 + .18;
    c.drawing(awning.geometry.clone(), awning, v(0, 0, .004));
    for (let i = 0; i < 9; i++) {
        const x = -3 + i * .75;
        c.beam(v(x, -1.63, .005), v(x, 1.63, .005), .014, .014, c.brass, awning);
    }
    // Sewn scallops establish an editorial tent rather than a generic room.
    for (let i = 0; i < 16; i++) {
        const hem = w.mesh(new T.CircleGeometry(.1875, 12, 0, Math.PI), c.cloth, awning, v(-2.8125 + i * .375, -1.63, 0)); hem.rotation.z = Math.PI;
    }
    c.plant(w.root, v(-4.4, 0, -1.8), 1.5); c.plant(w.root, v(5.9, 0, -1.2), 1.5); c.plant(w.root, v(2.3, 0, -2.6), 1.1);
}

export function buildOnyx(w, c) {
    // Purple belongs to the editorial work and canopy. The city is warm
    // timber, aged masonry and green copper, so the message owns the accent.
    c.wood.color.set('#786557'); c.darkwood.color.set('#343139'); c.stone.color.set('#777b79'); c.copper.color.set('#64796b'); c.brass.color.set('#ac9369');
    rooftop(w, c);
    const { root, group, box } = w;
    const art = campaignArtwork(c), replyArt = campaignArtwork(c, 'reply');
    const table = c.desk(root, v(-2.65, 1.16, .35), 2.15, 1.25);
    c.quill(table).g.position.set(-.85, .06, -.06); c.lantern(table, v(-.82, .4, -.45), .65);
    placard(w, c, '01 / MAKE IT YOURS', .95, .15, table).position.set(-.67, -.35, .65);
    // A compositor's type drawer and pigment dishes sit beyond the proofing
    // hands. The tools belong to this particular piece of work.
    const typecase = group(table); typecase.position.set(-.77, .076, .4);
    box(.59, .035, .33, c.darkwood, typecase);
    for (let i = 0; i < 6; i++) {
        box(.014, .085, .33, c.brass, typecase, v((i - 2.5) * .105, .035));
        const type = label(w, c, ['G', 'R', 'O', 'W', '&', '.'][i], .072, .092, typecase, v((i - 2.5) * .105, .064, 0), 480, '#b3a689'); type.rotation.x = -Math.PI / 2;
    }
    for (let i = 0; i < 3; i++) {
        c.cylinder(.053, .048, .026, c.brass, table, v(-.97 + i * .16, .076, -.25));
        c.cylinder(.045, .045, .004, [c.copper, c.iron, c.paper][i], table, v(-.97 + i * .16, .091, -.25));
    }

    // The proof sits on the same supported carriage that enters the press.
    const carriage = group(); carriage.name='print-carriage';carriage.position.set(-2.55, 1.22, .33);
    box(1.1, .09, 1.25, c.darkwood, carriage).name = 'dispatch-tray';
    for (const dx of [-.45, .45]) for (const z of [-.5, .5]) {
        const wheel = c.cylinder(.075, .075, .045, c.brass, carriage, v(dx, -.06, z)); wheel.rotation.x = Math.PI / 2; wheel.name = 'dispatch-wheel';
    }
    for (const x of [-.4, .4]) held(c.beam(v(x, .04, .58), v(x, .04, .76), .024, .024, c.brass, carriage));
    const tray = group(carriage); tray.position.set(0, .052, .76);
    const proof = imagePlate(w, c, tray, .9, 1.125, art); proof.g.rotation.x = -Math.PI / 2; proof.g.position.set(0, .02, -.56); held(proof.g);
    fasteners(w, c, proof.g, [-.462, .462].flatMap(x => [-.49, .49].map(y => v(x, y, -.006))), .012);
    // All carriage travel is supported by two continuous brass tracks.
    for (const z of [-.16, .82]) {
        c.beam(v(-3.2, 1.12, z), v(4.75, 1.12, z), .07, .07, c.brass);
        for (const x of [-3.1, -1.25, 1.15, 3.2, 4.65]) c.beam(v(x, 0, z), v(x, 1.09, z), .075, .075, c.iron);
    }
    const press = group(); press.position.set(0, 0, .33);
    const pressFrame=[];
    for (const x of [-.8, .8]) {
        const upright=box(.15, 2.66, .2, c.iron, press, v(x, 1.33, -.62));upright.name='press-upright';pressFrame.push(upright);
        c.cylinder(.17, .2, .12, c.brass, press, v(x, .06, -.62));
    }
    const crosshead=box(1.86, .22, .32, c.darkwood, press, v(0, 2.52, -.62));crosshead.name='press-crosshead';pressFrame.push(crosshead);
    fasteners(w, c, press, [-.8, .8].flatMap(x => [.22, 1.0, 2.47].map(y => v(x, y, -.509))), .028);
    for (const x of [-.67, .67]) {
        c.cylinder(.025, .025, 1.4, c.brass, press, v(x, 2.08, -.47));
        c.beam(v(x, 2.54, -.47), v(x, 2.54, -.62), .085, .09, c.iron, press);
    }
    c.cylinder(.14, .14, .16, c.brass, press, v(0, 2.53, -.5));
    const screw = group(press); screw.position.set(0, 2.2, -.5);
    c.cylinder(.046, .046, 1.0, c.iron, screw);
    for (let i = 0; i < 18; i++) { const r = w.ring(.071, .012, c.brass, screw); r.position.y = -.45 + i * .05; r.rotation.x = Math.PI / 2; }
    const platen = group(press); platen.name='press-platen';platen.position.set(0, 1.95, .03);
    box(1.14, .12, 1.34, c.brass, platen); box(1.05, .055, 1.22, c.iron, platen, v(0, -.08, 0));
    for (const x of [-.67, .67]) {
        c.cylinder(.061, .061, .15, c.iron, platen, v(x, 0, -.5));
        c.beam(v(Math.sign(x) * .5, 0, -.5), v(x, 0, -.5), .07, .075, c.brass, platen);
    }
    for (const z of [-.45, .45]) box(.94, .065, .055, c.darkwood, platen, v(0, .09, z));
    fasteners(w, c, platen, [-.46, .46].flatMap(x => [-.46, .46].map(z => v(x, .091, z))), .018);
    // An outboard bearing carries the wheel beside the frame. The complete
    // toothed envelope clears both the platen and the travelling print tray.
    const drive=group(press);drive.position.set(1.75,2.06,-.46);drive.rotation.y=.3;
    const flywheel=c.gear(.59,drive,c.brass,26);flywheel.name='press-flywheel';
    // Seat each spoke into the rim instead of leaving a gap at its inner edge.
    flywheel.children.filter(part=>part.geometry?.type==='BoxGeometry').forEach(spoke=>{spoke.scale.x=1.5/1.3;});
    const axleDirection=v(Math.sin(.3),0,Math.cos(.3)),bearing=drive.position.clone().addScaledVector(axleDirection,-.34);
    c.beam(v(.8,2.06,-.62),bearing,.12,.12,c.iron,press).name='bearing-outrigger';
    c.beam(v(.8,1.54,-.62),bearing.clone().add(v(-.08,-.09,0)),.065,.065,c.brass,press).name='bearing-brace';
    const bearingBlock=c.cylinder(.13,.13,.16,c.iron,drive,v(0,0,-.34));bearingBlock.rotation.x=Math.PI/2;
    const axle=c.cylinder(.041,.041,.6,c.brass,drive,v(0,0,-.14));axle.rotation.x=Math.PI/2;
    for(const z of [-.23,.14]){const collar=c.cylinder(.065,.065,.045,c.brass,drive,v(0,0,z));collar.rotation.x=Math.PI/2;}
    w.mechanicalClearances=[{moving:flywheel,obstacles:[...pressFrame,platen,carriage],margin:.025}];
    const lever = held(group()); lever.position.set(-1.44, 1.03, 1.04);
    box(.28, 1.03, .22, c.darkwood, root, v(-1.44, .515, .86)).name = 'approval-pedestal';
    held(c.beam(v(-1.44, 1.015, .86), v(-1.44, 1.015, 1.04), .065, .065, c.brass));
    c.cylinder(.1, .1, .09, c.brass, lever);
    const leverArm = group(lever); c.beam(v(), v(0, .32, 0), .036, .036, c.brass, leverArm).name = 'approval-lever';
    const knob = group(leverArm); knob.position.y = .32; w.mesh(new T.IcosahedronGeometry(.069, 1), c.wood, knob); held(knob);
    const approveSign = placard(w, c, 'APPROVE', .3, .11); approveSign.position.set(-1.44, .65, .98); approveSign.children.forEach(o => { o.name = 'approval-sign'; });
    placard(w, c, '02 / READY FOR THE WORLD', 1.5, .18, press).position.set(0, 2.47, -.43);

    // Editions emerge from a covered impression station onto real rollers.
    // Furthest destination prints first, so later sheets never pass through it.
    const editions = [];
    const outputRollers = [];
    for (const z of [-1.42, -.58]) c.beam(v(.04, .94, z), v(3.95, .94, z), .055, .055, c.brass);
    for (let i = 0; i < 29; i++) outputRollers.push(roller(w, c, root, v(.1 + i * .134, .952, -1), .81, .027));
    box(.79, .10, .93, c.darkwood, root, v(.29, 1.14, -1));
    box(.79, .22, .055, c.copper, root, v(.29, 1.07, -1.465));
    for (const x of [-.13, .65]) c.beam(v(x, .95, -1.42), v(x, 1.19, -1.42), .035, .035, c.brass);
    for (const x of [.15, 3.85]) c.beam(v(x, 0, -1), v(x, .91, -1), .065, .065, c.iron);
    for (let i = 0; i < 3; i++) {
        const width = [.48, .58, .74][i], height = [.68, .58, .43][i], x = 1.72 + i * .84;
        box(.76, .06, .85, c.darkwood, root, v(x, .93, -1.0));
        c.beam(v(x, 0, -1), v(x, .9, -1), .06, .06, c.iron);
        const editionArt = i ? campaignArtwork(c, 'poster', i === 1 ? 'post' : 'banner') : art;
        const edition = imagePlate(w, c, root, width, height, editionArt); edition.g.position.set(x, 1.023, -1.0); edition.g.rotation.x = -Math.PI / 2;
        editions.push({ ...edition, destination: x });
        placard(w, c, ['STORY', 'POST', 'BANNER'][i], .65, .15).position.set(x, .78, -.52);
    }
    // End of the track: a hinged display with a physical stop and two uprights.
    for (const dx of [-.65, .65]) c.beam(v(4.6 + dx, 0, -.17), v(4.6 + dx, 2.4, -.17), .065, .065, c.brass);
    c.beam(v(3.95, 2.4, -.17), v(5.25, 2.4, -.17), .065, .065, c.brass);
    for (const x of [3.95, 5.25]) {
        c.beam(v(x, 2.38, -.17), v(x, 2.51, .3), .025, .025, c.brass);
        c.cylinder(.14, .19, .08, c.iron, root, v(x, .04, -.17));
    }
    const reflector = box(1.42, .06, .23, c.copper, root, v(4.6, 2.51, .3)); reflector.rotation.x = -.25;
    fasteners(w, c, root, [3.95, 5.25].flatMap(x => [.3, 1.25, 2.32].map(y => v(x, y, -.131))), .016);
    placard(w, c, '03 / A CONVERSATION BEGINS', 1.65, .18).position.set(4.6, 2.55, -.12);
    c.lantern(root, v(5.45, 1.95, -.12), .65);

    // A reader's deliberate RSVP drives the pneumatic reply. Its cantilever
    // stays outboard of the moving tray, with the button below the poster.
    c.beam(v(5.25, 1.18, -.17), v(5.25, 1.18, 1.18), .035, .035, c.brass);
    c.beam(v(5.25, 1.18, 1.18), v(5.44, 1.18, 1.18), .035, .035, c.brass);
    const responseControl = held(group()); responseControl.position.set(5.44, 1.19, 1.18);
    c.cylinder(.083, .09, .07, c.iron, responseControl);
    const responseButton = group(responseControl); responseButton.position.y = .05;
    c.cylinder(.068, .068, .035, c.brass, responseButton);
    placard(w, c, 'RSVP', .25, .08, responseControl).position.set(0, -.13, .02);
    w.path([v(5.44, 1.18, 1.17), v(5.34, 1.18, -.17), v(5.34, 1.89, -.27), v(4.9, 1.9, -.78)], .017, c.copper);

    // The reply is carried by a mounted return conduit, not an orbiting token.
    const conduit = [v(4.9, 1.9, -.78), v(4.4, 2.9, -1.45), v(1.25, 3.03, -1.65), v(-2.3, 2.75, -1.65), v(-3.1, 1.4, -.8)];
    w.path(conduit, .046, c.brass);
    for (const x of [-3.1, .15, 4.9]) c.beam(v(x, 0, -1.65), v(x, 2.84, -1.65), .035, .035, c.iron);
    c.beam(v(.15,2.84,-1.65),v(1.25,3.03,-1.65),.035,.035,c.iron).name='conduit-overhead-bracket';
    const replyCurve = new T.CatmullRomCurve3(conduit);
    const capsule = group(); c.cylinder(.081, .081, .26, c.wood, capsule); c.cylinder(.086, .086, .045, c.brass, capsule, v(0, -.13)); c.cylinder(.086, .086, .045, c.brass, capsule, v(0, .13));
    const reply = imagePlate(w, c, root, .42, .53, replyArt); reply.g.rotation.x = -.6; reply.g.position.set(-3.09, 1.53, -.73);
    const inbox = box(.7, .075, .68, c.darkwood, root, v(-3.1, 1.21, -.74)); held(inbox);
    c.beam(v(-3.1, 0, -.74), v(-3.1, 1.17, -.74), .075, .075, c.iron);
    const editor = actor(w, c, v(-2.62, 0, 1.28), 1, 'editor');
    const reader = actor(w, c, v(5.6, 0, 2.1), .98, 'audience');
    const editorTrack = [frame(0, -2.62, 1.28, Math.PI, 'compose', [-2.55, 1.3, .33]), frame(.22, -2.62, 1.28, Math.PI, 'proof', [-2.55, 1.3, .33]), frame(.30, -1.2, 1.8, Math.PI, 'approach-control', [-1.44, 1.34, 1.04]), frame(.35, -1.2, 1.37, Math.PI, 'approve', [-1.44, 1.34, 1.04]), frame(.53, -1.2, 1.37, Math.PI, 'print', [0, 1.5, .33]), frame(.61, -1.1, 1.72, Math.PI, 'follow', [3, 1.4, .33]), frame(.75, -1.1, 1.72, 1.9, 'follow', [3.0, 1.4, .33]), frame(.9, -2.55, 1.5, Math.PI, 'listen', [-3.1, 1.5, -.73]), frame(1, -2.55, 1.5, Math.PI, 'receive-reply', [-3.1, 1.5, -.73])];
    const readerTrack = [frame(0, 5.6, 2.1, -2.8, 'wait', [4.6, 1.8, .33]), frame(.71, 5.6, 2.1, -2.8, 'notice', [4.6, 1.8, .33]), frame(.87, 5.18, 1.55, -2.62, 'read', [4.6, 1.8, .33]), frame(1, 5.18, 1.55, -2.62, 'reply', [4.6, 1.8, .33])];
    w.anchor('publication', proof.g, v(0, .18)); w.anchor('audience', reader.g, v(0, 1.95));
    w.motions.push((p, t) => {
        perform(w, editor, editorTrack, p, t); perform(w, reader, readerTrack, p, t);
        const approval = range(p, .355, .385), enter = range(p, .395, .45), compression = Math.sin(range(p, .46, .58) * Math.PI), dispatch = range(p, .6, .8), display = range(p, .79, .87), response = range(p, .925, .99);
        leverArm.rotation.x = -.52 * approval;
        carriage.position.x = lerp(-2.55, 0, enter) + 4.6 * dispatch;
        tray.rotation.x = display * Math.PI / 2;
        platen.position.y = 1.95 - compression * .545;
        screw.position.y = platen.position.y + .56;
        screw.rotation.y = range(p, .46, .58) * TAU * 1.5;
        flywheel.rotation.z = -range(p, .38, .59) * TAU * 2.2;
        editions.forEach(({ g, destination }, i) => {
            const out = range(p, .515 + (2 - i) * .044, .564 + (2 - i) * .044);
            g.visible = out > .001; g.position.x = lerp(.29, destination, out);
        });
        outputRollers.forEach(r => { r.rotation.z = -range(p, .515, .652) * TAU * 3.6; });
        capsule.visible = response > 0 && response < .99; capsule.position.copy(replyCurve.getPoint(response)); capsule.quaternion.setFromUnitVectors(v(0, 1, 0), replyCurve.getTangent(response));
        reply.g.visible = response > .96;
        responseButton.position.y = .05 - .018 * range(p, .913, .928);
        root.updateMatrixWorld(true);
        const proofing = 1 - range(p, .185, .215);
        if (proofing > .001) {
            reach(editor, 0, proof.g, v(.27, -.51, .055), proofing, .35);
            reach(editor, 1, proof.g, v(-.27, -.51, .06), proofing, .28);
        }
        const approveHand = range(p, .335, .355) * (1 - range(p, .39, .44));
        if (approveHand > .001) reach(editor, 1, knob, v(0, .025, .055), approveHand, .65);
        const respondHand = range(p, .872, .914);
        const buttonContact=respondHand>.001?pressResponse(reader,0,responseButton,respondHand):null;
        w.touchContact=respondHand>.999?buttonContact:null;
        w.caption = p < .29 ? { speaker: 'EDITOR', text: 'One idea. Our voice. Ready to share.' } : p < .6 ? { speaker: 'EDITOR', text: 'Approved. Prepare it for each audience.' } : p < .8 ? { speaker: 'MESSAGE', text: 'Prepared for each audience.' } : p < .87 ? { speaker: 'READER', text: 'Good things grow together.' } : { speaker: 'READER', text: 'Count me in. See you there.' };
        finishStory(w, p, { task: p < .29 ? 'An editor develops and proofs one recognizable message.' : p < .6 ? 'Approval starts the press and produces audience-specific editions.' : p < .87 ? 'The same message travels on its carriage to a public display.' : 'A reader responds; their reply returns to the editor.', owner: p < .8 ? 0 : 1, approved: approval, delivered: display, reply: response, carriage: carriage.position.toArray() });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [-3.45, 2.45, 3.65], look: [-2.58, 1.35, .42], fov: 40 },
        { p: .2, eye: [-3.65, 2.2, 3.15], look: [-2.45, 1.36, .43], fov: 42 },
        { p: 1 / 3, eye: [-2.9, 1.94, 3.85], look: [-1.3, 1.45, .56], fov: 43 },
        { p: .49, eye: [-1.15, 1.65, 3.62], look: [.05, 1.51, .15], fov: 43 },
        { p: 2 / 3, eye: [2.8, 2.35, 4.45], look: [1.55, 1.33, .06], fov: 46 },
        { p: .84, eye: [6.65, 2.2, 3.9], look: [4.59, 1.68, .31], fov: 43 },
        { p: 1, eye: [7.05, 2.7, 4.65], look: [4.62, 1.62, .94], fov: 46 },
    ] };
}

function gardenArtwork(c) {
    return c.texture((ctx, width, height) => {
        ctx.fillStyle = '#657a65'; ctx.fillRect(0, 0, width, height);
        const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#9eae87'); gradient.addColorStop(1, '#344f46'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ecd6a1'; ctx.beginPath(); ctx.arc(width * .75, height * .27, height * .15, 0, TAU); ctx.fill();
        // An engraved conservatory and path sit behind the planting. The
        // photograph's subject is the same welcoming place the visitor books.
        ctx.strokeStyle = '#e0d4ad'; ctx.lineWidth = 3; ctx.globalAlpha = .52;
        const floor = height * .73, ridge = height * .26;
        for (let i = 0; i < 7; i++) {
            const x = width * (.08 + i * .069);
            ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x, ridge + height * .13); ctx.quadraticCurveTo(x + width * .034, ridge, x + width * .069, ridge + height * .13); ctx.lineTo(x + width * .069, floor); ctx.stroke();
        }
        for (const y of [.43, .56, .68]) { ctx.beginPath(); ctx.moveTo(width * .08, height * y); ctx.lineTo(width * .565, height * y); ctx.stroke(); }
        ctx.globalAlpha = .36; ctx.fillStyle = '#d6bc89'; ctx.beginPath(); ctx.moveTo(width * .31, floor); ctx.bezierCurveTo(width * .42, floor, width * .63, height * .78, width * .56, height); ctx.lineTo(width * .79, height); ctx.bezierCurveTo(width * .83, height * .82, width * .43, height * .66, width * .31, floor); ctx.fill(); ctx.globalAlpha = 1;
        for (let i = 0; i < 16; i++) {
            const x = i / 15 * width, h = height * (.32 + (i * 7 % 9) / 18);
            ctx.strokeStyle = '#d7d2ad'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, height); ctx.bezierCurveTo(x - 46, height - h * .35, x + 42, height - h * .75, x, height - h); ctx.stroke();
            for (let j = 0; j < 5; j++) { ctx.save(); ctx.translate(x + Math.sin(j * 1.7) * 22, height - h + j * h / 6); ctx.rotate(j % 2 ? .7 : -.7); ctx.fillStyle = j % 2 ? '#a2b384' : '#e0caa1'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 31, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        }
        ctx.strokeStyle = '#eadfc1'; ctx.globalAlpha = .12; ctx.lineWidth = 1;
        for (let y = 8; y < height; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        ctx.globalAlpha = 1;
    }, 960, 640);
}

function creativeAtelier(w, c) {
    const { root, group, box } = w;
    const glass = new T.MeshPhysicalMaterial({ color: '#b1c0a4', metalness: .05, roughness: .24, transparent: true, opacity: .09, side: T.DoubleSide, depthWrite: false });
    c.beam(v(-6, 5, -.6), v(6, 5, -.6), .065, .085, c.brass);
    for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 2.2;
        for (const back of [true, false]) {
            const z0 = back ? -3.4 : -.6, z1 = back ? -.6 : 2.4, y0 = back ? 4.1 : 5, y1 = back ? 5 : 4.2;
            const geo = new T.BufferGeometry();
            geo.setAttribute('position', new T.Float32BufferAttribute([x - 1, y0, z0, x + 1, y0, z0, x + 1, y1, z1, x - 1, y1, z1], 3));
            geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
            w.mesh(geo, glass, root);
            for (let j = 1; j < 4; j++) {
                const f = j / 4;
                c.beam(v(x - 1, lerp(y0, y1, f), lerp(z0, z1, f)), v(x + 1, lerp(y0, y1, f), lerp(z0, z1, f)), .013, .022, c.brass);
            }
        }
        box(1.85, .37, .77, c.stone, root, v(x, .185, -4.43));
        for (const dx of [-.56, 0, .56]) c.plant(root, v(x + dx, .37, -4.43), 1.05);
        c.beam(v(x - .8, .43, -4.2), v(x - .8, 2.1, -4.2), .024, .024, c.brass);
        c.beam(v(x + .8, .43, -4.2), v(x + .8, 2.1, -4.2), .024, .024, c.brass);
        for (const y of [.95, 1.5, 2.05]) c.beam(v(x - .8, y, -4.2), v(x + .8, y, -4.2), .015, .015, c.brass);
    }
    // The two benches frame the page without entering its actors' working bay.
    const bench = c.desk(root, v(-3.74, 1.16, -.71), 1.68, 1.06);
    const specimen = c.folio('FIELDWORK', 'TYPE / COLOUR / COMPOSITION', bench, .61, .68); specimen.position.set(.29, .098, -.03); specimen.rotation.y = -.14;
    const typecase = group(bench); typecase.position.set(-.43, .08, -.07);
    box(.55, .04, .74, c.darkwood, typecase);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        box(.149, .037, .15, c.wood, typecase, v((i - 1) * .177, .04, (j - 1.5) * .174));
        const character = label(w, c, 'FIELDWORK&abc'[i + j * 3], .128, .13, typecase, v((i - 1) * .177, .061, (j - 1.5) * .174), 480, '#b4a181'); character.rotation.x = -Math.PI / 2;
    }
    c.lantern(bench, v(-.62, .3, -.42), .6);
    const ruler = box(1.26, .014, .071, c.brass, bench, v(.01, .066, .43));
    fasteners(w, c, ruler, Array.from({ length: 29 }, (_, i) => v((i - 14) * .04, .009, 0)), .006);
    const cabinet = group(); cabinet.position.set(3.82, 0, -1.08);
    for (const x of [-.6, .6]) box(.1, 2.4, .11, c.darkwood, cabinet, v(x, 1.2, -.16));
    for (const y of [.13, .85, 1.56, 2.3]) box(1.32, .065, .62, c.wood, cabinet, v(0, y, 0));
    for (let i = 0; i < 9; i++) {
        const book = box(.075, .39 + (i % 3) * .08, .38, i % 3 === 0 ? c.copper : i % 3 === 1 ? c.paper : c.darkwood, cabinet, v((i - 4) * .123, 1.08 + (i % 3) * .04, 0));
        box(.055, .03, .01, c.brass, book, v(0, .1, .2));
    }
    for (let i = 0; i < 3; i++) {
        const sheet = c.folio(['Imagery', 'Letters', 'Colour'][i], 'FIELD NOTES', cabinet, .33, .45); sheet.position.set((i - 1) * .4, 1.65, .02);
        const sample = c.cylinder(.105, .105, .026, [c.greenLight, c.paper, c.copper][i], cabinet, v((i - 1) * .38, 2.35, .025)); sample.rotation.z = -.1;
    }
    c.plant(cabinet, v(-.32, 2.35, -.1), .55);
    const engraving = imagePlate(w, c, root, .7, 1.0, gardenArtwork(c)); engraving.g.position.set(-4.63, 2.31, -1.65); engraving.g.rotation.y = .23;
    c.beam(v(-4.63, 1.12, -1.86), v(-4.63, 2.96, -1.9), .065, .065, c.darkwood);
    c.beam(v(-4.63, 2.31, -1.9), v(-4.63, 2.31, -1.68), .07, .07, c.brass);
    for (const x of [-4.93, -4.33]) c.beam(v(x, 0, -1.43), v(-4.63, 2.64, -1.85), .045, .05, c.brass);
}

export function buildCMS(w, c) {
    architecture(w, c, { width: 13, depth: 12, height: 5.8 });
    const { root, group, box } = w;
    // A conservatory with visible joinery, growing vines, and a distant garden.
    for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 2.2;
        c.arch(root, 2.03, 4.4, v(x, .25, -3.4), i % 2 === 0);
        c.beam(v(x - 1, 4.1, -3.4), v(x - .3, 5.0, -.6), .035, .035, c.brass);
        c.beam(v(x - .3, 5.0, -.6), v(x + .2, 4.2, 2.4), .035, .035, c.brass);
        if (i % 2 === 0) c.plant(root, v(x, 0, -2.8), 1.75);
    }
    c.plant(root, v(-3.2, 0, .05), 1.8); c.plant(root, v(3.4, 0, -.3), 1.5);
    c.lantern(root, v(-2.9, 2.6, -.25), .85); c.lantern(root, v(2.9, 2.6, -.25), .85);
    for (const sign of [-1, 1]) {
        c.beam(v(sign * 3.3, 3.15, -3.4), v(sign * 2.9, 3.15, -.25), .03, .035, c.brass);
        c.beam(v(sign * 2.9, 3.15, -.25), v(sign * 2.9, 2.95, -.25), .012, .012, c.iron);
    }
    creativeAtelier(w, c);
    const page = group(); page.position.set(0, 1.8, .0);
    const backing = box(4.5, 2.85, .085, c.paper, page); held(backing);
    const left = group(page), right = group(page);
    for (const side of [left, right]) {
        box(.09, 2.98, .16, c.brass, side);
        for (const y of [-1.45, 1.45]) box(.16, .16, .19, c.darkwood, side, v(0, y, -.015));
        fasteners(w, c, side, Array.from({ length: 23 }, (_, i) => v(0, (i - 11) * .12, .089)), .009);
    }
    const top = box(4.64, .085, .16, c.brass, page, v(0, 1.47));
    const bottom = box(4.64, .085, .16, c.brass, page, v(0, -1.47));
    // The frame rides on a floor rack. Its feet, guides and counterweights
    // remain mechanically connected as the page changes width and height.
    for (const z of [-.25, -.65]) c.beam(v(-2.55, .14, z), v(2.55, .14, z), .045, .045, c.brass);
    const supports = [-1, 1].map(sign => {
        const g = group();
        box(.42, .13, .88, c.darkwood, g, v(0, .065, -.34));
        c.beam(v(0, .11, -.6), v(0, 1.75, -.14), .055, .055, c.iron, g);
        const guide = c.cylinder(.021, .021, 1, c.iron, g, v(0, 0, -.19));
        const pulley = group(g); pulley.position.z = -.19;
        const wheel = c.cylinder(.09, .09, .06, c.brass, pulley); wheel.rotation.x = Math.PI / 2;
        const line = c.cylinder(.006, .006, 1, c.iron, g, v(sign * .09, 0, -.2));
        const counterweight = box(.095, .34, .105, c.brass, g, v(sign * .09, 1.6, -.2));
        const cog = c.gear(.098, g, c.brass, 16); cog.position.set(0, .25, -.18);
        for (const y of [.24, 1.72]) box(.16, .09, .2, c.brass, g, v(0, y, -.15));
        c.beam(v(0, .375, -.19), v(0, .375, 0), .06, .06, c.brass, g);
        return { g, sign, guide, pulley, line, counterweight, cog };
    });
    const rack = new T.InstancedMesh(new T.BoxGeometry(.024, .033, .048), c.iron, 102), rackDummy = new T.Object3D();
    for (let i = 0; i < 102; i++) { rackDummy.position.set((i - 50.5) * .049, .16, -.21); rackDummy.updateMatrix(); rack.setMatrixAt(i, rackDummy.matrix); } root.add(rack);
    const brand = label(w, c, 'FIELDWORK', 1.2, .21, page, v(-1.45, 1.16, .065), 67);
    const nav = label(w, c, 'ABOUT     JOURNAL     VISIT', 1.45, .16, page, v(1.13, 1.16, .065), 35);
    const headerRule = box(4.03, .014, .008, c.brass, page, v(0, .97, .06));
    const title = label(w, c, 'A little room\nto grow.', 1.9, .61, page, v(-1.07, .55, .06), 77);
    const intro = label(w, c, 'A garden for people\nand the ideas they bring.', 1.87, .3, page, v(-1.07, .08, .06), 43);
    const picture = imagePlate(w, c, page, 1.85, 1.19, gardenArtwork(c), '#ffffff'); picture.g.position.set(1.06, .35, .1); held(picture.g);
    const cards = ['Gather here.\nMeet the people.', 'Make something.\nFind your next idea.'].map((words, i) => {
        const card = group(page); card.position.set(i ? 1.03 : -1.03, -.77, .085);
        box(1.83, .52, .025, i ? c.wood : c.stone, card, v(0, 0, -.014));
        label(w, c, words, 1.76, .45, card, v(0, 0, .005), 54, i ? '#d4c4af' : '#d8d7b8'); held(card); return card;
    });
    // The creator works with the card at hand height, on visible layout rails.
    const layoutRails = [-1.03, -.5].map(y => box(4.16, .009, .01, c.brass, page, v(0, y, .03)));
    const button = group(page); button.position.set(0, -1.18, .085);
    const buttonMat = new T.MeshStandardMaterial({ color: '#746582', roughness: .7, emissive: '#73637e', emissiveIntensity: .08 });
    box(1.13, .23, .055, buttonMat, button);
    const buttonText = label(w, c, 'PLAN YOUR VISIT  >', 1.07, .17, button, v(0, 0, .03), 45, '#c9bbd3'); held(button);
    const success = label(w, c, 'YOUR VISIT STARTS HERE', 1.2, .16, page, v(0, -.93, .15), 38, '#d4deba'); success.visible = false;
    const creator = actor(w, c, v(1.1, 0, .56), 1, 'creator');
    const visitor = actor(w, c, v(2.3, 0, 1.65), 1, 'visitor');
    const creatorTrack = [frame(0, 1.1, .56, Math.PI, 'place-image', [1.06, 1.5, .14]), frame(.17, 1.1, .56, Math.PI, 'compose', [1.06, 1.9, .14]), frame(.28, -1.15, .52, Math.PI, 'select-section', [-1.03, 1.04, .12]), frame(.34, -1.15, .52, Math.PI, 'reorder', [-1.03, 1.04, .12]), frame(.43, -.57, .7, Math.PI, 'reorder', [-.5, 1.04, .12]), frame(.58, -1.45, 1.28, 2.5, 'preview', [0, 2, 0]), frame(.77, -1.45, 1.28, 2.5, 'review-mobile', [0, 2, 0]), frame(1, -1.45, 1.28, 2.5, 'observe-visitor', [.36, 1.4, .52])];
    const visitorTrack = [frame(0, 2.3, 1.65, -2.4, 'wait', [0, 1.8, .1]), frame(.74, 2.3, 1.65, -2.4, 'arrive', [0, 1.8, .1]), frame(.89, .39, .47, Math.PI, 'read', [0, 2.05, .1]), frame(1, .39, .47, Math.PI, 'use-page', [.19, 1.12, .14])];
    const viewportLabel = placard(w, c, 'ONE PAGE / EVERY VIEW', 1.5, .17); viewportLabel.position.set(0, 3.62, -.05);
    w.anchor('page', page, v(0, 1.6)); w.anchor('visitor-action', button, v(0, .26));
    w.motions.push((p, t) => {
        perform(w, creator, creatorTrack, p, t); perform(w, visitor, visitorTrack, p, t);
        const place = range(p, 0, .17), reorder = range(p, .325, .43), tablet = range(p, .5, .65), mobile = range(p, .68, .81), press = range(p, .92, .97);
        const flow = tablet, width = lerp(4.5, 2.65, tablet) - .93 * mobile, height = 2.85 + .73 * tablet;
        page.position.y = .375 + height / 2;
        backing.scale.set(width / 4.5, height / 2.85, 1);
        left.position.set(-width / 2 - .025, 0, 0); right.position.set(width / 2 + .025, 0, 0); left.scale.y = right.scale.y = height / 2.85;
        top.position.y = height / 2 + .045; bottom.position.y = -height / 2 - .045; top.scale.x = bottom.scale.x = (width + .14) / 4.64;
        supports.forEach(({ g, sign, guide, pulley, line, counterweight, cog }) => {
            g.position.x = sign * (width / 2 + .025);
            const high = height + .54, low = 1.6 - .73 * tablet;
            guide.position.y = (high + .15) / 2; guide.scale.y = high - .15;
            pulley.position.y = high; pulley.rotation.z = -sign * tablet * .73 / .09;
            counterweight.position.y = low;
            line.position.y = (high + low + .17) / 2; line.scale.y = high - low - .17;
            cog.rotation.z = -g.position.x / .105;
        });
        layoutRails.forEach(rail => { rail.scale.x = (width - .34) / 4.16; });
        const headerY = height / 2 - .22;
        brand.position.set(lerp(-1.45, 0, flow), headerY, .066); brand.scale.setScalar(lerp(1, .88, mobile));
        nav.visible = tablet < .8; nav.material.transparent = true; nav.material.opacity = 1 - tablet;
        headerRule.position.y = headerY - .19; headerRule.scale.x = (width - .32) / 4.03;
        title.position.set(lerp(-1.07, 0, flow), lerp(.55, height / 2 - .73, flow), .066); title.scale.set(lerp(1, .69, mobile), lerp(1, .8, mobile), 1);
        intro.position.set(lerp(-1.07, 0, flow), lerp(.08, height / 2 - 1.2, flow), .067); intro.scale.setScalar(lerp(1, .65, mobile));
        picture.g.position.set(lerp(1.06, 0, flow), lerp(-.1 + place * .45, 0, flow), lerp(.22, .105, place)); picture.g.scale.setScalar(lerp(1, .71, tablet) * lerp(1, .85, mobile));
        cards.forEach((card, i) => {
            const x = lerp(i ? 1.03 : -1.03, i ? -1.03 : 1.03, reorder);
            card.position.set(x * (1 - flow), lerp(-.77 + Math.sin(reorder * Math.PI) * (i ? -.05 : .1), i ? -.9 : -.57, flow), .085 + (i ? 0 : Math.sin(reorder * Math.PI) * .065));
            card.scale.set(lerp(1, .7, flow), lerp(1, .5, flow), 1);
        });
        button.position.y = lerp(-1.18, -height / 2 + .625, flow); button.position.z = .085 - press * .014;
        buttonMat.emissiveIntensity = .08 + press * .52;
        buttonText.visible = press < .98; success.visible = press >= .98;
        success.position.set(0, button.position.y, .13); success.scale.x = .87;
        viewportLabel.position.y = page.position.y + height / 2 + .3;
        root.updateMatrixWorld(true);
        const imageContact = (1 - range(p, .14, .18));
        if (imageContact > .001) { reach(creator, 0, picture.g, v(.35, -.54, .07), imageContact, .48); reach(creator, 1, picture.g, v(-.3, -.54, .07), imageContact, .48); }
        const cardContact = range(p, .275, .295) * (1 - range(p, .31, .325));
        if (cardContact > .001) reach(creator, 1, cards[0], v(-.15, .17, .08), cardContact, .26);
        const tap = range(p, .88, .94);
        if (tap > .001) reach(visitor, 1, button, v(.17, .07, .075), tap, .21);
        w.caption = p < .25 ? { speaker: 'CREATOR', text: 'Start with a story people can see themselves in.' } : p < .5 ? { speaker: 'CREATOR', text: 'Put the useful part where people will find it.' } : p < .85 ? { speaker: 'CREATOR', text: 'The same story, comfortably on every screen.' } : { speaker: 'VISITOR', text: press > .98 ? 'Perfect. I know where to go next.' : 'This is for me. Let me plan a visit.' };
        finishStory(w, p, { task: p < .25 ? 'A creator places the opening image and gives the page a clear story.' : p < .5 ? 'The creator brings the most useful section forward.' : p < .85 ? 'The same page reflows continuously from desktop to tablet to mobile.' : 'A visitor uses the primary action and receives confirmation.', owner: p < .85 ? 0 : 1, layout: mobile > .8 ? 'mobile' : tablet > .8 ? 'tablet' : 'desktop', viewportWidth: width, imagePlaced: place, reordered: reorder, converted: press });
    });
    return { cinematic: true, shots: [
        { p: 0, eye: [2.8, 2.26, 3.6], look: [.85, 1.65, .06], fov: 44 },
        { p: .17, eye: [3.12, 2.55, 4.2], look: [.45, 1.85, .02], fov: 45 },
        { p: 1 / 3, eye: [-2.38, 1.97, 3.5], look: [-.65, 1.3, .09], fov: 43 },
        { p: .49, eye: [-2.05, 2.5, 4.8], look: [0, 1.9, .03], fov: 45 },
        { p: 2 / 3, eye: [-.7, 2.5, 4.7], look: [0, 2.0, .02], fov: 43 },
        { p: .83, eye: [1.2, 2.4, 4.3], look: [.03, 1.95, .08], fov: 43 },
        { p: 1, eye: [1.87, 1.95, 3.37], look: [.03, 1.67, .13], fov: 43 },
    ] };
}
