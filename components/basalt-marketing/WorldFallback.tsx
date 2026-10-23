import type { SceneKind } from './products';
import FlightFallback from './SceneFallback';

const colors: Record<SceneKind, string> = { network:'#65cabe', crystal:'#b5a0dc', constellation:'#7bb7d5', modules:'#63c6b4', pages:'#bda7d3', wave:'#dfb85b', shield:'#ca7279' };
const labels: Record<SceneKind, string[]> = {
 network:['The letter launches','Context creates lift','A considered response','The conversation rises'],
 crystal:['One original voice','Focus the message','Compose for each audience','Direct the operation'],
 constellation:['A useful starting point','Open the threshold','Connect the districts','A shared horizon'],
 modules:['Identify the resource','Coordinate the route','Shape the workflow','Deliver with context'],
 pages:['Open the story','Compose the page','Review every format','Prepare to publish'],
 wave:['A first request','Give the voice context','An answer returns','A shared conversation'],
 shield:['Retrieve the original','Follow every contribution','Bring the matter into review','Preserve the reasoning'],
};
function Arch({x,y,w=90,h=170}:{x:number;y:number;w?:number;h?:number}){
 return <path d={`M${x} ${y+h}V${y+h*.4}Q${x} ${y+h*.13} ${x+w/2} ${y}Q${x+w} ${y+h*.13} ${x+w} ${y+h*.4}V${y+h}`} fill="none" stroke="#887657" strokeWidth="7"/>;
}
function Page({x,y,w=65,h=90,tint,turn=0}:{x:number;y:number;w?:number;h?:number;tint:string;turn?:number}){
 return <g transform={`translate(${x} ${y}) rotate(${turn})`}><path d={`M0 0H${w}V${h}H0Z`} fill="#dcd0b6" stroke="#9b855e" strokeWidth="2"/><path d={`M9 13H${w-9}V${h*.34}H9Z`} fill={tint} opacity=".7"/><path d={`M9 ${h*.48}H${w-9}M9 ${h*.59}H${w-15}M9 ${h*.7}H${w-11}M9 ${h*.81}H${w*.7}`} stroke="#7b7565" strokeWidth="2"/></g>;
}
export default function WorldFallback({kind,chapter,gradient}:{kind:SceneKind;chapter:number;gradient:string}){
 if(kind==='network')return <FlightFallback kind={kind} chapter={chapter} gradient={gradient}/>;
 const beat=Math.max(0,Math.min(3,chapter)),c=colors[kind],glow=`${gradient}-room`,metal=`${gradient}-metal`,open=beat/3;
 return <g strokeLinejoin="round" strokeLinecap="round">
  <title>{labels[kind][beat]}</title>
  <defs><radialGradient id={glow} cx=".67" cy=".32" r=".8"><stop stopColor={c} stopOpacity=".22"/><stop offset="1" stopColor="#111712"/></radialGradient><linearGradient id={metal} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7b382"/><stop offset=".5" stopColor="#65563c"/><stop offset="1" stopColor="#c7ac75"/></linearGradient></defs>
  <path d="M0 0H600V600H0Z" fill={`url(#${glow})`}/>
  <path d="M0 480 300 358 600 455V600H0Z" fill="#191e18"/>
  {kind==='crystal'&&<>
   <circle cx="343" cy="206" r="150" fill="#282333" stroke="#887657" strokeWidth="4"/>
   {[0,1,2,3,4].map(i=><path key={i} d={`M${206+i*64} 351V${120-Math.sin(i*.8)*30}`} stroke="#54495c" strokeWidth="2"/>)}
   <path d="M306 329 286 487H389L370 329" fill={`url(#${metal})`}/>
   <circle cx="338" cy="285" r="96" fill="#282435" stroke="#b49b68" strokeWidth="15"/>
   {[0,1,2,3,4,5].map(i=><path key={i} transform={`rotate(${i*60+beat*8} 338 285)`} d={`M338 ${194+beat*6} 408 246 361 292 320 267Z`} fill={i%2?c:'#53485c'} stroke="#b49b68" strokeWidth="1"/>)}
   <circle cx="338" cy="285" r={17+beat*8} fill="#e1cfaa" opacity=".7"/>
   {beat>0&&<Page x={115} y={320} tint={c} turn={-7}/>}
   {beat>1&&<><Page x={429} y={300} w={57} h={106} tint={c}/><Page x={438} y={429} w={73} h={73} tint={c}/><Page x={267} y={496} w={113} h={56} tint={c}/></>}
  </>}
  {kind==='constellation'&&<>
   <Arch x={110} y={62} w={380} h={439}/><Arch x={143} y={91} w={314} h={410}/>
   <path d="M299 331 219 600H422L336 331Z" fill="#6b6853"/>
   {[0,1,2,3,4,5,6].map(i=>{const x=175+(i%3)*91,y=238+Math.floor(i/3)*72;return <g key={i}><path d={`M${x} ${y}h60v57h-60Z`} fill={i%2?'#4f635c':'#656653'} stroke="#a8956c"/><path d={`M${x-5} ${y}l35-28 35 28Z`} fill={i%2?c:'#98835e'}/><path d={`M${x+25} ${y+20}h12v37h-12Z`} fill="#dbbb77"/></g>})}
   <path d={`M144 164  ${288-open*125} ${195-open*25}V505L144 500Z`} fill="#283a39" stroke="#ae9665" strokeWidth="4"/>
   <path d={`M458 164 ${314+open*125} ${195-open*25}V505L458 500Z`} fill="#283a39" stroke="#ae9665" strokeWidth="4"/>
   {beat>1&&<path d="M211 355 297 399 395 355M246 455 304 399 388 462" fill="none" stroke={c} strokeWidth="3"/>}
  </>}
  {kind==='modules'&&<>
   <Arch x={65} y={62} w={460} h={430}/><path d="M65 230H525M80 173H511" stroke="#5e745e" strokeWidth="2"/>
   <path d="M103 112V227H222V370H504" fill="none" stroke="#62573f" strokeWidth="27"/><path d="M103 112V227H222V370H504" fill="none" stroke={c} strokeWidth="15" opacity=".7"/>
   <circle cx="208" cy="346" r="102" fill="#242d25" stroke="#ad9563" strokeWidth="12"/>
   {[0,1,2,3,4,5,6,7].map(i=><path key={i} transform={`rotate(${i*45+beat*23} 208 346)`} d="M208 251V441M201 250H227V268" stroke="#a98d58" strokeWidth="5"/>)}
   <path d="M103 494 482 417 505 437 120 520Z" fill="#655b43" stroke="#bca478" strokeWidth="4"/>
   {Array.from({length:14},(_,i)=><path key={i} d={`M${121+i*26} ${491-i*5.3}l16 20`} stroke="#212f29" strokeWidth="6"/>)}
   <g transform={`translate(${124+beat*91} ${429-beat*18})`}><path d="M0 0 55-10 73 6 73 53 18 64 0 49Z" fill="#d6c9a7" stroke="#9b8051" strokeWidth="2"/><path d="M0 0 18 16 73 6M18 16V64" stroke="#9b8051"/><path d="M30 26 60 21V39L30 45Z" fill={c}/></g>
  </>}
  {kind==='pages'&&<>
   <Arch x={68} y={47} w={470} h={430}/><path d="M80 210H530M133 120V438M475 120V438" stroke="#5f705b" strokeWidth="2"/>
   <path d="M60 377 290 322 546 363 547 478 306 523 61 470Z" fill="#4b3c55" stroke="#a78b5b" strokeWidth="5"/>
   <path d="M79 372Q190 331 301 354Q413 314 528 362V457Q411 410 302 491Q193 430 79 453Z" fill="#e1d4b6" stroke="#a39270" strokeWidth="3"/>
   <path d="M301 354V491" stroke="#807058" strokeWidth="3"/>
   {beat===0?<path d="M79 372 302 354 492 306 274 305Z" fill="#776180" stroke="#ae9767" strokeWidth="4"/>:<g transform={`translate(363 435) scale(1 ${beat===1?.7:1})`}>
    <path d="M0 0 91-29V-125L43-164 0-128Z" fill="#ded3ba" stroke="#a59b87" strokeWidth="2"/>
    <path d="M0 0-66-24V-118L-25-160 0-128Z" fill="#f1e7ce" stroke="#a59b87" strokeWidth="2"/>
    <path d="M-71-117-25-166 43-173 99-125 0-111Z" fill={c} stroke="#8b7998" strokeWidth="3"/>
    <path d="M-25-166 0-111M43-173 60-139" stroke="#e1d2ea" strokeWidth="2"/>
    <path d="M-49-19V-67Q-34-95-19-67V-8Z" fill="#777865"/>
    <path d="M20-36V-84Q31-105 42-88V-43Z M59-48V-97Q70-118 81-101V-55Z" fill="#7d8a78"/>
    <path d="M-55-15-10-3-20 10-64-4Z" fill="#f1e7ce" stroke="#a59b87"/>
    <path d="M110-3V-94M-94-11V-91" stroke="#7b8966" strokeWidth="3"/>
    <path d="M110-61 86-84 110-75 131-96 110-50 135-63 110-31 89-48Z M-94-61-115-81-94-71-76-92-94-42-115-59-94-28-76-42Z" fill="#73866b" stroke="#acbc91"/>
   </g>}
   {beat>1&&<><Page x={118} y={344} w={43} h={56} tint={c} turn={-9}/><Page x={170} y={336} w={33} h={61} tint={c} turn={-9}/><Page x={213} y={332} w={25} h={62} tint={c} turn={-9}/></>}
  </>}
  {kind==='wave'&&<>
   <Arch x={83} y={43} w={438} h={423}/>
   <ellipse cx="318" cy="427" rx="244" ry="103" fill="#625138" stroke="#bea168" strokeWidth="9"/>
   <ellipse cx="318" cy="411" rx="220" ry="86" fill="#1c5557"/>
   {[0,1,2,3].map(i=><ellipse key={i} cx={beat<2?219+beat*35:388-(beat-2)*36} cy="408" rx={30+i*(17+beat*3)} ry={10+i*(6+beat)} fill="none" stroke={c} strokeWidth={2-i*.3} opacity={.8-i*.16}/>)}
   {[0,1,2,3,4,5,6].map(i=><g key={i}><path d={`M${179+i*43} 358V${188-Math.sin(i*.6)*95}`} stroke="#b69a66" strokeWidth="15"/><path d={`M${176+i*43} 350V${195-Math.sin(i*.6)*95}`} stroke="#5c5643" strokeWidth="4"/></g>)}
   <path d="M147 363H489" stroke="#806849" strokeWidth="16"/>
   {beat===3&&<><ellipse cx="318" cy="445" rx="263" ry="118" fill="none" stroke="#a08a63" strokeWidth="9"/><path d="M81 476 70 514M550 476 562 514" stroke="#a08a63" strokeWidth="8"/></>}
  </>}
  {kind==='shield'&&<>
   <Arch x={75} y={35} w={470} h={470}/>
   <path d="M159 432 204 203H233L216 447M449 432 403 203H374L391 447" fill="#554b40" stroke="#a58b5e" strokeWidth="5"/>
   <circle cx="307" cy="259" r="174" fill="#30262c" stroke="#b19768" strokeWidth="12"/>
   <circle cx="307" cy="259" r="155" fill="#53363e" stroke="#88704c" strokeWidth="3"/>
   <g transform={`rotate(${-beat*120} 307 259)`}>
    {[0,1,2].map(i=><g key={i} transform={`rotate(${i*120} 307 259)`}><path d="M302 259V107H312V259Z" fill="#9b8158"/><rect x="272" y="112" width="70" height="96" rx="4" fill="#6d3542" stroke="#c3a67b" strokeWidth="3"/><path d="M282 127H332M282 142H326M282 157H332" stroke="#ddc59a" strokeWidth="2"/><circle cx="307" cy="183" r="8" fill={c}/></g>)}
   </g>
   <circle cx="307" cy="259" r="40" fill="#262228" stroke="#b89a65" strokeWidth="8"/>
   <path d="M263 349 239 485H392L351 349Z" fill="#4c443b" stroke="#aa8e61" strokeWidth="5"/>
   <path d="M274 365 260 478M337 365 366 478" stroke="#c2a370" strokeWidth="7"/>
   {beat<2?<g><Page x={272} y={beat===0?323:352} w={73} h={99} tint={c}/><path d={`M272 ${beat===0?323:352}l-48 15v99l48-15Z`} fill="#783f4b" stroke="#c5a67b" strokeWidth="3"/></g>:<g><Page x={271} y={357} w={92} h={124} tint={c}/><path d="M271 357 197 375V499L271 481Z" fill="#6a3542" stroke="#c5a67b" strokeWidth="4"/><path d="M208 393 257 381M208 410 257 398M208 427 248 416" stroke="#d4bc95" strokeWidth="2"/></g>}
   {beat===3&&[-1,1].map(side=><g key={side} transform={`translate(${307+side*132} 259)`}><path d="M-21-158H21V164H-21Z" fill="#66343f" stroke="#b69a69" strokeWidth="4"/><path d="M-17-140 17-102-17-64 17-26-17 12 17 50-17 88 17 126" fill="none" stroke="#c4a574" strokeWidth="3"/></g>)}
  </>}
  <path d="M0 574H600" stroke="#aa9463" strokeOpacity=".2"/>
 </g>;
}
