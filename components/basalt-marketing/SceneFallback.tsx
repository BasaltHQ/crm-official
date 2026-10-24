import type { SceneKind } from './products';

const palettes: Record<SceneKind, [string, string, string]> = {
    network: ['#79bbaa', '#405c58', '#e3c88f'], crystal: ['#b5a0cd', '#555062', '#e0caab'],
    constellation: ['#91bcd2', '#475f69', '#dfc88e'], modules: ['#85cbc0', '#426660', '#d7cda0'],
    pages: ['#b6a4c7', '#53675c', '#e5d1ac'], wave: ['#ddbb73', '#746444', '#f1d794'],
    shield: ['#b9787c', '#515663', '#d9c3a1'],
};
const titles: Record<SceneKind, string[]> = {
    network: ['A question takes flight', 'Understanding creates lift', 'A considered response', 'The conversation rises'],
    crystal: ['One idea catches the wind', 'Give the idea a voice', 'Different editions, distinct audiences', 'Keep the original voice in view'],
    constellation: ['One workshop above the clouds', 'Discover the connected districts', 'The harbour opens into view', 'A portal to your next chapter'],
    modules: ['One needed resource', 'The right route opens', 'Work moves in sequence', 'Delivered where it matters'],
    pages: ['A story begins to unfold', 'Give the pages a structure', 'Consider the whole composition', 'A story becomes a world'],
    wave: ['A question takes flight', 'A voice finds its context', 'An answer finds its way back', 'An exchange becomes shared'],
    shield: ['A question enters the weather', 'Every contribution has a source', 'A sheltered moment for judgment', 'The reasoning travels with the work'],
};

function Arch({ x, y, width = 52, height = 104, color = '#b9ad8a' }: { x: number; y: number; width?: number; height?: number; color?: string }) {
    return <g transform={`translate(${x} ${y})`}>
        <path d={`M0 ${height}V${height * .42}Q0 ${height * .17} ${width / 2} 0Q${width} ${height * .17} ${width} ${height * .42}V${height}`} stroke={color} strokeWidth="5"/>
        <path d={`M7 ${height}V${height * .43}Q7 ${height * .2} ${width / 2} 9Q${width - 7} ${height * .2} ${width - 7} ${height * .43}V${height}`} stroke="#6e664d" strokeWidth="1.3"/>
        <path d={`M-4 ${height}H${width + 4}`} stroke={color} strokeWidth="7"/>
    </g>;
}

function Glider({ x, y, scale = 1, bank = -12, seal, layered = false, freight = false }: { x: number; y: number; scale?: number; bank?: number; seal: string; layered?: boolean; freight?: boolean }) {
    return <g transform={`translate(${x} ${y}) rotate(${bank}) scale(${scale})`}>
        {layered && <path d="M-143 24Q-60-26 0 8Q62-26 143 24L28 54 0 42-28 54Z" fill="#b6b299" stroke="#b29c6e" strokeWidth="1.2"/>}
        <path d="M-149 5Q-76-40 0-8Q74-40 149 5L34 39 0 24-34 39Z" fill="#f0e6c9" stroke="#b6a071" strokeWidth="1.7"/>
        <path d="M-149 5-10 8 0 24 10 8 149 5M0-8V49" stroke="#8d754a" strokeWidth="2"/>
        {[-1, 1].map(side => <g key={side} transform={`scale(${side} 1)`}>
            {[22, 48, 76, 104, 130].map((v, i) => <path key={v} d={`M${v} ${-13 - Math.sin(i * .7) * 6}Q${v - 6} 8 ${16 + i * 24} ${34 - i * 6}`} stroke="#b5a073" strokeWidth="1"/>)}
            <path d="M10-6 130 9M10 26 92-15" stroke="#b5a073" strokeWidth=".55"/>
        </g>)}
        <ellipse cx="0" cy="8" rx="9" ry="6" fill={seal} stroke="#c0a573" strokeWidth="2"/>
        <path d="M-4 9 0 4 4 9" stroke="#f4dfb5" strokeWidth="1"/>
        {freight && <><path d="M-29 20-24 72M29 20 24 72" stroke="#5d5a46" strokeWidth="1.2"/>
            <path d="M-33 66 24 59 38 73 38 107-19 114-33 101Z" fill="#ddd3b4" stroke="#8d7954" strokeWidth="2"/>
            <path d="M-33 66-19 79 38 73M-19 79V114M-18 64-6 77V112M17 60 29 74V108" stroke="#99815a" strokeWidth="2"/>
            <path d="M-3 86 22 83V96L-3 99Z" fill={seal} opacity=".65"/></>}
    </g>;
}

function Kite({ x, y, scale = 1, tint }: { x: number; y: number; scale?: number; tint: string }) {
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path d="M0-84 68-3 0 104-68-3Z" fill="#e9dfdd" stroke="#b39e77" strokeWidth="2"/>
        <path d="M0-84 68-3 0 10-68-3Z" fill={tint} opacity=".65"/>
        <path d="M0-84V104M-68-3 68-3" stroke="#9c865d" strokeWidth="1.8"/>
        <path d="M-9 104Q19 139-8 165T-3 219L5 219Q-16 171 2 162T6 104Z" fill="#ddd3c8" stroke="#b59e79" strokeWidth=".8"/>
        <ellipse cx="0" cy="-5" rx="9" ry="11" fill={tint} stroke="#bca06d"/>
        <path d="M-24 28H24M-24 37H19M-18 47H24M-14 57H12" stroke="#796a72" strokeWidth="1.2"/>
    </g>;
}

/** Chapter-specific flight illustrations remain meaningful without a graphics context. */
export default function SceneFallback({ kind, chapter, gradient }: { kind: SceneKind; chapter: number; gradient: string }) {
    const beat = Math.max(0, Math.min(3, chapter)), [accent, stone, sun] = palettes[kind];
    const sky = `${gradient}-flight-sky`, paper = `${gradient}-flight-paper`, mist = `${gradient}-flight-mist`, cliff = `${gradient}-flight-cliff`, blur = `${gradient}-flight-blur`;
    const heroY = [333, 302, 287, 225][beat], heroX = [333, 350, 333, 338][beat];
    return <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <title>{titles[kind][beat]}</title>
        <defs>
            <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1"><stop stopColor={kind === 'shield' ? '#465c6b' : '#779a9e'}/><stop offset=".68" stopColor={sun}/><stop offset="1" stopColor="#f0dec0"/></linearGradient>
            <linearGradient id={cliff} x1="0" y1="0" x2="1" y2=".3"><stop stopColor="#303b3a"/><stop offset=".7" stopColor={stone}/><stop offset="1" stopColor="#828779"/></linearGradient>
            <linearGradient id={paper} x1="0" y1="0" x2="1" y2=".9"><stop stopColor="#fff3d0"/><stop offset=".46" stopColor="#dfd0ae"/><stop offset="1" stopColor="#ad9e7e"/></linearGradient>
            <radialGradient id={mist}><stop stopColor="#f8efd8" stopOpacity=".9"/><stop offset="1" stopColor="#e6e2d3" stopOpacity="0"/></radialGradient>
            <filter id={blur}><feGaussianBlur stdDeviation="15"/></filter>
        </defs>
        <path d="M0 0H600V600H0Z" fill={`url(#${sky})`}/>
        <ellipse cx="456" cy="150" rx="150" ry="220" fill={`url(#${mist})`} opacity=".6"/>
        <g opacity=".3" stroke={stone}><path d="M0 241 600 181M0 249 600 189" strokeWidth="3"/>
            {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${i * 47} ${249 - i * 4.7}V520M${i * 47} ${282 - i * 4.7}Q${i * 47 + 23} ${245 - i * 4.7} ${i * 47 + 47} ${278 - i * 4.7}`} strokeWidth="3"/>)}</g>
        <path d="M-20-30 153-20 214 72 236 175 228 286 255 431 216 630H-20Z" fill={`url(#${cliff})`}/>
        <path d="M0 15 18 590M35-8 49 590M76-10 86 590M114-10 126 590M151 15 166 590M192 94 204 590" stroke="#9da18d" strokeWidth="1" strokeOpacity=".22"/>
        <g opacity=".68">{[0, 1, 2, 3].map(row => <g key={row} transform={`translate(${row * 6} ${row * 105 - 15})`}>
            {[0, 1, 2].map(col => <g key={col}>
                <path d={`M${col * 65 + 18} 98V55Q${col * 65 + 18} 39 ${col * 65 + 38} 23Q${col * 65 + 58} 39 ${col * 65 + 58} 55V98Z`} fill="#cdbd8d" opacity=".3"/>
                <Arch x={col * 65 + 18} y={23} width={40} height={75} color="#a7a48a"/>
                <path d={`M${col * 65 + 38} 39V98M${col * 65 + 20} 67H${col * 65 + 57}M${col * 65 + 20} 82H${col * 65 + 57}`} stroke="#393d32" strokeWidth="1.2"/>
            </g>)}<path d="M0 103H212M0 109H212" stroke="#a8a48c" strokeWidth="3"/><path d="M0 96H212" stroke="#b6a274"/>
        </g>)}</g>
        <g fill="#496d50">{Array.from({ length: 24 }, (_, i) => <ellipse key={i} cx={190 + Math.sin(i * 1.4) * 15} cy={66 + i * 16} rx={7} ry={3} transform={`rotate(${-22 + i % 4 * 17} ${190 + Math.sin(i * 1.4) * 15} ${66 + i * 16})`}/>)}</g>
        <g filter={`url(#${blur})`}><ellipse cx="345" cy="493" rx="330" ry="80" fill={`url(#${mist})`}/><ellipse cx="490" cy="405" rx="204" ry="55" fill={`url(#${mist})`}/></g>

        {kind === 'network' && <>
            {beat === 2 && <g opacity=".8"><path d="M191 359V222Q335 44 491 219V359" stroke="#9b8458" strokeWidth="5"/><path d="M212 348V229Q336 76 468 228V348M251 310V208Q337 115 427 207V310" stroke="#bda776" strokeWidth="2"/><path d="M191 222 251 208M491 219 427 207" stroke="#bda776"/><path d="M195 222Q335 44 490 219L427 207Q337 115 251 208Z" fill="#d1ded2" opacity=".32"/></g>}
            <Glider x={heroX} y={heroY} scale={beat === 3 ? .8 : 1} bank={beat === 0 ? 19 : beat === 2 ? 0 : -14} seal={accent} layered={beat > 0}/>
            {beat > 0 && ['CONTACT', 'COMPANY', 'CONVERSATION'].map((word, i) => <g key={word} transform={`translate(${222 + i * 65} ${heroY + 12 - Math.abs(i - 1) * 8}) rotate(-9)`}><path d="M0 0H54V29H0Z" fill="#f0e7d2" stroke="#baa47b"/><text x="27" y="17" fill="#5a6257" textAnchor="middle" fontFamily="Arial" fontSize="4.3">{word}</text></g>)}
            {beat === 2 && <g><path d="M217 350H456" stroke="#a88958" strokeWidth="3"/><path d="M270 329H405V351H270Z" fill="#eee3c9" stroke="#b69a6b"/><text x="337" y="343" textAnchor="middle" fill="#5f604e" fontSize="7" fontFamily="Arial">DRAFT / FOR REVIEW</text></g>}
        </>}
        {kind === 'crystal' && <>
            <path d="M163 425Q285 354 352 270T563 174" stroke="#a89068" strokeWidth="1.3"/>
            {beat >= 2 && <><path d="M335 280Q430 281 521 222M335 280Q394 363 503 396" stroke="#a89068" strokeWidth=".9"/><Kite x={498} y={242} scale={.36} tint={accent}/><Kite x={472} y={382} scale={.28} tint={accent}/></>}
            <g transform={`rotate(${-12 + beat * 3} ${heroX} ${heroY})`}><Kite x={heroX} y={heroY - 15} scale={beat === 3 ? .65 : .9} tint={accent}/></g>
        </>}
        {kind === 'constellation' && <>
            <g opacity={beat === 0 ? .45 : .85}><Arch x={351} y={87} width={113} height={232} color="#b6b49a"/><Arch x={364} y={103} width={87} height={216} color={accent}/>
                <path d="M351 319V600M464 319V600" stroke={stone} strokeWidth="14"/><path d="M357 218H458" stroke="#b6a17b" strokeWidth="3"/><text x="407" y="237" textAnchor="middle" fill="#e9ddbd" fontSize="10" fontFamily="Georgia">YOUR PORTAL</text>
                {[0, 1, 2].map(i => <g key={i}><Arch x={242 + i * 112} y={307 + i % 2 * 44} width={55} height={99} color="#adab91"/><path d={`M${245 + i * 112} ${406 + i % 2 * 44}V600M${293 + i * 112} ${406 + i % 2 * 44}V600`} stroke={stone} strokeWidth="8"/></g>)}
                <path d="M185 412Q324 472 480 388M243 407Q341 355 404 319" stroke="#bcaa80" strokeWidth="2"/></g>
            <g transform={`translate(${heroX} ${heroY + 35}) rotate(-9)`}><path d="M-35 21Q0 52 44 8L16-4-23 4Z" fill="#705d40" stroke="#c1a774" strokeWidth="2"/><path d="M-16 7 0-39 18 4" stroke="#9c865b" strokeWidth="1.5"/></g>
            <Glider x={heroX} y={heroY - 6} scale={.75} bank={-9} seal={accent}/>
        </>}
        {kind === 'modules' && <>
            <g opacity=".85">{[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${i * 29} ${i * -16}) scale(${1 - i * .09})`}><path d="M169 520V289Q329 72 523 285V520" stroke="#a49369" strokeWidth="3"/><path d="M169 290Q329 72 523 285L501 281Q336 111 193 290Z" fill="#d8ead8" opacity=".18"/><path d="M169 454 523 454" stroke="#7a7e5b" strokeWidth="3"/></g>)}
                <path d="M180 484H531M191 417H519" stroke="#c1ac79" strokeWidth="2"/>{[0, 1, 2, 3, 4].map(i => <g key={i} fill="#577a50"><ellipse cx={211 + i * 65} cy="454" rx="15" ry="8"/><ellipse cx={215 + i * 65} cy="442" rx="9" ry="15"/></g>)}</g>
            <Glider x={heroX} y={heroY - 42} scale={.86} bank={beat === 3 ? 0 : -7} seal={accent} freight/>
            {beat === 3 && <path d="M276 331H408L426 349H291ZM291 349V374M426 349V374" stroke="#968461" strokeWidth="2" fill="#aaa98d"/>}
        </>}
        {kind === 'pages' && <>
            <path d="M289 133C501 165 461 268 299 309S174 426 423 479" stroke="#957a52" strokeWidth="58"/><path d="M289 133C501 165 461 268 299 309S174 426 423 479" stroke={`url(#${paper})`} strokeWidth="53"/><path d="M289 111C521 147 482 290 305 334S209 421 423 454M289 155C473 186 440 247 290 283S135 432 423 504" stroke="#bda77a" strokeWidth="1.5"/>
            {[[318, 141, 23], [412, 204, 75], [380, 273, -31], [281, 319, -19], [230, 388, 35], [345, 464, 15]].map(([x, y, r], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} opacity={i <= beat + 2 ? 1 : .3}><path d="M-24-17H24V17H-24Z" fill={i % 2 ? '#dad7c0' : accent} fillOpacity=".55"/>{i % 2 ? <path d="M-18-8H17M-18-2H11M-18 5H18M-18 11H8" stroke="#7f7c63"/> : <path d="M-23 12-6-9 4 2 13-7 24 12Z" fill="#77836a"/>}</g>)}
            <path d="M253 95 311 102 318 155 263 148Z" fill="#f0e5c9" stroke="#bda77a"/><path d="M261 111 301 116M263 120 304 125M264 130 293 134" stroke="#9c987e"/>
        </>}
        {kind === 'wave' && <>
            {[0, 1, 2].map(i => <g key={i} transform={`translate(${256 + i * 100} ${82 + i * 11}) scale(${1 - i * .12})`}><path d="M0 0V331M0 0 76-32M0 331 99 358" stroke="#9b8657" strokeWidth="3"/><path d="M0 0Q164 133 0 331Q71 166 0 0Z" fill={`url(#${paper})`} stroke="#bca06c" strokeWidth="1.5"/><path d="M0 0Q51 161 0 331M0 0Q101 162 0 331" stroke="#ae9361" strokeWidth="1"/>{beat > 0 && <path d="M16 87Q52 112 21 140T20 207" stroke={accent} strokeWidth="1.5"/>}</g>)}
            <path d="M189 401Q296 350 329 280T478 186" stroke="#b69b66" strokeWidth="1.5"/>
            <g transform={`translate(${heroX + 3} ${heroY + 12}) rotate(${beat === 2 ? -17 : 12})`}><path d="M-103 0Q0-46 103 0Q0 46-103 0Z" fill="#9c7e45" stroke="#c4a367" strokeWidth="2"/><path d="M-95 0Q0-27 95 0Q0 27-95 0Z" fill="#f0e3ba"/><path d="M-90 0-72-4-56 12-39-17-22 21-5-25 12 20 29-15 46 13 63-7 89 0" stroke="#b7914d" strokeWidth="2"/><ellipse cx="0" cy="0" rx="6" ry="7" fill={accent} stroke="#c3a361"/></g>
        </>}
        {kind === 'shield' && <>
            <g opacity={beat >= 2 ? .8 : .4}><Arch x={243} y={139} width={232} height={261} color="#aaa88e"/><Arch x={269} y={158} width={180} height={242} color="#b4a782"/><path d="M243 400V600M475 400V600" stroke={stone} strokeWidth="14"/><path d="M243 249Q359 78 475 249L449 258Q359 115 269 258Z" fill="#d0d4c5" opacity=".25"/></g>
            <g transform={`translate(${heroX} ${heroY - 15}) rotate(${beat === 0 ? 9 : -4})`}><path d="M0-83Q-68-90-86-54L-73 50 0 79 73 50 86-54Q68-90 0-83Z" fill="#713e43" stroke="#b89b6b" strokeWidth="3"/><path d="M-5-74Q-57-80-73-50L-61 42-5 65ZM5-74Q57-80 73-50L61 42 5 65Z" fill="#eadfc4" stroke="#aa9166"/><path d="M0-80V74" stroke="#e1c58b" strokeWidth="5"/><path d="M-71-65Q0-134 71-65Q0-95-71-65Z" fill="#e7dbbc" stroke="#b89b6b" strokeWidth="1.7"/><path d="M-52-31H-15M15-31H52M-48-18H-15M15-18H48M-44-5H-15M15-5H44" stroke="#9a937a" strokeWidth="1.2"/>
                {beat > 0 && [-1, 0, 1].map((side, i) => <g key={side}><path d={`M0 40Q${side * 25} 83 ${side * 55} 96`} stroke="#b59b67" strokeWidth="1.2"/><path d={`M${side * 55 - 22} 95H${side * 55 + 22}V117H${side * 55 - 22}Z`} fill="#e5dcc4" stroke="#b59b67"/><text x={side * 55} y="108" textAnchor="middle" fill="#6e6a59" fontFamily="Arial" fontSize="4.1">{['RESEARCH', 'DRAFTING', 'GOVERNANCE'][i]}</text></g>)}
                {beat === 2 && <text x="0" y="33" textAnchor="middle" fill="#5f6053" fontFamily="Arial" fontSize="6">FOR REVIEW</text>}
            </g>
        </>}
        <ellipse cx="340" cy="552" rx="350" ry="78" fill={`url(#${mist})`} opacity=".85"/>
        <path d="M0 0H600V600H0Z" fill={`url(#${gradient})`} opacity=".12"/>
    </g>;
}
