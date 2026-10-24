import type { SceneKind } from './products';

export type Vec3 = [number, number, number];
type Keys<T> = [T, T, T, T];
export type SceneItem = { id: string; mesh: 'block' | 'orb' | 'crystal' | 'shield' | 'ring'; position: Vec3; rotation: Vec3; scale: Vec3; alpha: number; wire: number; glow: number };
export type ScenePlan = { items: SceneItem[]; chapter: number };
export const sceneLabels: Record<SceneKind, Record<string, string>> = {
    network: { customer: 'CUSTOMER CONTEXT', 'record-0': 'NEXT CONVERSATION' },
    crystal: { 'platform-0': 'X / TWITTER', 'platform-1': 'LINKEDIN', 'platform-2': 'FACEBOOK', 'platform-3': 'INSTAGRAM' },
    constellation: Object.fromEntries(['CRM', 'ONYX', 'ERP', 'CMS', 'ECHO', 'VIGIL', 'SURGE'].map((name, i) => [`application-${i}`, name])),
    modules: Object.fromEntries(['INVENTORY', 'RESOURCES', 'TEAM', 'WORKFLOW', 'REPORTING', 'CUSTOM'].map((name, i) => [`module-${i}`, name])),
    pages: { 'canvas-0': 'THE PAGE', 'canvas-1': 'TABLET', 'canvas-2': 'MOBILE' },
    wave: { 'assistant-context': 'ASSISTANT' },
    shield: { brief: 'THE BRIEF', 'governance-shield': 'CONNECTED LEGAL WORK' },
};
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const v = (x: number, y: number, z = 0): Vec3 => [x, y, z];
const uniform = (n: number): Vec3 => [n, n, n];
const same = <T,>(n: T): Keys<T> => [n, n, n, n];

/** Four authored poses per product. Scrolling interpolates poses; time only adds ambient motion. */
export function composeScene(kind: SceneKind, progress: number, time: number): ScenePlan {
    const p = clamp(progress), part = Math.min(2, Math.floor(p * 3)), blend = smooth(p * 3 - part);
    const number = (keys: Keys<number>) => lerp(keys[part], keys[part + 1], blend);
    const vector = (keys: Keys<Vec3>): Vec3 => keys[part].map((n, i) => lerp(n, keys[part + 1][i], blend)) as Vec3;
    const items: SceneItem[] = [];
    const add = (id: string, mesh: SceneItem['mesh'], positions: Keys<Vec3>, scales: Keys<Vec3>, rotations = same(v(0, 0)), opacity = same(1), glow = .05, wire = .13) => {
        const item: SceneItem = { id, mesh, position: vector(positions), scale: vector(scales).map(n => Math.max(.001, n)) as Vec3, rotation: vector(rotations), alpha: number(opacity), wire, glow };
        items.push(item); return item;
    };
    const line = (id: string, a: Vec3, b: Vec3, opacity: number, width = .009) => {
        const delta = b.map((n, i) => n - a[i]) as Vec3, length = Math.hypot(...delta);
        if (length < .01 || opacity < .01) return;
        const center = a.map((n, i) => (n + b[i]) / 2) as Vec3;
        add(id, 'block', same(center), same(v(width, length / 2, width)), same(v(Math.acos(delta[1] / length), Math.atan2(delta[0], delta[2]))), same(opacity), .28, 0);
    };
    const packet = (id: string, a: Vec3, b: Vec3, offset: number, opacity: number) => {
        const t = (time * .17 + offset) % 1;
        add(id, 'orb', same(a.map((n, i) => lerp(n, b[i], t)) as Vec3), same(uniform(.045)), same(v(0, 0)), same(opacity), .7, 0);
    };
    const scatter = (i: number, count: number): Vec3 => v(Math.cos(i * 2.4) * (1.25 + i % 3 * .35), Math.sin(i * 2.4) * 1.35, (i / count - .5) * 1.5);
    const drift = Math.sin(time * .35) * .045;

    if (kind === 'network') {
        const center = add('customer', 'orb', same(v(0, drift)), [uniform(.04), uniform(.58), uniform(.5), uniform(.65)], same(v(.15, time * .04)), same(1), .15);
        const records: SceneItem[] = [];
        for (let i = 0; i < 12; i++) {
            const angle = i * TAU / 12;
            const context = v(Math.cos(angle) * 1.65, Math.sin(angle) * 1.35, Math.sin(angle * 2) * .55);
            const decision = i === 0 ? v(1.65, .35, .5) : v(-1.6 + (i % 3) * .35, -.95 + Math.floor(i / 3) * .55, -.3);
            const radius = i < 7 ? 1.15 : 2.05;
            const relationship = v(Math.cos(angle) * radius, Math.sin(angle) * radius * .7, Math.sin(angle * 2) * .7);
            const record = add(`record-${i}`, i === 0 ? 'orb' : 'block', [scatter(i, 12), context, decision, relationship], [uniform(.1), uniform(.14), uniform(i === 0 ? .29 : .1), uniform(i < 7 ? .16 : .1)], same(v(.2, i * .5 + time * .025)), same(1), i === 0 ? .4 : .06);
            records.push(record);
            const opacity = number([0, .65, i === 0 ? 1 : .08, .8]);
            line(`context-${i}`, center.position, record.position, opacity);
            if (i === 0 || i % 3 === 0) packet(`reply-${i}`, i % 2 ? record.position : center.position, i % 2 ? center.position : record.position, i / 12, number([0, 0, i === 0 ? 1 : 0, .9]));
        }
        for (let i = 7; i < 12; i++) line(`growth-${i}`, records[i - 7].position, records[i].position, number([0, 0, 0, .75]));
        const focus = records[0].position;
        add('intent-highlight', 'ring', [focus, focus, focus, focus], [uniform(.1), uniform(.1), uniform(.3), uniform(.1)], same(v(Math.PI / 2, 0)), [0, 0, .85, 0], .4, 0);
    } else if (kind === 'crystal') {
        const center = add('intelligence', 'crystal', same(v(0, drift)), [uniform(.07), uniform(.87), uniform(.65), uniform(.72)], same(v(.1, .35 + Math.sin(time * .2) * .06, -.08)), same(1), .12, .07);
        for (let i = 0; i < 12; i++) {
            const angle = i * TAU / 12;
            add(`signal-${i}`, 'crystal', [scatter(i, 12), v(Math.cos(angle) * .36, Math.sin(angle) * .9, Math.sin(angle) * .36), v(0, 0), v(0, 0)], [v(.15, .24, .15), uniform(.1), uniform(.01), uniform(.01)], same(v(i * .25, -i + time * .07, .4)), [1, .5, 0, 0], .2, .16);
        }
        for (let i = 0; i < 4; i++) {
            const destination = v(i % 2 ? 1.7 : -1.7, i < 2 ? .85 : -.85, .05);
            const gateway = add(`platform-${i}`, 'block', [v(0, 0), v(0, 0), destination, destination], [uniform(.01), uniform(.01), v(.39, .32, .065), v(.39, .32, .065)], same(v(.05, i % 2 ? -.18 : .18)), [0, 0, 1, 1], .12);
            line(`route-${i}`, center.position, gateway.position, number([0, 0, .4, .8]));
            packet(`command-${i}`, center.position, gateway.position, i / 4, number([0, 0, 0, 1]));
            packet(`activity-${i}`, gateway.position, center.position, i / 4 + .15, number([0, 0, 0, .5]));
            for (let row = 0; row < 2; row++) add(`task-${i}-${row}`, 'block', same(v(destination[0], destination[1] + .07 - row * .15, .14)), same(v(.25, .012, .02)), same(v(0, 0)), [0, 0, .4, 1], .4, 0);
        }
    } else if (kind === 'constellation') {
        const core = add('shared-context', 'block', same(v(0, drift)), [uniform(.06), uniform(.43), uniform(.43), v(.5, .16, .5)], same(v(.35, .5, -.08)), [0, .9, 1, 1], .16);
        const apps: SceneItem[] = [];
        for (let i = 0; i < 7; i++) {
            const angle = i * TAU / 7;
            const orbit = v(Math.cos(angle) * 1.7, Math.sin(angle) * 1.25, Math.sin(angle * 2) * .65);
            const architecture = v((i % 3 - 1) * .94, (Math.floor(i / 3) - 1) * .75, .1 + (i % 2) * .3);
            const app = add(`application-${i}`, 'block', [scatter(i, 7), orbit, orbit, architecture], [uniform(.24), uniform(.23), uniform(.23), v(.3, .2, .3)], [v(i * .3, i * .5), v(.2, .4), v(.2, .4), v(.35, .5, -.08)], same(1), .1);
            apps.push(app); line(`context-${i}`, core.position, app.position, number([0, .18, .65, .25]));
        }
        apps.forEach((app, i) => {
            const next = apps[(i + 1) % 7];
            line(`business-relationship-${i}`, app.position, next.position, number([0, 0, .8, .8]));
            packet(`business-action-${i}`, app.position, next.position, i / 7, number([0, 0, .5, .9]));
        });
        add('foundation', 'block', same(v(0, -1.38, -.1)), [v(.1, .035, .1), v(.1, .035, .1), v(.1, .035, .1), v(1.75, .035, .85)], same(v(.35, .5, -.08)), [0, 0, 0, .5], .12);
    } else if (kind === 'modules') {
        const layers: SceneItem[] = [];
        for (let i = 0; i < 6; i++) {
            const y = (i - 2.5) * .37;
            const layer = add(`module-${i}`, 'block', [scatter(i, 6), v(0, y), v(i === 5 ? .48 : 0, (i - 2.5) * .66), v(0, y)], [v(.36, .19, .48), v(.87, .11, .72), v(.87, .11, .72), v(.87, .11, .72)], [v(i * .2, i * .5, .12), v(.2, .55, -.1), v(.2, .55, -.1), v(.2, .55, -.1)], i === 5 ? [.1, 0, 1, 1] : same(1), i === 5 ? .28 : .04);
            layers.push(layer);
            if (i > 0) line(`dependency-${i}`, layers[i - 1].position, layer.position, number([0, .2, .8, .35]), .013);
        }
        const input = v(-1.9, -.8, .15), output = v(1.9, .8, .15);
        add('resource-input', 'block', same(input), same(v(.18, .2, .18)), same(v(.2, .55)), [0, 0, 0, 1], .2);
        add('report-output', 'block', same(output), same(v(.2, .28, .08)), same(v(.1, -.2)), [0, 0, 0, 1], .2);
        line('inventory-in', input, layers[0].position, number([0, 0, 0, .9]));
        line('reporting-out', layers[5].position, output, number([0, 0, 0, .9]));
        packet('operational-change', input, layers[0].position, 0, number([0, 0, 0, 1]));
        packet('through-the-stack', layers[0].position, layers[5].position, .33, number([0, 0, .2, 1]));
        packet('updated-report', layers[5].position, output, .66, number([0, 0, 0, 1]));
    } else if (kind === 'pages') {
        const screens: SceneItem[] = [];
        for (let i = 0; i < 3; i++) {
            const desktop = i === 0, mobile = i === 2;
            const responsive = v((i - 1) * 1.48, 0, i === 1 ? .2 : 0);
            const screen = add(`canvas-${i}`, 'block', [v((i - 1) * 1.5, .25 - i * .25, -i * .4), v(0, 0, -.2 * i), responsive, v(i === 0 ? .5 : -1.5 + i * .1, i === 0 ? 0 : (i - 1.5) * 1.25, i === 0 ? .3 : -.55)], [v(.5, .7, .04), v(1.12, 1.35, .035), v(mobile ? .3 : desktop ? .62 : .45, .95, .035), v(i === 0 ? 1.04 : .38, i === 0 ? 1.4 : .52, .035)], [v(.15, (i - 1) * .4, (i - 1) * .13), v(.05, -.18, 0), v(.05, i === 0 ? .12 : -.12), v(.04, -.12, 0)], [i === 0 ? .25 : .15, i === 0 ? .65 : .25, .7, i === 0 ? .8 : .35], .04, .07);
            screens.push(screen);
        }
        for (let i = 0; i < 9; i++) {
            const screen = screens[Math.floor(i / 3)], row = i % 3;
            const relative = v(screen.position[0], screen.position[1] + screen.scale[1] * (.54 - row * .52), screen.position[2] + .14);
            const loose = scatter(i, 9);
            add(`content-${i}`, 'block', [loose, v(0, .72 - row * .62, .1 - Math.floor(i / 3) * .2), relative, relative], [v(.21, row === 0 ? .24 : .025, .045), v(.78, row === 0 ? .27 : .035, .03), v(screen.scale[0] * .74, row === 0 ? .21 : .025, .025), v(screen.scale[0] * .74, row === 0 ? screen.scale[1] * .24 : .025, .025)], same(v(0, -.12)), [1, Math.floor(i / 3) === 0 ? 1 : .12, 1, Math.floor(i / 3) === 0 ? 1 : .3], row === 0 ? .14 : .3, .04);
        }
        line('next-version', screens[1].position, screens[0].position, number([0, 0, 0, .7]));
        packet('content-update', screens[1].position, screens[0].position, .1, number([0, 0, 0, .9]));
    } else if (kind === 'wave') {
        const assistant = add('assistant-context', 'orb', same(v(0, drift)), [uniform(.015), uniform(.62), uniform(.42), uniform(.4)], same(v(.1, time * .035)), [0, 1, .8, .8], .23, .04);
        for (let group = 0; group < 3; group++) {
            const a = group * TAU / 3 - Math.PI / 2;
            const speaker = v(Math.cos(a) * 1.6, Math.sin(a) * 1.25, .25);
            for (let i = 0; i < 15; i++) {
                const x = (i - 7) * .15;
                const waveform = .08 + Math.abs(Math.sin(i * .63 + time * 1.7 + group * 1.3)) * (.3 + Math.sin(i * .22) * .14);
                const position = vector([v(x, group === 0 ? 0 : -1.8), v(Math.cos(i * TAU / 15) * 1.25, Math.sin(i * TAU / 15) * .9), v(group === 0 ? -1.25 + x * .58 : 1.25 + x * .58, group === 2 ? -1.8 : 0), v(speaker[0] + x * .42, speaker[1], speaker[2])]);
                const height = number([waveform, .1 + waveform * .4, waveform * .8, waveform * .65]);
                add(`voice-${group}-${i}`, 'block', same(position), same(v(.021, height, .025)), same(v(0, 0)), group === 0 ? same(1) : group === 1 ? [0, 0, 1, 1] : [0, 0, 0, 1], .38, 0);
            }
            line(`voice-context-${group}`, speaker, assistant.position, number([0, group === 0 ? .15 : 0, .2, .6]));
            packet(`conversation-turn-${group}`, group % 2 ? assistant.position : speaker, group % 2 ? speaker : assistant.position, group / 3, number([0, 0, group < 2 ? .9 : 0, .9]));
        }
        for (let i = 0; i < 3; i++) add(`context-${i}`, 'block', same(v((i - 1) * .65, 1.15, -.25)), same(v(.17, .12, .025)), same(v(0, 0)), [0, 1, .25, 0], .14);
        add('shared-resonance', 'ring', same(v(0, 0, -.3)), [uniform(.1), uniform(.1), uniform(.1), uniform(.9)], same(v(Math.PI / 2, 0)), [0, 0, 0, .38], .2, 0);
    } else {
        const brief = add('brief', 'block', [v(0, -.2), v(0, 0), v(.45, 0, .2), v(0, 0, -.3)], [v(.55, .8, .04), v(.55, .8, .04), v(.7, 1.05, .05), v(.5, .75, .04)], same(v(.05, -.16)), [1, .75, 1, .22], .05, .09);
        for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6 + Math.PI / 6;
            const agent = add(`specialist-${i}`, 'orb', [scatter(i, 6), v(Math.cos(a) * 1.72, Math.sin(a) * 1.3), v(-1.45, .9 - i * .35, -.2), v(Math.cos(a) * 1.65, Math.sin(a) * 1.5, -.25)], [uniform(.08), uniform(.15), uniform(.095), uniform(.09)], same(v(0, 0)), [.2, 1, .8, .6], .2, .05);
            line(`specialist-context-${i}`, agent.position, brief.position, number([0, .7, .25, .08]));
            if (i < 3) packet(`finding-${i}`, agent.position, brief.position, i / 3, number([0, .5, .8, 0]));
            add(`evidence-${i}`, 'block', [scatter(i, 6), v(Math.cos(a) * 1.72, Math.sin(a) * 1.3, -.2), v(-1.52, .9 - i * .35, -.3), v(0, 0, -.6)], [v(.21, .3, .03), v(.05, .05, .02), v(.23, .08, .02), v(.02, .02, .02)], same(v(0, .1)), [1, .15, .65, 0], .08, .08);
        }
        for (let row = 0; row < 4; row++) add(`draft-clause-${row}`, 'block', same(v(brief.position[0], .52 - row * .34, brief.position[2] + .15)), [v(.3, .014, .02), v(.3, .014, .02), v(.45, .016, .02), v(.3, .014, .02)], same(v(0, 0)), [.3, .4, 1, .15], .25, 0);
        add('governance-shield', 'shield', [v(0, 0), v(0, 0), v(0, 0), v(0, 0, .15)], [uniform(.01), uniform(.01), uniform(.2), uniform(1.06)], same(v(.02, -.1, -.02)), [0, 0, 0, .93], .09, .14);
        for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6;
            add(`shield-segment-${i}`, 'shield', [scatter(i, 6), scatter(i, 6), v(Math.cos(a) * 1.45, Math.sin(a), -.3), v(0, 0, -.2)], [uniform(.01), uniform(.01), uniform(.14), uniform(.15)], same(v(0, a)), [0, 0, .1, 0], .1, .06);
        }
    }
    return { items, chapter: Math.min(3, Math.floor(p * 3 + .15)) };
}
