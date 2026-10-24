/* Seven procedural worlds. All geometry, typography, lighting and motion are authored locally.
 * No remote models, textures, video, telemetry or frame-dependent scroll simulation. */
import { THREE as T, RoomEnvironment, EffectComposer, RenderPass, SSAOPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAShader } from './three-runtime.js';
import { sceneLabels } from './scene-choreography';
import { buildCinematicWorld } from './cinematic-worlds.js';
import {lightWorld,FilmGrade,CinematicFocus} from './cinematic-lighting.js';

const TAU = Math.PI * 2;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const seed = i => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
function key(p, values) {
    const segment = Math.min(2, Math.floor(clamp(p) * 3));
    const t = smooth(p * 3 - segment);
    return typeof values[0] === 'number' ? mix(values[segment], values[segment + 1], t) : values[segment].clone().lerp(values[segment + 1], t);
}
function workshop(color) {
    const root = new T.Group(), anchors = new Map(), motions = [], people = [], solids = [], accent = new T.Color(color);
    const group = (parent = root) => { const g = new T.Group(); parent.add(g); return g; };
    const mesh = (geometry, material, parent = root, position = v()) => { const m = new T.Mesh(geometry, material); m.position.copy(position); parent.add(m); return m; };
    const box = (width, height, depth, material, parent = root, position = v()) => mesh(new T.BoxGeometry(width, height, depth), material, parent, position);
    const ring = (radius, tube, material, parent = root, arc = TAU) => mesh(new T.TorusGeometry(radius, tube, 6, 64, arc), material, parent);
    const path = (points, radius, material, parent = root) => mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 72, radius, 6, false), material, parent);
    const anchor = (id, object, offset = v()) => anchors.set(id, { object, offset });
    return { root, anchors, motions, people, solids, accent, group, mesh, box, ring, path, anchor };
}

function atmosphere(scene, accent, mobile) {
    const count = mobile ? 360 : 720, geometry = new T.BufferGeometry(), points = new Float32Array(count * 3), sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) { const a = seed(i * 3) * TAU, r = 2.7 + seed(i * 3 + 1) * 4; points.set([Math.cos(a) * r, (seed(i + 8) - .5) * 6, Math.sin(a) * r - 2], i * 3); sizes[i] = .5 + seed(i + 19); }
    geometry.setAttribute('position', new T.BufferAttribute(points, 3)); geometry.setAttribute('size', new T.BufferAttribute(sizes, 1));
    const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uAccent: { value: accent } },
        vertexShader: `attribute float size; uniform float uTime; uniform float uPixel; varying float alpha; void main(){vec3 p=position; p.x+=sin(p.y*.7+uTime*.09)*.12;p.y+=sin(p.z+uTime*.07)*.1; vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=size*uPixel*13./max(2.,-mv.z);alpha=.12+size*.15;}`,
        fragmentShader: `uniform vec3 uAccent;varying float alpha;void main(){float d=length(gl_PointCoord-.5);float a=exp(-d*d*28.)*alpha;gl_FragColor=vec4(mix(uAccent,vec3(.65,.78,.9),.55),a);}` });
    const dust = new T.Points(geometry, material); scene.add(dust);
    const haze = new T.Mesh(new T.PlaneGeometry(12, 12), new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uAccent: { value: accent } },
        vertexShader: `varying vec2 uvPoint;void main(){uvPoint=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform vec3 uAccent;varying vec2 uvPoint;void main(){vec2 p=(uvPoint-.5)*2.;float r=length(p*vec2(1.,1.3));float glow=exp(-r*r*5.)*.04;float ring=exp(-pow(r-.55,2.)*160.)*.008;gl_FragColor=vec4(uAccent,glow+ring);}` })); haze.position.z = -3.5; scene.add(haze);
    return (time, camera, pixel) => { material.uniforms.uTime.value = time; material.uniforms.uPixel.value = pixel; haze.quaternion.copy(camera.quaternion); dust.rotation.y = time * .003; };
}

export function createWorldRenderer(canvas, kind, color) {
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }); }
    catch { return null; }
    const mobile = window.innerWidth <= 800;
    renderer.setClearColor('#17130e', 1); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.info.autoReset = false;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 1, .08, 110);
    const environment = new RoomEnvironment(), generator = new T.PMREMGenerator(renderer), envTarget = generator.fromScene(environment, .04);
    scene.environment = envTarget.texture; scene.environmentIntensity = .42; environment.dispose(); generator.dispose();
    const lightFocus=lightWorld(scene,kind,mobile);
    const w = workshop(color), direction = buildCinematicWorld(w, kind); scene.add(w.root);
    w.root.traverse(object => { if (object.isMesh) { const materials=Array.isArray(object.material)?object.material:[object.material];object.castShadow = materials.some(material=>!material.transparent); object.receiveShadow = true; } });
    const ambiance = atmosphere(scene, new T.Color('#cead6c'), mobile);
    // Enabled only by the geometry regression harness; absent from ordinary page renders.
    const audit = window.__BASALT_SCENE_AUDIT__ === true;
    const partBox = new T.Box3(), overlap = new T.Box3(), size = v();
    const colliders = audit ? w.solids.map((solid,index)=>{solid.geometry.computeBoundingBox();return {solid,box:new T.Box3(),name:solid.name||`${solid.geometry.type}-${index}`,tube:solid.geometry.type==='TubeGeometry'?solid.geometry.parameters.path.getPoints(256):null};}) : [];
    if(audit)w.people.forEach(human=>human.parts.forEach(part=>part.geometry.computeBoundingBox()));
    const composer = new EffectComposer(renderer), renderPass = new RenderPass(scene, camera), bloom = new UnrealBloomPass(new T.Vector2(1, 1), .2, .45, 2.05), grade=new ShaderPass(FilmGrade),output = new OutputPass(), antialias = new ShaderPass(FXAAShader);
    composer.addPass(renderPass);
    // Half-resolution contact occlusion grounds hinges, joinery and layered paper.
    // Mobile keeps the cheaper baked-looking sun shadows and the same materials.
    const occlusion=mobile?null:new SSAOPass(scene,camera,1,1,12);
    if(occlusion){
        occlusion.kernelRadius=.28;occlusion.minDistance=.001;occlusion.maxDistance=.035;
        const excluded=[];scene.traverse(object=>{if(object.isMesh&&(object.name==='atmospheric-sky'||(Array.isArray(object.material)?object.material:[object.material]).every(material=>material.transparent||!material.depthWrite)))excluded.push(object);});
        const renderAO=occlusion.render.bind(occlusion);
        occlusion.render=(...args)=>{const visibility=excluded.map(object=>object.visible);excluded.forEach(object=>{object.visible=false;});try{renderAO(...args);}finally{excluded.forEach((object,i)=>{object.visible=visibility[i];});}};
        composer.addPass(occlusion);
    }
    const focus=occlusion?new ShaderPass(CinematicFocus):null;
    if(focus){focus.uniforms.tDepth.value=occlusion.normalRenderTarget.depthTexture;composer.addPass(focus);}
    composer.addPass(bloom);composer.addPass(grade); composer.addPass(output); composer.addPass(antialias);
    let width = 0, height = 0, pixel = 1, disposed = false, shadowProgress = -1;
    const screen = v(), world = v(), pointer = v(), pointerTarget = v();
    const aim = event => {
        const bounds = canvas.getBoundingClientRect();
        if (event.pointerType === 'touch' || event.clientY < bounds.top || event.clientY > bounds.bottom) { pointerTarget.set(0, 0, 0); return; }
        pointerTarget.set(clamp((event.clientX - bounds.left) / bounds.width) * 2 - 1, 1 - clamp((event.clientY - bounds.top) / bounds.height) * 2, 0);
    };
    window.addEventListener('pointermove', aim, { passive: true });
    canvas.dataset.engine = 'three-r184'; canvas.dataset.accent = color;
    return {
        render(progress, time, reduced) {
            if (disposed) return [];
            const rect = canvas.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return [];
            if (width !== rect.width || height !== rect.height) {
                width = rect.width; height = rect.height; pixel = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.65, Math.sqrt((mobile ? 1000000 : 2800000) / (width * height)));
                renderer.setPixelRatio(pixel); renderer.setSize(width, height, false); composer.setPixelRatio(pixel); composer.setSize(width, height);
                occlusion?.setSize(Math.max(1,Math.round(width*pixel*.6)),Math.max(1,Math.round(height*pixel*.6)));
                focus?.uniforms.resolution.value.set(width*pixel,height*pixel);
                antialias.uniforms.resolution.value.set(1 / (width * pixel), 1 / (height * pixel));
                camera.aspect = width / height; camera.updateProjectionMatrix();
            }
            const p = clamp(progress), t = reduced ? 0 : time;
            w.reduced=reduced;
            w.motions.forEach(update => update(p, t));
            const shot=direction.shot(p),position=shot.position,target=shot.target;
            camera.fov=shot.fov;camera.updateProjectionMatrix();
            // Preserve the composition on narrow portrait canvases without stretching geometry.
            const immersive = canvas.closest('.bm-scene')?.dataset.layout === 'immersive', portrait = width <= 750 && height > width;
            const portraitScale=Math.min(1.4,.74/camera.aspect);
            position.sub(target).multiplyScalar(Math.max(1,immersive&&portrait?portraitScale:.98/camera.aspect)).add(target);
            if (immersive) {
                const hero = Boolean(canvas.closest('.bm-hero'));
                camera.setViewOffset(width, height, portrait ? 0 : -width * .18, portrait ? height * (hero ? .24 : .17) : 0, width, height);
            } else camera.clearViewOffset();
            // SSAOPass caches these at resize. The authored lens and off-center
            // framing change per shot, so depth reconstruction must follow them.
            if(occlusion){
                occlusion.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
                occlusion.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
            }
            if (reduced) pointer.set(0, 0, 0); else pointer.lerp(pointerTarget, .065);
            camera.position.copy(position).add(v(pointer.x * .25, pointer.y * .16)); camera.lookAt(target); camera.updateMatrixWorld();
            if(focus)focus.uniforms.focusDistance.value=camera.position.distanceTo(target);
            lightFocus(target);ambiance(t, camera, pixel); scene.updateMatrixWorld();
            if (audit) {
                const contacts = [];
                for(const {solid,box} of colliders)box.copy(solid.geometry.boundingBox).applyMatrix4(solid.matrixWorld);
                for (const human of w.people) for (const part of human.parts) {
                    partBox.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld);
                    for (const {box,name} of colliders) {
                        if (!partBox.intersectsBox(box)) continue;
                        overlap.copy(partBox).intersect(box).getSize(size);
                        if (Math.min(size.x, size.y, size.z) > .008) contacts.push(`${w.people.indexOf(human)}:${part.name}:${name}`);
                    }
                }
                canvas.dataset.contacts = JSON.stringify(contacts);
                const movingBounds=new T.Box3(),obstacleBounds=new T.Box3();
                canvas.dataset.mechanicalContacts=JSON.stringify((w.mechanicalClearances||[]).flatMap(({moving,obstacles,margin})=>{
                    movingBounds.setFromObject(moving,true).expandByScalar(margin);
                    return obstacles.filter(obstacle=>movingBounds.intersectsBox(obstacleBounds.setFromObject(obstacle,true))).map(obstacle=>`${moving.name}:${obstacle.name}`);
                }));
                canvas.dataset.contactGeometry=JSON.stringify(colliders.filter(c=>contacts.some(contact=>contact.endsWith(`:${c.name}`))).map(c=>({name:c.name,min:c.box.min.toArray(),max:c.box.max.toArray()})));
                canvas.dataset.cameraContacts=JSON.stringify(colliders.filter(c=>{
                    if(!c.box.containsPoint(camera.position))return false;
                    if(!c.tube)return true;
                    // A vaulted rib's box includes the empty room below it. Test its tube itself.
                    const point=c.solid.worldToLocal(camera.position.clone()),radius=c.solid.geometry.parameters.radius;
                    return c.tube.some(sample=>sample.distanceToSquared(point)<radius*radius);
                }).map(c=>c.name));
                canvas.dataset.mounts=JSON.stringify((w.mounts||[]).map(({base,pivot,arm})=>({base:base.getWorldPosition(v()).toArray(),connection:arm.getWorldPosition(v()).distanceTo(pivot.getWorldPosition(v()))})));
                canvas.dataset.narrative=JSON.stringify(w.narrative);
                canvas.dataset.kinetic=JSON.stringify({subjects:(w.kineticSubjects||[]).map(object=>({name:object.name,matrix:object.matrixWorld.toArray(),visible:object.visible})),people:w.people.length});
                canvas.dataset.shot=JSON.stringify({position:position.toArray(),target:target.toArray(),fov:camera.fov});
                canvas.dataset.workContact=JSON.stringify(w.workContact?{error:w.workContact.pen.localToWorld(w.workContact.nib?.clone()||v(0,-.16,0)).distanceTo(w.workContact.point)}:null);
                canvas.dataset.handoffAudit=JSON.stringify(w.handoffAudit||null);
                canvas.dataset.touchContact=JSON.stringify(w.touchContact?{error:w.touchContact.pad.getWorldPosition(v()).distanceTo(w.touchContact.point)}:null);
                canvas.dataset.figures = JSON.stringify(w.people.map(h => ({ height: h.g.userData.height, head: h.g.userData.headHeight, parts: h.parts.length, activity:h.activity, action:h.g.userData.action, position:h.g.position.toArray(), hands:h.handTargets, stance:h.stance, feet:h.legs.map(r=>{const box=new T.Box3().setFromObject(r.foot);return{minimum:box.min.y,center:r.ankle.getWorldPosition(v()).toArray(),rotation:r.leg.quaternion.toArray()};}) })));
            }
            // Only scroll moves the physical installation. Dust does not cast
            // shadows, so holding a shot can reuse its shadow map.
            if (Math.abs(p - shadowProgress) > .001) { renderer.shadowMap.needsUpdate = true; shadowProgress = p; }
            renderer.info.reset(); composer.render();
            canvas.dataset.drawCalls = String(renderer.info.render.calls);
            // A compact camera/geometry snapshot also makes reduced-motion reversibility inspectable.
            canvas.dataset.pose = JSON.stringify([p, ...camera.position.toArray(), ...w.root.children.filter(o => o.visible).map(o => [o.position.x, o.position.y, o.position.z, o.scale.x, o.rotation.y]),...(w.kineticSubjects||[]).map(object=>object.matrixWorld.toArray())]);
            const labels = [];
            for (const [id, { object, offset }] of w.anchors) {
                object.localToWorld(world.copy(offset)); screen.copy(world).project(camera);
                const visible = object.visible && object.scale.x > .05 && screen.z < 1 && Math.abs(screen.x) < .92 && Math.abs(screen.y) < .85;
                let text = sceneLabels[kind][id] || id;
                if (kind === 'pages' && id === 'canvas-0') text = p > .85 ? 'REVIEW / PUBLISH' : 'YOUR COMPOSITION';
                if (kind === 'shield' && id === 'brief' && p > .5) text = 'CONTEXT / SOURCE TRAIL';
                labels.push({ id, text, x: (screen.x * .5 + .5) * width, y: (-screen.y * .5 + .5) * height, opacity: visible ? .85 : 0 });
            }
            if(w.caption)labels.push({id:'scene-caption',text:`${w.caption.speaker} / ${w.caption.text}`,x:width*(portrait?.5:.76),y:height*(portrait?.48:.69),opacity:1});
            return labels;
        },
        dispose() {
            if (disposed) return; disposed = true;
            window.removeEventListener('pointermove', aim);
            const geometries = new Set(), materials = new Set(), textures = new Set();
            scene.traverse(object => { object.shadow?.dispose(); if (object.geometry) geometries.add(object.geometry); for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
            geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
            // These resources are omitted by the bundled r184 pass disposers.
            occlusion?.ssaoMaterial.dispose();occlusion?.noiseTexture.dispose();bloom.materialHighPassFilter.dispose();
            focus?.dispose();occlusion?.dispose();bloom.dispose();grade.dispose(); output.dispose(); antialias.dispose(); renderPass.dispose(); composer.dispose(); envTarget.dispose(); renderer.dispose();
        },
    };
}
