// Mirror the canonical marketing component files. Never touches application pages or removes files.
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../components/basalt-marketing');
const destinations = {
    onyx: 'U:/BasaltOnyx/onyx/frontend/src/components/basalt-marketing',
    hq: 'U:/BasaltHQ/main-site/src/components/basalt-marketing',
    erp: 'U:/BasaltERP/Site/erp-site/src/components/basalt-marketing',
    cms: 'U:/Ledger1CMS/cms/components/basalt-marketing',
    echo: 'I:/Osiris/varuni-demo/voice/src/components/basalt-marketing',
    vigil: 'I:/Agents/Varuna/Vigil/app/components/basalt-marketing',
    surge: 'U:/BasaltSurge/portalpay-official/src/components/basalt-marketing',
};
const check = process.argv.includes('--check');
const publicRoots = {
    onyx: 'U:/BasaltOnyx/onyx/frontend/public', hq: 'U:/BasaltHQ/main-site/public', erp: 'U:/BasaltERP/Site/erp-site/public',
    cms: 'U:/Ledger1CMS/cms/public', echo: 'I:/Osiris/varuni-demo/voice/public', vigil: 'I:/Agents/Varuna/Vigil/public', surge: 'U:/BasaltSurge/portalpay-official/public',
};
const requested = process.argv.find(argument => argument.startsWith('--site='))?.split('=')[1];
if (requested && !destinations[requested]) throw new Error(`Unknown Basalt site: ${requested}`);
let differences = 0;
for (const [site, destination] of Object.entries(destinations)) {
    if (requested && requested !== site) continue;
    const root = path.resolve(destination);
    if (!fs.existsSync(path.resolve(root, '../..'))) throw new Error(`Missing source checkout for ${site}: ${root}`);
    if (!check) fs.mkdirSync(root, { recursive: true });
    for (const file of fs.readdirSync(source)) {
        if (site === 'surge' && file !== 'ecosystem.ts') continue;
        if (!fs.statSync(path.join(source, file)).isFile()) continue;
        const target = path.resolve(root, file);
        if (path.dirname(target) !== root) throw new Error('Destination escapes shared component directory');
        const content = fs.readFileSync(path.join(source, file));
        const matches = fs.existsSync(target) && content.equals(fs.readFileSync(target));
        if (!matches && check) { console.error(`${site}: ${file} differs`); differences++; }
        else if (!matches) fs.writeFileSync(target, content);
    }
    console.log(`${site}: ${check ? 'checked' : 'synced'}`);
    const fonts = path.resolve(publicRoots[site], 'fonts');
    if (!check) fs.mkdirSync(fonts, { recursive: true });
    for (const file of ['vox-light.woff2', 'vox-bold.woff2']) {
        const target = path.join(fonts, file), content = fs.readFileSync(path.resolve(source, '../../public/fonts', file));
        const matches = fs.existsSync(target) && content.equals(fs.readFileSync(target));
        if (!matches && check) { console.error(`${site}: ${file} differs or is missing`); differences++; }
        else if (!matches) {
            if (fs.existsSync(target)) throw new Error(`Preserve differing existing font asset: ${target}`);
            fs.writeFileSync(target, content);
        }
    }
    const shields=path.resolve(publicRoots[site],'basalt-shields');
    if(!check)fs.mkdirSync(shields,{recursive:true});
    for(const file of fs.readdirSync(path.resolve(source,'../../public/basalt-shields'))){
        const content=fs.readFileSync(path.resolve(source,'../../public/basalt-shields',file)),target=path.join(shields,file);
        const matches=fs.existsSync(target)&&content.equals(fs.readFileSync(target));
        if(!matches&&check){console.error(`${site}: shield ${file} differs or is missing`);differences++;}
        else if(!matches)fs.writeFileSync(target,content);
    }
    if(site!=='surge'){
        const flight=path.resolve(publicRoots[site],'basalt-flight');
        if(!check)fs.mkdirSync(flight,{recursive:true});
        for(const file of ['aerial-world-v1.png']){
            const content=fs.readFileSync(path.resolve(source,'../../public/basalt-flight',file)),target=path.join(flight,file);
            const matches=fs.existsSync(target)&&content.equals(fs.readFileSync(target));
            if(!matches&&check){console.error(`${site}: flight environment ${file} differs or is missing`);differences++;}
            else if(!matches)fs.writeFileSync(target,content);
        }
    }
}
if (differences) process.exitCode = 1;
