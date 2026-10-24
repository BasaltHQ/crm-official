/* Exercise the active mesh flight films, including real shader compilation.
 * Pixel assertions complement camera/state checks: metadata alone cannot prove
 * that a shader drew anything or that progress changed the landscape. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const { PNG } = require('pngjs');
const { chromium } = require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const captureDir = process.env.BASALT_CAPTURE_DIR || path.join(root, '.basalt-previews');
const products = [
    { id: 'crm', kind: 'network', accent: '#52e6df' },
    { id: 'onyx', kind: 'crystal', accent: '#c3a0ff' },
    { id: 'hq', kind: 'constellation', accent: '#58adff' },
    { id: 'erp', kind: 'modules', accent: '#2bfff8' },
    { id: 'cms', kind: 'pages', accent: '#b7a5ff' },
    { id: 'echo', kind: 'wave', accent: '#ffc029' },
    { id: 'vigil', kind: 'shield', accent: '#ff616c' },
];
const selected = products.filter(product => !process.env.BASALT_CHECK_SITE || [product.id, product.kind].includes(process.env.BASALT_CHECK_SITE));
assert.ok(selected.length, 'BASALT_CHECK_SITE must name one of the seven products or scene kinds.');
const widths = process.env.BASALT_CHECK_WIDTH ? [Number(process.env.BASALT_CHECK_WIDTH)] : process.argv.includes('--mobile') ? [390] : [1100, 390];
assert.ok(widths.every(width => Number.isFinite(width) && width >= 240 && width <= 2560), 'Invalid BASALT_CHECK_WIDTH.');

function pixels(buffer) {
    const png = PNG.sync.read(buffer);
    const hash = crypto.createHash('sha256').update(png.data).digest('hex');
    let sum = 0, square = 0, count = 0;
    const levels = new Set();
    // Stride over the whole image; this includes the terrain and the sky.
    for (let i = 0; i < png.data.length; i += 16) {
        const value = png.data[i] * .2126 + png.data[i + 1] * .7152 + png.data[i + 2] * .0722;
        sum += value; square += value * value; count++;
        levels.add(Math.round(value));
    }
    return { png, hash, deviation: Math.sqrt(Math.max(0, square / count - (sum / count) ** 2)), levels: levels.size };
}

function difference(a, b) {
    assert.equal(a.png.width, b.png.width); assert.equal(a.png.height, b.png.height);
    let total = 0, count = 0;
    for (let i = 0; i < a.png.data.length; i += 16) {
        for (let channel = 0; channel < 3; channel++) total += Math.abs(a.png.data[i + channel] - b.png.data[i + channel]);
        count += 3;
    }
    return total / count;
}

function assertSamePixels(actual, expected, message) {
    if (actual.hash === expected.hash) return 0;
    assert.equal(actual.png.width, expected.png.width); assert.equal(actual.png.height, expected.png.height);
    let maximum = 0, changed = 0;
    for (let i = 0; i < actual.png.data.length; i++) {
        const delta = Math.abs(actual.png.data[i] - expected.png.data[i]);
        maximum = Math.max(maximum, delta); if (delta) changed++;
    }
    // Chromium/ANGLE can quantize a single color channel one unit differently
    // in otherwise identical frames. Permit at most sixteen such channels in the
    // entire image; do not use a perceptual threshold that could hide motion.
    assert.ok(maximum <= 1 && changed <= 16, `${message} (${changed} changed channels, maximum delta ${maximum}/255)`);
    return changed;
}

async function main() {
    fs.mkdirSync(captureDir, { recursive: true });
    const rendererPath = path.join(root, 'components/basalt-marketing/flight-renderer.js').replaceAll('\\', '/');
    const source = `import {createFlightRenderer} from ${JSON.stringify(rendererPath)};
        const products=${JSON.stringify(products)};
        const product=products.find(item=>location.pathname==='/'+item.id);
        window.__BASALT_SCENE_AUDIT__=true;
        const canvas=document.querySelector('canvas');
        const renderer=createFlightRenderer(canvas,product.kind,product.accent);
        if(!renderer)throw new Error('The flight WebGL renderer was unavailable.');
        window.draw=(progress,time=0,reduced=true)=>{
            renderer.render(progress,time,reduced);
            return {audit:JSON.parse(canvas.dataset.flight),pose:JSON.parse(canvas.dataset.pose),engine:canvas.dataset.engine,calls:Number(canvas.dataset.drawCalls)};
        };
        window.dispose=()=>renderer.dispose();window.draw(0);`;
    const bundle = await esbuild.build({ stdin: { contents: source, resolveDir: root }, bundle: true, write: false, platform: 'browser', format: 'iife' });
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#151719}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
    const server = http.createServer((request, response) => {
        if(request.url==='/basalt-flight/aerial-world-v1.png'){response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(path.join(root,'public/basalt-flight/aerial-world-v1.png')));return;}
        response.setHeader('Content-Type', 'text/html'); response.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let browser;
    const results = [];
    try {
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        for (const width of widths) for (const product of selected) {
            const height = Number(process.env.BASALT_CHECK_HEIGHT || (width < 750 ? 844 : 760));
            const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            try {
                await page.goto(`${base}/${product.id}`, { waitUntil: 'load' });
                await page.waitForFunction(() => typeof window.draw === 'function');
                await page.waitForFunction(() => document.querySelector('canvas').dataset.environment==='ready');
                const canvas = page.locator('canvas');
                async function capture(progress, time = 0, suffix) {
                    const result = await page.evaluate(async ({ progress, time }) => {
                        window.draw(progress, time, true);
                        // Let Chromium present the newly submitted WebGL frame,
                        // then redraw the same state before capturing its pixels.
                        await new Promise(requestAnimationFrame);
                        return window.draw(progress, time, true);
                    }, { progress, time });
                    assert.equal(result.engine, 'basalt-flight-cinema');
                    assert.ok(result.calls > 1 && result.calls < 600, 'Flight draw budget exceeded: '+result.calls);
                    assert.equal(result.audit.kind, product.kind);
                    assert.equal(result.audit.progress, progress);
                    assert.equal(result.audit.chapter, Math.min(3, Math.round(progress * 3)));
                    assert.ok(typeof result.audit.stage === 'string' && result.audit.stage.length > 0, 'Missing narrative stage.');
                    assert.ok([...result.audit.eye, ...result.audit.target, ...result.audit.resolution, ...result.pose.slice(1)].every(Number.isFinite), 'Non-finite camera or audit pose.');
                    const buffer = await canvas.screenshot();
                    if (suffix) fs.writeFileSync(path.join(captureDir, `flight-${product.id}-${width}-${suffix}.png`), buffer);
                    return { ...pixels(buffer), audit: result.audit };
                }
                const chapters = [];
                for (let i = 0; i < 4; i++) {
                    const frame = await capture(i / 3, 0, `chapter-${i}`);
                    assert.ok(frame.deviation > 3 && frame.levels > 18, `${product.id} chapter ${i} produced a near-uniform frame.`);
                    chapters.push(frame);
                }
                assert.equal(new Set(chapters.map(frame => frame.hash)).size, 4, 'Chapter frames must differ.');
                const chapterDifferences = chapters.slice(1).map((frame, i) => difference(chapters[i], frame));
                assert.ok(chapterDifferences.every(value => value > .35), 'Chapter images barely change.');
                const reversed = await capture(1 / 3);
                const reverseRoundoff = assertSamePixels(reversed, chapters[1], 'Reversing progress must reconstruct the same rendered image.');
                const held = await capture(.5, 0, 'held-before');
                const heldLater = await capture(.5, 93, 'held-after');
                assert.deepEqual(heldLater.audit, held.audit, 'Holding a chapter must preserve all camera and narrative metadata.');
                const heldRoundoff = assertSamePixels(heldLater, held, 'Reduced-motion rendering must ignore ambient time.');
                // The audit rail freezes the actual eye, target, and FOV while
                // progress still updates the physical scene. This rejects films
                // whose only visible narrative change is the camera journey.
                await page.evaluate(() => { window.__BASALT_REVIEW_RAIL__ = .5; });
                const fixedBefore = await capture(.4, 0, 'fixed-before');
                const fixedAfter = await capture(.6, 0, 'fixed-after');
                assert.deepEqual(fixedAfter.audit.eye, fixedBefore.audit.eye, 'Audit rail failed to freeze the eye.');
                assert.deepEqual(fixedAfter.audit.target, fixedBefore.audit.target, 'Audit rail failed to freeze the target.');
                const fieldDifference = difference(fixedBefore, fixedAfter);
                assert.ok(fieldDifference > .25, 'Physical flight action must change at a fixed camera position.');
                await page.evaluate(() => { delete window.__BASALT_REVIEW_RAIL__; window.dispose(); window.dispose(); });
                assert.deepEqual(errors, [], 'Browser or shader compilation errors.');
                const result = { product: product.id, width, height, chapters: 4, minimumDeviation: Math.min(...chapters.map(frame => frame.deviation)), chapterDifferences, fixedCameraDifference: fieldDifference, reversible: true, reducedMotionStable: true, quantizedChannels: reverseRoundoff + heldRoundoff, errors: 0 };
                results.push(result); console.log(JSON.stringify(result));
            } finally { await page.close(); }
        }
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(captureDir, 'flight-checks.json'), JSON.stringify(results, null, 2));
    console.log(`Verified ${results.length} product/viewport combinations with actual GPU pixels.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
