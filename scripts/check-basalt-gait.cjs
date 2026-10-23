// Exercise the real figure rig at sub-frame boundaries, including very short
// translations and tiny turns. No WebGL or production server is required.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const esbuild = require('esbuild');
const { chromium } = require('U:/BasaltOnyx/onyx/frontend/node_modules/playwright');
const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
const bundle = esbuild.buildSync({
    stdin: {
        contents: `
import { THREE as T } from '${root}/components/basalt-marketing/three-runtime.js';
import { createFigure } from '${root}/components/basalt-marketing/figure-study.js';
import { stage } from '${root}/components/basalt-marketing/narrative-acting.js';
const root = new T.Group(), v = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const w = {
    root, accent: new T.Color('#58adff'), people: [],
    group(parent=root) { const g=new T.Group(); parent.add(g); return g; },
    mesh(geometry,material,parent=root,position=v()) {
        const mesh=new T.Mesh(geometry,material); parent.add(mesh); mesh.position.copy(position); return mesh;
    }
};
const h=createFigure(w,root,v(),1,0);
h.g.userData.ground=0;
window.audit=()=>{
    const cases=[
        ['long straight walk',0,3,0,0],
        ['11cm adjustment',0,.11,0,0],
        ['2cm adjustment',0,.02,0,0],
        ['1mm adjustment',0,.001,0,0],
        ['quarter turn',0,0,0,Math.PI/2],
        ['small turn',0,0,0,.04],
        ['walk then turn',2,2,-1.1,.5]
    ];
    return cases.map(([name,x,z,from,to])=>{
        const track=[
            {p:0,x:0,z:0,yaw:from,action:'carry',focus:[0,1.4,3]},
            {p:1,x,z,yaw:to,action:'offer',focus:[0,1.4,3]}
        ];
        const pose=p=>{
            stage(h,track,p,0,false); root.updateMatrixWorld(true);
            return {
                position:h.g.position.toArray(),
                feet:h.legs.map(({ankle})=>ankle.getWorldPosition(v()).toArray()),
                minimum:h.legs.map(({foot})=>{
                    const vertices=foot.geometry.getAttribute('position'),m=foot.matrixWorld.elements;
                    let low=Infinity;
                    for(let i=0;i<vertices.count;i++) low=Math.min(low,vertices.getX(i)*m[1]+vertices.getY(i)*m[5]+vertices.getZ(i)*m[9]+m[13]);
                    return low;
                }),
                stance:structuredClone(h.stance),
                upper:[h.torso.getWorldPosition(v()).toArray(),h.head.getWorldPosition(v()).toArray(),...h.joints.map(({hand})=>hand.getWorldPosition(v()).toArray())]
            };
        };
        const distance=(a,b)=>Math.hypot(...a.map((q,i)=>q-b[i]));
        let maxFootPop=0,maxBodyPop=0,maxTargetError=0,peakLift=0;
        let maxGroundPenetration=0,maxPlantedClearance=0,plantedSlides=0,previous=null;
        const nonfinite=[];
        // Comparing immediately around a boundary catches snaps that a normal
        // 240-frame scene test skips. Legitimate movement is tiny over 2e-7 progress.
        for(let i=0;i<=10000;i++){
            const p=i/10000,a=pose(Math.max(0,p-1e-7)),b=pose(Math.min(1,p+1e-7));
            for(let j=0;j<2;j++){
                maxFootPop=Math.max(maxFootPop,distance(a.feet[j],b.feet[j]));
                const foot=b.feet[j],stance=b.stance[j];
                peakLift=Math.max(peakLift,stance.lift);
                maxTargetError=Math.max(maxTargetError,Math.hypot(foot[0]-stance.x,foot[2]-stance.z));
                maxGroundPenetration=Math.max(maxGroundPenetration,-b.minimum[j]);
                if(stance.planted) maxPlantedClearance=Math.max(maxPlantedClearance,b.minimum[j]);
                // Heel/toe roll deliberately raises the ankle. Test horizontal
                // anchoring here; the actual sole geometry above checks contact.
                if(previous&&stance.planted&&previous.stance[j].planted&&stance.contact===previous.stance[j].contact&&Math.hypot(foot[0]-previous.feet[j][0],foot[2]-previous.feet[j][2])>.001) plantedSlides++;
            }
            if(!a.upper.flat().every(Number.isFinite)||!b.upper.flat().every(Number.isFinite)) nonfinite.push(p);
            maxBodyPop=Math.max(maxBodyPop,...a.upper.map((q,j)=>distance(q,b.upper[j])));
            previous=b;
        }
        const first=pose(0),last=pose(1),reverse=pose(0);
        return {name,expectedPosition:[x,0,z],nonfinite:nonfinite.slice(0,10),maxFootPop,maxBodyPop,maxTargetError,peakLift,maxGroundPenetration,maxPlantedClearance,plantedSlides,reversible:JSON.stringify(first)===JSON.stringify(reverse),finalPosition:last.position};
    });
};`,
        resolveDir: root, loader: 'js'
    },
    bundle: true, write: false, format: 'iife', platform: 'browser'
}).outputFiles[0].text;

(async () => {
    const server = http.createServer((request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end('<script>' + bundle + '</script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        const results = await page.evaluate(() => window.audit());
        assert.deepEqual(errors, [], 'Figure rig throws in browser');
        for (const result of results) {
            const { name } = result;
            assert.equal(result.nonfinite.length, 0, name + ': nonfinite joints');
            assert.ok(result.reversible, name + ': reversing scroll changes pose');
            assert.ok(result.maxFootPop < .001, name + ': discontinuous feet');
            assert.ok(result.maxBodyPop < .001, name + ': discontinuous upper body');
            assert.ok(result.maxTargetError < .007, name + ': foot misses its target');
            assert.ok(result.maxGroundPenetration < .009, name + ': sole below floor');
            assert.ok(result.maxPlantedClearance < .009, name + ': planted sole hovers');
            assert.equal(result.plantedSlides, 0, name + ': planted foot slides');
            assert.ok(Math.hypot(...result.finalPosition.map((p, i) => p - result.expectedPosition[i])) < .00001, name + ': misses destination');
            console.log(`${name}: 10,001 poses; continuous joints, anchored soles, exact destination; peak lift ${(result.peakLift * 1000).toFixed(1)}mm`);
        }
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
