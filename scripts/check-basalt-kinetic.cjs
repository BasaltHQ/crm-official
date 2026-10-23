// Exercise the production renderer's character-free films. This verifies scroll
// ownership and completed physical sequences; visual composition still needs review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');

const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
const sites = [
    { id: 'crm', kind: 'network', color: '#52e6df', completed: ['panelsOpen', 'contextJoined', 'response', 'continuity'] },
    { id: 'onyx', kind: 'crystal', color: '#c3a0ff', completed: ['messageResolved', 'impression', 'audienceFormats'] },
    { id: 'hq', kind: 'constellation', color: '#58adff', completed: ['gatewayOpen', 'gardenOpen', 'canopyOpen'] },
    { id: 'erp', kind: 'modules', color: '#2bfff8', completed: ['connection', 'water'] },
    { id: 'cms', kind: 'pages', color: '#b7a5ff', completed: ['paperUnfolded', 'composition', 'portrait', 'published'] },
    { id: 'echo', kind: 'wave', color: '#ffc029', completed: ['hearing', 'carrying', 'answering', 'canopy'] },
    { id: 'vigil', kind: 'shield', color: '#ff616c', completed: ['open', 'extract', 'compare', 'binding'] },
];
const selected = process.env.BASALT_CHECK_SITE ? sites.filter(site => site.id === process.env.BASALT_CHECK_SITE) : sites;
assert.ok(selected.length, 'BASALT_CHECK_SITE must name one of crm, onyx, hq, erp, cms, echo, vigil');
const width = Number(process.env.BASALT_CHECK_WIDTH || 1000), height = width <= 800 ? 844 : 800;
assert.ok(Number.isInteger(width) && width >= 320 && width <= 2400, 'BASALT_CHECK_WIDTH must be between 320 and 2400');

const bundle = esbuild.buildSync({
    stdin: {
        contents: `import {createWorldRenderer} from '${root}/components/basalt-marketing/scene-worlds.js';
window.__BASALT_SCENE_AUDIT__=true;
const site=${JSON.stringify(sites)}.find(site=>'/'+site.id===location.pathname),canvas=document.querySelector('canvas');
const renderer=createWorldRenderer(canvas,site.kind,site.color);
if(!renderer)throw new Error('WebGL renderer did not initialize');
window.draw=(p,time=0,reduced=true)=>{renderer.render(p,time,reduced);return{
    kinetic:JSON.parse(canvas.dataset.kinetic),narrative:JSON.parse(canvas.dataset.narrative),
    shot:JSON.parse(canvas.dataset.shot),figures:JSON.parse(canvas.dataset.figures),
    drawCalls:Number(canvas.dataset.drawCalls)
}};
window.dispose=()=>renderer.dispose();window.draw(0);`,
        resolveDir: root, loader: 'js',
    }, bundle: true, write: false, format: 'iife', platform: 'browser',
}).outputFiles[0].text;

(async () => {
    const server = http.createServer((request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(`<style>html,body{margin:0;background:#172324}.bm-scene{width:${width}px;height:${height}px}canvas{display:block;width:100%;height:100%}</style><div class="bm-scene" data-layout="immersive"><canvas></canvas></div><script>${bundle}</script>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    console.log(`Kinetic regression fixture: http://127.0.0.1:${server.address().port} (${width} x ${height}; sequential scenes)`);
    let browser;
    const problems = [];
    try {
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        for (const site of selected) {
            const page = await browser.newPage({ viewport: { width, height } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            try {
                await page.goto(`http://127.0.0.1:${server.address().port}/${site.id}`);
                await page.waitForFunction(() => typeof window.draw === 'function');
                const result = await page.evaluate(() => {
                    const failures = [], samples = [], tolerance = 1e-8;
                    const fail = text => { if (failures.length < 30) failures.push(text); };
                    const finite = value => typeof value === 'number' ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value && typeof value === 'object' ? Object.values(value).every(finite) : true;
                    function validate(snapshot, p) {
                        const { kinetic, narrative, shot, figures } = snapshot;
                        if (kinetic.people !== 0 || figures.length !== 0) fail(`characters reintroduced at ${p}`);
                        if (kinetic.subjects.length < 3) fail(`missing authored moving subjects at ${p}`);
                        if (kinetic.subjects.length !== samples[0]?.kinetic.subjects.length && samples.length) fail(`subject inventory changes at ${p}`);
                        if (!kinetic.subjects.every(subject => subject.matrix.length === 16 && subject.matrix.every(Number.isFinite))) fail(`invalid world matrix at ${p}`);
                        if (!finite(narrative)) fail(`non-finite narrative state at ${p}`);
                        if (narrative.chapter !== Math.min(3, Math.round(p * 3))) fail(`chapter disagrees with scroll at ${p}`);
                        if (!shot.position.every(Number.isFinite) || !shot.target.every(Number.isFinite) || !Number.isFinite(shot.fov) || shot.fov < 20 || shot.fov > 75) fail(`invalid camera at ${p}`);
                        if (Math.hypot(...shot.position.map((value, axis) => value - shot.target[axis])) < .1) fail(`camera collapses into its target at ${p}`);
                        if (!Number.isFinite(snapshot.drawCalls) || snapshot.drawCalls < 1) fail(`nothing rendered at ${p}`);
                    }
                    function differences(a, b) {
                        return a.kinetic.subjects.reduce((count, subject, index) => count + Number(subject.visible !== b.kinetic.subjects[index].visible || subject.matrix.some((value, axis) => Math.abs(value - b.kinetic.subjects[index].matrix[axis]) > tolerance)), 0);
                    }
                    function sameStory(a, b, reason) {
                        if (differences(a, b)) fail(`${reason}: authored geometry changed`);
                        if (JSON.stringify(a.narrative) !== JSON.stringify(b.narrative)) fail(`${reason}: narrative changed`);
                        if (a.shot.position.some((value, axis) => Math.abs(value - b.shot.position[axis]) > tolerance) || a.shot.target.some((value, axis) => Math.abs(value - b.shot.target[axis]) > tolerance) || Math.abs(a.shot.fov - b.shot.fov) > tolerance) fail(`${reason}: camera changed`);
                    }
                    // Save the real world matrices, not just declared narrative flags.
                    for (let frame = 0; frame <= 60; frame++) {
                        const p = frame / 60, snapshot = window.draw(p, frame / 3, false);
                        validate(snapshot, p); samples.push(snapshot);
                    }
                    const chapters = [samples[0], samples[20], samples[40], samples[60]];
                    const transitions = chapters.slice(1).map((chapter, i) => differences(chapters[i], chapter));
                    if (transitions.some(count => count === 0)) fail('one or more chapters change only labels or camera, without physical transformation');
                    if (new Set(chapters.map(chapter => JSON.stringify(chapter.narrative))).size !== 4) fail('missing distinct chapter states');
                    // A scrub in reverse must reconstruct every same pose, even
                    // after the end state and a very different ambient clock.
                    for (let frame = 60; frame >= 0; frame--) {
                        const snapshot = window.draw(frame / 60, 120 + (60 - frame) / 3, false);
                        validate(snapshot, frame / 60); sameStory(samples[frame], snapshot, `reverse at ${frame}/60`);
                    }
                    // Idle time is allowed to affect dust/light only. It must not
                    // advance a task, move a hinge, or pull the reading camera away.
                    for (const frame of [0, 10, 20, 30, 40, 50, 60]) {
                        for (const time of [1, 7, 29]) sameStory(samples[frame], window.draw(frame / 60, time, false), `held scroll at ${frame}/60 @ ${time}s`);
                        sameStory(samples[frame], window.draw(frame / 60, 0, true), `reduced motion at ${frame}/60`);
                    }
                    return { failures, transitions, subjectCount: samples[0].kinetic.subjects.length, peakDrawCalls: Math.max(...samples.map(snapshot => snapshot.drawCalls)), chapters: chapters.map(snapshot => snapshot.narrative), states: samples.map(snapshot => snapshot.narrative) };
                });
                assert.deepEqual(result.failures, [], `${site.id}: kinetic geometry and scroll contract`);
                const first = result.chapters[0], last = result.chapters[3];
                for (const field of site.completed) {
                    assert.ok(Number.isFinite(first[field]) && first[field] <= .01, `${site.id}: ${field} must begin unfinished`);
                    assert.ok(Number.isFinite(last[field]) && last[field] >= .99, `${site.id}: ${field} must complete by the final shot`);
                    for (let i = 1; i < result.states.length; i++) assert.ok(result.states[i][field] + 1e-8 >= result.states[i - 1][field], `${site.id}: ${field} regresses while scrolling forward`);
                }
                // These outcomes express what the objects accomplish rather than
                // asserting individual implementation angles or exact dimensions.
                if (site.id === 'erp') {
                    assert.ok(result.states.some(state => state.casingSeparation > .9), 'ERP: the machine never reveals its internal connection');
                    assert.ok(last.casingSeparation <= .01, 'ERP: the casing must close after the connection is completed');
                    assert.ok(last.terraces.length >= 3 && last.terraces.every(terrace => terrace.open > .99 && terrace.growth > .99), 'ERP: connected water must reach every growing terrace');
                    const firstWater = result.states.find(state => state.water > .01);
                    assert.ok(firstWater.connection > .99, 'ERP: water flows before the missing connection is seated');
                }
                if (site.id === 'echo') assert.ok(result.states.find(state => state.canopy > .01).answering > .99, 'Echo: the shared canopy opens before the receiving voice answers');
                if (site.id === 'vigil') assert.ok(result.states.find(state => state.binding > .01).compare > .99, 'Vigil: evidence binds before source review completes');
                assert.deepEqual(errors, [], `${site.id}: browser errors`);
                if (process.env.BASALT_CAPTURE_DIR) {
                    fs.mkdirSync(process.env.BASALT_CAPTURE_DIR, { recursive: true });
                    for (let chapter = 0; chapter < 4; chapter++) {
                        await page.evaluate(p => window.draw(p), chapter / 3);
                        await page.locator('canvas').screenshot({ path: path.join(process.env.BASALT_CAPTURE_DIR, `${site.id}-kinetic-${chapter}.png`) });
                    }
                }
                await page.evaluate(() => { window.dispose(); window.dispose(); });
                assert.deepEqual(errors, [], `${site.id}: renderer disposal must be safe and repeatable`);
                console.log(`${site.id}: ${result.subjectCount} subjects; ${result.transitions.join('/')} changed per chapter; 61 forward + 61 reverse + 28 hold/reduced frames; outcomes passed; peak ${result.peakDrawCalls} draw calls`);
            } catch (error) {
                problems.push({ id: site.id, error: error.message, browserErrors: errors });
                console.error(`${site.id}: ${error.message}`);
            } finally {
                await page.close();
            }
        }
        assert.equal(problems.length, 0, JSON.stringify(problems, null, 2));
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
