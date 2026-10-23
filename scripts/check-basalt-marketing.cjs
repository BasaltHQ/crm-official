// Browser checks for the real marketing components without invoking app databases or workers.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const { chromium } = require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const captureDir = process.env.BASALT_CAPTURE_DIR || path.join(root, '.basalt-previews');
const roots = {
    crm: root,
    onyx: 'U:/BasaltOnyx/onyx/frontend',
    hq: 'U:/BasaltHQ/main-site',
    erp: 'U:/BasaltERP/Site/erp-site',
    cms: 'U:/Ledger1CMS/cms',
    echo: 'I:/Osiris/varuni-demo/voice',
    vigil: 'I:/Agents/Varuna/Vigil',
};
const componentDir = id => path.join(roots[id], id === 'crm' || id === 'cms' ? 'components' : id === 'vigil' ? 'app/components' : 'src/components', 'basalt-marketing');
// Only the existing public SDK identifier is bundled. Authentication stays in
// the real HQ app's API routes; the design fixture starts in an anonymous state.
const hqClientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || ['.env.local', '.env'].flatMap(name => {
    const file=path.join(roots.hq,name);
    if(!fs.existsSync(file))return [];
    const value=fs.readFileSync(file,'utf8').match(/^NEXT_PUBLIC_THIRDWEB_CLIENT_ID\s*=\s*(.+)$/m)?.[1]?.trim();
    return value?[value.replace(/^(["'])(.*)\1$/,'$2').replace(/\s+#.*$/,'').trim()]:[];
})[0];
if(!hqClientId)throw new Error('HQ portal preview requires the existing NEXT_PUBLIC_THIRDWEB_CLIENT_ID.');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: ['U:/BasaltOnyx/onyx/frontend'] }), 'utf8');
const responses = {};
const checks = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function appStyles(id) {
    const appRoot = roots[id];
    const relative = id === 'onyx' ? 'src/app/onyx.css' : id === 'crm' || id === 'vigil' ? 'app/globals.css' : id === 'cms' ? 'app/[locale]/globals.css' : 'src/app/globals.css';
    const file = path.join(appRoot, relative);
    const version = require(require.resolve('tailwindcss/package.json', { paths: [appRoot] })).version;
    let plugin;
    if (version.startsWith('4.')) plugin = require(require.resolve('@tailwindcss/postcss', { paths: [appRoot] }))({ base: appRoot });
    else {
        const configFile = ['tailwind.config.js', 'tailwind.config.ts'].map(name => path.join(appRoot, name)).find(file => fs.existsSync(file));
        const loadConfig = require(require.resolve('tailwindcss/loadConfig', { paths: [appRoot] }));
        const config = loadConfig(configFile);
        config.content = [path.join(appRoot, '{app,components,src}/**/*.{ts,tsx}').replaceAll('\\', '/')];
        plugin = require(require.resolve('tailwindcss', { paths: [appRoot] }))(config);
    }
    return (await postcss([plugin]).process(fs.readFileSync(file, 'utf8'), { from: file })).css;
}

async function main() {
    fs.mkdirSync(captureDir, { recursive: true });
    for (const id of Object.keys(roots)) {
        const file = path.join(componentDir(id), 'BasaltLanding.tsx').replaceAll('\\', '/');
        const onyx = id === 'onyx';
        let entry = onyx ? `import Component from '${roots.onyx}/src/components/Landing/LandingSite';` : id === 'crm' ? `import Component from '${root.replaceAll('\\', '/')}/app/page';` : `import Component from '${file}';`;
        let view = `<Component ${onyx || id === 'crm' ? '' : `productId="${id}" ${id === 'cms' ? 'locale="en"' : ''}`} />`;
        const footers = {
            hq: ['src/components/layout/footer.tsx', 'Footer'],
            erp: ['src/components/basalt-theme/BasaltFooter.tsx', 'default'],
            cms: ['app/[locale]/components/MarketingFooter.tsx', 'default'],
            vigil: ['app/components/landing/footer.tsx', 'Footer'],
        };
        if (footers[id]) {
            const [file, name] = footers[id];
            entry += `import ${name === 'default' ? 'Footer' : '{Footer}'} from '${roots[id]}/${file}';`;
            view = `<Component productId="${id}" ${id === 'cms' ? 'locale="en"' : ''} footer={<Footer/>}/>`;
            if (id === 'hq') { entry = `import Home from '${roots.hq}/src/app/page';import PortalPage from '${roots.hq}/src/app/portal/page';import {Footer} from '${roots.hq}/src/components/layout/footer';import {BrandThemeProvider} from '${roots.hq}/src/components/providers/brand-theme-provider';const Component=()=>location.pathname==='/portal'?<><a href="/hq" style={{position:'relative',zIndex:10,display:'inline-block',padding:'20px 24px'}}>← BasaltHQ home</a><PortalPage/></>:<Home/>;`; view = `<BrandThemeProvider><Component/><Footer/></BrandThemeProvider>`; }
        }
        if (id === 'echo') { entry = `import Component from '${roots.echo}/src/app/page';`; view = '<Component/>'; }
        const bundle = await esbuild.build({
            stdin: { contents: `${entry}import React from 'react';import{createRoot}from'react-dom/client';window.__product='${id}';createRoot(document.getElementById('root')).render(${view});`, resolveDir: roots[id], loader: 'tsx' },
            bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID': JSON.stringify(hqClientId) },
            plugins: [{ name: 'framework-fixture', setup(build) {
                build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
                build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'fixture' }));
                build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
                build.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: 'dynamic', namespace: 'fixture' }));
                build.onResolve({ filter: /^@\/lib\/prisma$/ }, () => ({ path: 'prisma', namespace: 'fixture' }));
                // Use CMS's original fallback settings without contacting its database.
                build.onLoad({ filter: /MarketingFooter\.tsx$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8').replace('export default async function', 'export default function').replaceAll('await prismadb.', 'prismadb.'), loader: 'tsx', resolveDir: path.dirname(args.path) }));
                build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
                    const fixtures = {
                        image: `import React from '${root.replaceAll('\\', '/')}/node_modules/react/index.js'; export default function Image({fill,unoptimized,priority,quality,sizes,...props}){return React.createElement('img',{...props,style:fill?{position:'absolute',inset:0,width:'100%',height:'100%',...props.style}:props.style,src:props.src+'?product='+window.__product})}`,
                        link: `import React from '${root.replaceAll('\\', '/')}/node_modules/react/index.js'; export default function Link(props){return React.createElement('a',props,props.children)}`,
                        navigation: `export const usePathname=()=>'/';`,
                        dynamic: `import React,{lazy,Suspense} from '${root.replaceAll('\\', '/')}/node_modules/react/index.js';export default function dynamic(load){const Component=lazy(load);return props=><Suspense fallback={null}><Component {...props}/></Suspense>;}`,
                        prisma: `export const prismadb={footerSetting:{findFirst:()=>null},socialSettings:{findFirst:()=>null},footerSection:{findMany:()=>[]}};`,
                    };
                    return { contents: fixtures[args.path], loader: 'jsx', resolveDir: root };
                });
                build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
            } }],
        });
        const css = (await appStyles(id)) + fs.readFileSync(path.join(componentDir(id), 'marketing.css'), 'utf8') + (onyx ? fs.readFileSync(path.join(roots.onyx, 'src/components/Landing/landing.css'), 'utf8') : '');
        responses[`/${id}`] = `<html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Basalt ${id}</title><style>${css}body{margin:0;background:#090b0e;color:#f5f5f5;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
        if(id==='hq')responses['/portal']=responses['/hq'];
    }
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if(url.pathname.startsWith('/api/auth/thirdweb/')){
            response.setHeader('Content-Type','application/json');
            if(url.pathname.endsWith('/is-logged-in'))response.end('false');
            else{response.statusCode=501;response.end(JSON.stringify({error:'Sign-in is available in the BasaltHQ app, outside this design preview.'}));}
            return;
        }
        if(/^\/basalt-shields\/(hq|crm|onyx|erp|surge|echo|cms|vigil)\.png$/.test(url.pathname)){
            const id=url.searchParams.get('product')||'crm',file=path.join(roots[id]||root,'public','basalt-shields',path.basename(url.pathname));
            response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(file));return;
        }
        if(url.pathname==='/basalt-flight/aerial-world-v1.png'){
            response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(path.join(root,'public/basalt-flight/aerial-world-v1.png')));return;
        }
        if (/\.(png|webp)$/.test(url.pathname)) { const id = url.searchParams.get('product') || 'crm'; const file = path.join(roots[id], 'public', path.basename(url.pathname)); if (fs.existsSync(file)) { response.setHeader('Content-Type', url.pathname.endsWith('.webp') ? 'image/webp' : 'image/png'); response.end(fs.readFileSync(file)); return; } }
        if (['/fonts/vox-light.woff2', '/fonts/vox-bold.woff2'].includes(url.pathname)) { response.setHeader('Content-Type', 'font/woff2'); response.end(fs.readFileSync(path.join(root, 'public/fonts', path.basename(url.pathname)))); return; }
        response.setHeader('Content-Type', 'text/html'); response.end(responses[request.url] || 'Local preview destination');
    });
    await new Promise(resolve => server.listen(Number(process.env.BASALT_REVIEW_PORT || 0), '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    if (process.argv.includes('--serve')) {
        responses['/'] = `<html><head><title>Basalt family preview</title><style>body{margin:0;background:#090b0e;color:#fff;font:13px Arial}nav{height:48px;display:flex;align-items:center;gap:24px;padding:0 24px;border-bottom:1px solid #ffffff20}a{color:#c6d3e0;text-decoration:none}iframe{width:100%;height:calc(100vh - 49px);border:0}</style></head><body><nav><strong>BASALT / DESIGN REVIEW</strong>${Object.keys(roots).map(id=>`<a href="/${id}" target="site">${id.toUpperCase()}</a>`).join('')}</nav><iframe name="site" src="/crm" title="Basalt landing page preview"></iframe></body></html>`;
        console.log(`Basalt family review: ${base}`);
        return;
    }
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const id of Object.keys(roots)) {
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
            await context.addInitScript(() => {
                window.__draws = 0;
                window.__storyMatrices = [];
                for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
                    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'].filter(name => prototype[name])) {
                        const draw = prototype[name]; prototype[name] = function (...args) { window.__draws++; return draw.apply(this, args); };
                    }
                }
            });
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(`${base}/${id}`);
            await page.locator('.bm-hero .bm-scene[data-renderer="webgl"]').waitFor();
            await page.waitForFunction(()=>document.querySelector('.bm-hero canvas').dataset.environment==='ready');
            if(id==='crm'){
                await page.evaluate(()=>{window.__lostExtension=document.querySelector('.bm-hero canvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.__lostExtension.loseContext();});
                await page.locator('.bm-hero .bm-scene[data-renderer="fallback"]').waitFor();
                await page.evaluate(()=>window.__lostExtension.restoreContext());
                await page.locator('.bm-hero .bm-scene[data-renderer="webgl"]').waitFor();
                await page.waitForFunction(()=>document.querySelector('.bm-hero canvas').dataset.environment==='ready');
            }
            await page.evaluate(() => document.fonts.ready);
            assert.ok(await page.locator('.bm-header .bm-brand > span').evaluate(element => getComputedStyle(element).fontFamily.toLowerCase().includes('vox')), 'Header uses VOX');
            assert.ok(await page.evaluate(() => { const faces=[...document.fonts].filter(font=>font.family==='BasaltVox');return faces.length===2&&faces.every(font=>font.status==='loaded'); }), 'Both actual VOX weights load');
            assert.deepEqual(await page.locator('.bm-header .basalt-wordmark').evaluate(element=>[getComputedStyle(element.querySelector('.basalt-wordmark-base')).fontWeight,getComputedStyle(element.querySelector('.basalt-wordmark-product')).fontWeight]),['300','700'],'Header uses contrasting VOX weights');
            assert.equal(await page.locator('h1').count(), 1);
            assert.equal(await page.locator('main').count(), 1);
            if(id==='hq'){
                assert.equal(await page.locator('#portal').count(),1,'HQ retains its embedded portal');
                assert.equal(await page.locator('#portal h1').count(),0,'Embedded portal preserves the single page H1');
                assert.ok(await page.locator('#portal button').count()>=8,'HQ portal retains sign-in and app launch controls');
                assert.equal(await page.locator('.bm-desktop-nav').getByRole('link',{name:'Portal',exact:true}).getAttribute('href'),'/portal','HQ retains the dedicated portal route');
            }
            assert.equal(await page.locator('video').count(), 0);
            assert.equal(await page.locator('.bm-family-card').count(), 8);
            await page.locator('.bm-family-grid').scrollIntoViewIfNeeded();
            await page.locator('.bm-family-card img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
            assert.ok(await page.locator('.bm-family-card').evaluateAll(cards=>cards.every(card=>{
                const shield=card.querySelector('img');
                return shield.naturalWidth>0&&getComputedStyle(card.querySelector('.basalt-wordmark-base')).fontWeight==='300'&&getComputedStyle(card.querySelector('.basalt-wordmark-product')).fontWeight==='700';
            })),'Every family card uses a real shield and contrasting VOX weights');
            await page.getByRole('tab').nth(1).click();
            assert.equal(await page.getByRole('tab').nth(1).getAttribute('aria-selected'), 'true');
            await page.getByRole('tab').nth(1).press('ArrowRight');
            assert.equal(await page.getByRole('tab').nth(2).getAttribute('aria-selected'), 'true');
            await page.getByRole('tab').nth(2).press('Home');
            assert.equal(await page.getByRole('tab').nth(0).getAttribute('aria-selected'), 'true');
            await page.locator('summary').first().click();
            assert.equal(await page.locator('details').first().getAttribute('open'), '');
            await page.evaluate(() => scrollTo(0, 0));
            await pause(200);
            await page.locator('.bm-stage-caption button').click();
            await pause(100); const draws = await page.evaluate(() => window.__draws); await pause(200);
            assert.equal(await page.evaluate(() => window.__draws), draws, 'pause must stop draws');
            await page.locator('.bm-stage-caption button').click();
            await page.waitForFunction(previous => window.__draws > previous, draws, { timeout: 5000 });
            // Freeze ambient motion so differences prove scroll-driven geometry changes.
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const poses = [], story = page.locator('#story'), storyScene = page.locator('.bm-story-stage .bm-scene');
            for (let chapter = 0; chapter < 4; chapter++) {
                await page.locator('.bm-story-stops a').nth(chapter).click();
                await page.waitForFunction(value => document.querySelector('#story').dataset.chapter === String(value), chapter);
                await storyScene.locator('canvas').waitFor();
                await page.waitForFunction(value => { const scene = document.querySelector('.bm-story-stage .bm-scene'); return scene.dataset.motionMode === 'still' && Math.abs(Number(scene.dataset.progress) - value / 3) < .001; }, chapter);
                assert.equal(await storyScene.getAttribute('data-renderer'), 'webgl', `${id} story renderer is active`);
                assert.equal(Number(await storyScene.getAttribute('data-progress')).toFixed(2), (chapter / 3).toFixed(2));
                const matrices = JSON.parse(await storyScene.locator('canvas').getAttribute('data-pose'));
                assert.ok(matrices.length > 5 && matrices.flat(Infinity).every(Number.isFinite), `${id} chapter ${chapter} draws finite geometry`);
                if (chapter) assert.notDeepEqual(matrices, poses.at(-1), `${id} geometry changes between chapters`);
                poses.push(matrices);
                assert.ok(await page.locator('.bm-story-stage').evaluate(e => { const r = e.getBoundingClientRect(); return Math.abs(r.top) < 1 && Math.abs(r.height - innerHeight) < 1 && r.width === innerWidth; }), `${id} story fills the viewport behind its chapter`);
                await page.screenshot({ path: path.join(captureDir, `${id}-story-${chapter}.png`) });
            }
            // Scrolling backwards must restore the authored pose, independent of elapsed time.
            await page.locator('.bm-story-stops a').first().click();
            await page.waitForFunction(() => document.querySelector('.bm-story-stage .bm-scene').dataset.progress === '0.000');
            assert.equal(await story.getAttribute('data-chapter'), '0');
            assert.deepEqual(JSON.parse(await storyScene.locator('canvas').getAttribute('data-pose')), poses[0], `${id} story reverses to its original geometry`);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.locator('.bm-story-stops a').nth(1).click(); await pause(700);
            await page.getByRole('button', { name: 'Pause story motion', exact: true }).click(); await pause(150);
            const frozenPose = await storyScene.getAttribute('data-progress');
            await page.locator('.bm-story-stops a').nth(3).click(); await pause(700);
            assert.equal(await storyScene.getAttribute('data-progress'), frozenPose, `${id} pause freezes scroll-driven motion`);
            await page.getByRole('button', { name: 'Resume story motion', exact: true }).click();
            await page.waitForFunction(() => Math.abs(Number(document.querySelector('.bm-story-stage .bm-scene').dataset.progress) - Number(document.querySelector('#story').dataset.progress)) < .002);
            assert.ok(Math.abs(Number(await storyScene.getAttribute('data-progress')) - Number(await story.getAttribute('data-progress'))) < .002, `${id} resume catches up with the current chapter`);
            await page.locator('.bm-story-stops a').nth(1).click(); await pause(700);
            const startY = await page.evaluate(() => scrollY);
            await page.locator('.bm-story-stops a').nth(2).click(); await pause(700);
            const endY = await page.evaluate(() => scrollY);
            await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), (startY + endY) / 2); await pause(150);
            const between = Number(await storyScene.getAttribute('data-progress'));
            assert.ok(between > .4 && between < .6, `${id} scrolling produces intermediate geometry, beyond the chapter poses`);
            await page.mouse.wheel(0, 100); await pause(350);
            assert.ok(Number(await storyScene.getAttribute('data-progress')) > between, `${id} the scene responds to the user's scroll wheel`);
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await pause(100);
            await page.screenshot({ path: path.join(captureDir, `${id}-desktop.png`), fullPage: true });
            await page.screenshot({ path: path.join(captureDir, `${id}-hero.png`) });
            const footer = id === 'echo' ? page.locator('.bm-site + section') : page.locator('footer');
            assert.equal(await footer.count(), 1, `${id} retains exactly one original footer`);
            const wordmark = footer.locator('.basalt-wordmark,.landing-wordmark,.font-vox,[style*="vox"]').first();
            if (await wordmark.count()) assert.ok(await wordmark.evaluate(element => getComputedStyle(element).fontFamily.toLowerCase().includes('vox')), `${id} footer uses VOX`);
            if(await footer.locator('.basalt-wordmark').count())assert.deepEqual(await footer.locator('.basalt-wordmark').evaluate(element=>[getComputedStyle(element.querySelector('.basalt-wordmark-base')).fontWeight,getComputedStyle(element.querySelector('.basalt-wordmark-product')).fontWeight]),['300','700'],`${id} footer uses contrasting VOX weights`);
            await footer.screenshot({ path: path.join(captureDir, `${id}-footer.png`) });
            if (id === 'onyx') {
                const toggle = page.getByRole('switch', { name: 'Preview Afterlife theme' });
                await toggle.click(); assert.equal(await toggle.getAttribute('aria-checked'), 'true');
                assert.equal(await page.evaluate(() => document.documentElement.classList.contains('afterlife-active')), false);
            }
            if (id === 'cms') assert.equal(await page.locator('.bm-hero .bm-primary').getAttribute('href'), '/en/demo');
            await page.addScriptTag({ content: axe });
            const violations = await page.evaluate(async () => (await axe.run('.bm-site', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ html: n.html, failure: n.failureSummary })) })));
            assert.deepEqual(violations, [], `${id} accessibility violations: ${JSON.stringify(violations)}`);
            for (const width of [768, 390, 320]) {
                await page.setViewportSize({ width, height: 844 });
                await pause(100);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} overflow at ${width}px`);
                assert.ok(await page.locator('.bm-nav').evaluate(nav => [...nav.querySelectorAll('.bm-brand,.bm-menu-toggle,.bm-nav-cta')].filter(element => getComputedStyle(element).display !== 'none').every(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; })), `${id} header fits at ${width}px`);
            }
            await page.emulateMedia({ reducedMotion: 'reduce' });
            for (const chapter of [1, 3]) {
                await page.locator('.bm-story-stops a').nth(chapter).click(); await pause(150);
                assert.equal(await story.getAttribute('data-chapter'), String(chapter));
                assert.ok(await page.locator('.bm-story-stage').evaluate(e => { const r = e.getBoundingClientRect(); return Math.abs(r.top) < 1 && Math.abs(r.height - innerHeight) < 1 && r.width === innerWidth; }), `${id} mobile story uses the full background`);
                const heading = await page.locator(`#story-title-${chapter}`).boundingBox();
                const prose = await page.locator(`#story-chapter-${chapter} .bm-story-prose`).boundingBox();
                const controls = await page.locator('.bm-story-stops').boundingBox();
                assert.ok(heading.y >= 72 && prose.y + prose.height < controls.y, `${id} mobile narration fits above its chapter controls`);
            }
            await page.screenshot({ path: path.join(captureDir, `${id}-story-mobile.png`) });
            await page.setViewportSize({ width: 667, height: 375 }); await pause(100);
            await page.locator('.bm-story-stops a').nth(2).click(); await pause(150);
            assert.equal(await story.getAttribute('data-chapter'), '2');
            assert.ok(await page.locator('.bm-story-stage').evaluate(e => e.getBoundingClientRect().bottom <= innerHeight), `${id} compact landscape story fits`);
            assert.ok(await page.locator('#story-title-2').evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 72 && r.bottom < innerHeight; }), `${id} compact landscape chapter is readable`);
            await page.setViewportSize({ width: 390, height: 844 });
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            const menu = page.locator('.bm-menu-toggle');
            await menu.click(); assert.equal(await menu.getAttribute('aria-expanded'), 'true');
            await menu.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
            assert.equal(await page.evaluate(() => document.activeElement?.className), 'bm-menu-toggle');
            await page.screenshot({ path: path.join(captureDir, `${id}-mobile.png`), fullPage: true });
            assert.deepEqual(errors, [], `${id} browser errors`);
            checks.push(`${id}: four distinct scroll poses, continuous wheel scrubbing, reverse scroll, story pause/resume, portrait/landscape narratives, navigation, tabs, FAQs, accessibility`);
            console.log(checks.at(-1));
            await context.close();
        }
        const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await reduced.addInitScript(() => {
            window.__draws = 0;
            for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
                for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'].filter(name => prototype[name])) {
                    const draw = prototype[name]; prototype[name] = function (...args) { window.__draws++; return draw.apply(this, args); };
                }
            }
        });
        const page = await reduced.newPage(); await page.goto(`${base}/crm`); await page.locator('.bm-hero .bm-scene[data-renderer="webgl"]').waitFor();
        await pause(100); const still = await page.evaluate(() => window.__draws); await pause(250);
        assert.equal(await page.evaluate(() => window.__draws), still, 'reduced motion must stop continuous draws');
        await reduced.close();
        const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await fallback.addInitScript(() => { const getContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return kind === 'webgl' || kind === 'webgl2' ? null : getContext.call(this, kind, ...args); }; });
        const fallbackPage = await fallback.newPage(); await fallbackPage.goto(`${base}/vigil`); await fallbackPage.locator('.bm-hero .bm-scene').waitFor(); await pause(100);
        assert.equal(await fallbackPage.locator('.bm-hero .bm-scene').getAttribute('data-renderer'), 'fallback');
        assert.equal(await fallbackPage.locator('.bm-hero .bm-scene-fallback').evaluate(element => getComputedStyle(element).opacity), '1');
        await fallbackPage.emulateMedia({ reducedMotion: 'reduce' });
        const fallbackStory = fallbackPage.locator('.bm-story-stage .bm-scene-fallback');
        await fallbackPage.locator('.bm-story-stops a').first().click(); await pause(150);
        const firstIllustration = await fallbackStory.innerHTML();
        await fallbackPage.locator('.bm-story-stops a').last().click(); await pause(150);
        assert.notEqual(await fallbackStory.innerHTML(), firstIllustration, 'WebGL fallback illustrations also tell the scrolling story');
        await fallbackPage.screenshot({ path: path.join(captureDir, 'vigil-fallback.png'), fullPage: true });
        await fallback.close();
        console.log('Shared motion: reduced-motion and WebGL-unavailable fallback passed');
        fs.writeFileSync(path.join(captureDir, 'checks.json'), JSON.stringify({ checks, shared: ['reduced motion', 'WebGL fallback'] }, null, 2));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
