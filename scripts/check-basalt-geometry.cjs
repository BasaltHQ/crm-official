// Exercise every authored scroll position against the rendered furniture geometry.
// This is a conservative world-space AABB check: any reported contact needs visual review.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');
const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
const kinds = ['network', 'crystal', 'constellation', 'modules', 'pages', 'wave', 'shield'];
const ids = ['crm', 'onyx', 'hq', 'erp', 'cms', 'echo', 'vigil'];
const colors = ['#52e6df', '#c3a0ff', '#58adff', '#2bfff8', '#b7a5ff', '#ffc029', '#ff616c'];
const bundle = esbuild.buildSync({ stdin: { contents: `import{createWorldRenderer}from'${root}/components/basalt-marketing/scene-worlds.js';
window.__BASALT_SCENE_AUDIT__=true;const i=+location.pathname.slice(1)||0,canvas=document.querySelector('canvas');
const renderer=createWorldRenderer(canvas,${JSON.stringify(kinds)}[i],${JSON.stringify(colors)}[i]);
window.draw=(p,t=0)=>{renderer.render(p,t,t===0);return{contacts:JSON.parse(canvas.dataset.contacts),mechanicalContacts:JSON.parse(canvas.dataset.mechanicalContacts),cameraContacts:JSON.parse(canvas.dataset.cameraContacts),figures:JSON.parse(canvas.dataset.figures),mounts:JSON.parse(canvas.dataset.mounts),workContact:JSON.parse(canvas.dataset.workContact),touchContact:JSON.parse(canvas.dataset.touchContact||'null'),handoff:JSON.parse(canvas.dataset.handoffAudit||'null'),narrative:JSON.parse(canvas.dataset.narrative),pose:JSON.parse(canvas.dataset.pose)}};window.draw(0);`, resolveDir: root, loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text;

(async () => {
    const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<style>body{margin:0;background:#17130e}canvas{width:1000px;height:900px;display:block}</style><canvas></canvas><script>' + bundle + '</script>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const problems = [];
    try {
        for (const [i, id] of ids.entries()) {
            if(process.env.BASALT_CHECK_SITE && process.env.BASALT_CHECK_SITE!==id)continue;
            const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if(message.type()==='error')errors.push(message.text()); });
            await page.goto(`http://127.0.0.1:${server.address().port}/${i}`);
            const result = await page.evaluate(() => {
                const contacts = new Map(); const initial = window.draw(0);
                for (let step = 0; step <= 60; step++) {
                    const result = window.draw(step / 60);
                    if (!result.pose.flat(Infinity).every(Number.isFinite)) throw new Error('Non-finite geometry');
                    result.contacts.forEach(contact => { if (!contacts.has(contact)) contacts.set(contact, []); contacts.get(contact).push(step / 60); });
                }
                // Ambient gear/stock motion also runs between scroll updates.
                for(const p of [0,.167,.333,.5,.667,.833,1])for(const t of [3,11,23]){
                    const result=window.draw(p,t);result.contacts.forEach(contact=>{if(!contacts.has(contact))contacts.set(contact,[]);contacts.get(contact).push(`${p}@${t}s`);});
                }
                const motionErrors=[],activities=new Set(),gripEdges=new Map(),sharedSupport={initial:0,final:0};let prior;
                const chapters=[0,1/3,2/3,1].map(p=>window.draw(p));
                if(location.pathname==='/0'){
                    // The right hand must leave and regain the actual folio grip
                    // continuously, including the first frame of a task override.
                    for(const boundary of [.345,.495,.63,.85]){
                        let previous;
                        for(let sample=-8;sample<=8;sample++){
                            const p=boundary+sample*.0005;
                            const grip=window.draw(p).handoff.grips.find(g=>g.role==='account-manager'&&g.index===1);
                            if(previous&&Math.hypot(...grip.actualEdge.map((value,i)=>value-previous[i]))>.0125)motionErrors.push(`hand jumps between folio and task at ${p}`);
                            previous=grip.actualEdge;
                        }
                    }
                }
                // Reading a chapter must never cause a person to wander or change task.
                for(const p of [0,.3,.55,.86,1]){
                    const start=window.draw(p,1);
                    for(const t of [5,12,24,31]){
                        const held=window.draw(p,t);
                        held.figures.forEach((figure,i)=>{
                            if(JSON.stringify(figure.position)!==JSON.stringify(start.figures[i].position)||figure.action!==start.figures[i].action)motionErrors.push(`unmotivated movement at ${p}@${t}s`);
                        });
                        if(JSON.stringify(held.narrative)!==JSON.stringify(start.narrative))motionErrors.push(`task changes while reading at ${p}`);
                    }
                }
                for(let frame=1;frame<=240;frame++){
                    const result=window.draw(frame/240,frame/8);
                    result.cameraContacts.forEach(contact=>motionErrors.push(`camera crosses ${contact} at ${frame/240}`));
                    result.mechanicalContacts.forEach(contact=>motionErrors.push(`machinery clearance: ${contact} at ${frame/240}`));
                    if(result.workContact?.error>.004)motionErrors.push(`pen misses page at ${frame/240}: ${result.workContact.error.toFixed(4)}`);
                    if(result.touchContact?.error>.002)motionErrors.push(`finger misses button at ${frame/240}: ${result.touchContact.error.toFixed(4)}`);
                    if(result.handoff){
                        const exchange=result.handoff;
                        // These are measured final wrist transforms, after writing and
                        // gestures, rather than the choreography's ownership flags.
                        const supporting=exchange.grips.filter(grip=>grip.weight>=.999&&grip.error<=.012&&grip.wristError<.1);
                        if(!supporting.length)motionErrors.push(`unsupported carried folio at ${frame/240}`);
                        for(const grip of supporting){
                            if(grip.digits.length!==5)motionErrors.push(`missing opposing digit contact: ${grip.role}/${grip.index}`);
                            for(const digit of grip.digits)if(digit.error>.002)motionErrors.push(`digit misses folio: ${grip.role}/${grip.index}/${digit.kind} at ${frame/240}: ${digit.error.toFixed(4)}`);
                            if(grip.penetration>.0015)motionErrors.push(`hand penetrates cover: ${grip.role}/${grip.index} at ${frame/240}: ${grip.penetration.toFixed(4)}`);
                            const thumb=grip.digits.find(digit=>digit.kind==='thumb'),finger=grip.digits.find(digit=>digit.kind==='finger');
                            if(thumb&&finger&&(thumb.point[2]+.007)*(finger.point[2]+.007)>=0)motionErrors.push(`thumb does not oppose fingers: ${grip.role}/${grip.index}`);
                        }
                        for(const grip of exchange.grips){
                            const key=`${grip.role}:${grip.index}`,side=Math.sign(grip.edge[0]);
                            if(gripEdges.has(key)&&gripEdges.get(key)!==side)motionErrors.push(`grip switches folio edge: ${key} at ${frame/240}`);
                            gripEdges.set(key,side);
                        }
                        if(exchange.receiver){
                            const sender=supporting.filter(grip=>grip.role===exchange.giver),receiver=supporting.filter(grip=>grip.role===exchange.receiver);
                            if(sender.length&&receiver.length)sharedSupport[exchange.phase]++;
                            const senderWeight=Math.max(0,...exchange.grips.filter(grip=>grip.role===exchange.giver).map(grip=>grip.weight));
                            if(senderWeight<.999&&!receiver.length)motionErrors.push(`sender releases before receiver contact at ${frame/240}`);
                            for(const a of sender)for(const b of receiver){
                                const separation=Math.hypot(...a.actualEdge.map((value,i)=>value-b.actualEdge[i]));
                                if(separation<.055)motionErrors.push(`hands overlap on folio at ${frame/240}`);
                            }
                            if(prior?.handoff?.phase===exchange.phase){
                                const dot=Math.abs(exchange.quaternion.reduce((sum,value,i)=>sum+value*prior.handoff.quaternion[i],0));
                                if(2*Math.acos(Math.min(1,dot))>.35)motionErrors.push(`folio flips during handoff at ${frame/240}`);
                            }
                        }
                    }
                    result.mounts.forEach((mount,i)=>{if(mount.connection>.00001||mount.base.some((value,axis)=>Math.abs(value-initial.mounts[i].base[axis])>.00001))motionErrors.push(`detached instrument at ${frame/8}s`);});
                    result.contacts.forEach(contact=>{if(!contacts.has(contact))contacts.set(contact,[]);contacts.get(contact).push(`motion@${frame/8}s`);});
                    result.figures.forEach((figure,index)=>{
                        activities.add(figure.activity);
                        figure.hands.forEach(hand=>{if(!Number.isFinite(hand.error)||hand.error>.012)motionErrors.push(`hand misses grip: ${index}/${hand.hand} at ${frame/240}: ${hand.error.toFixed(4)}`);});
                        figure.feet.forEach((foot,side)=>{
                            const stance=figure.stance[side], tolerance=.009;
                            if(foot.minimum<figure.position[1]-tolerance)motionErrors.push(`foot below floor: ${index}/${side} at ${frame/8}`);
                            if(stance.planted && Math.abs(foot.minimum-figure.position[1])>tolerance)motionErrors.push(`planted foot lifted: ${index}/${side} at ${frame/8}`);
                            if(stance.planted && Math.hypot(foot.center[0]-stance.x,foot.center[2]-stance.z)>.007)motionErrors.push(`foot misses its plant: ${index}/${side} at ${frame/8}`);
                            const previous=prior?.figures[index];
                            if(previous&&stance.planted&&previous.stance[side].planted&&stance.contact===previous.stance[side].contact&&stance.contact!=='swing'){
                                const last=previous.feet[side].center;
                                if(Math.hypot(foot.center[0]-last[0],foot.center[2]-last[2])>.004)motionErrors.push(`planted foot slides: ${index}/${side} at ${frame/8}`);
                            }
                        });
                    });prior=result;
                }
                return { contacts: [...contacts], motionErrors, sharedSupport, chapters:chapters.map(c=>({actions:c.figures.map(f=>f.action),narrative:c.narrative})), activities:[...activities], figures: initial.figures, first: initial.pose, reversed: window.draw(0).pose };
            });
            assert.deepEqual(result.reversed, result.first, `${id}: reverse scroll must restore the pose`);
            assert.ok(result.activities.some(activity=>activity.startsWith('to-')),`${id}: missing purposeful travel`);
            assert.ok(new Set(result.chapters.map(chapter=>chapter.actions[0])).size>=3,`${id}: missing narrative actions`);
            const ending=result.chapters[3].narrative;
            if(id==='crm')assert.equal(ending.owner,2,'CRM: the colleague receives the next step');
            if(id==='hq')assert.equal(ending.owner,3,'HQ: the courier delivers the plan');
            if(id==='crm'||id==='hq')for(const phase of ['initial','final'])assert.ok(result.sharedSupport[phase]>=2,`${id}: ${phase} exchange needs sustained physical support from both people`);
            if(id==='onyx')assert.ok(ending.delivered>.99&&ending.reply>.99,'Onyx: the message reaches its audience and a reply returns');
            if(id==='erp')assert.equal(ending.pumpComplete,true,'ERP: the pump must finish inspection');
            if(id==='cms')assert.ok(ending.layout==='mobile'&&ending.converted>.99,'CMS: the page reflows and the visitor acts');
            if(id==='echo')assert.ok(ending.valveSeated>.99&&ending.routeOpen>.99,'Echo: the conversation produces a physical revision');
            if(id==='vigil')assert.ok(ending.correction>.99&&ending.presentation>.99,'Vigil: corrected work is presented');
            assert.ok(result.figures.length > 0, `${id}: missing figure`);
            for (const figure of result.figures) {
                assert.ok(figure.height / figure.head >= 6.7 && figure.height / figure.head <= 7.3, `${id}: guild automaton proportions`);
                assert.ok(figure.parts >= 25, `${id}: missing articulated body parts`);
            }
            if (errors.length || result.contacts.length || result.motionErrors.length) problems.push({ id, errors, contacts: result.contacts.map(([contact,times])=>[contact,times.slice(0,8),times.length]), motionErrors:[...new Set(result.motionErrors)].slice(0,12) });
            if (process.env.BASALT_CAPTURE_DIR) {
                fs.mkdirSync(process.env.BASALT_CAPTURE_DIR, { recursive: true });
                for (let chapter = 0; chapter < 4; chapter++) {
                    await page.evaluate(p => window.draw(p), chapter / 3);
                    await page.locator('canvas').screenshot({ path: path.join(process.env.BASALT_CAPTURE_DIR, `${id}-polygon-${chapter}.png`) });
                }
            }
            console.log(`${id}: ${result.chapters.map(c=>c.actions.join('/')).join(' > ')}; 61 poses + 240 motion frames, ${result.contacts.length} contacts, ${result.motionErrors.length} motion/grip errors`);
            await page.close();
        }
        if (problems.length) console.error(JSON.stringify(problems, null, 2));
        assert.equal(problems.length, 0, 'Review and resolve reported figure/furniture contacts');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
