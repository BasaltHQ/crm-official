/* Wind-carved sand and iron-bearing strata. These are continuous landscapes:
 * scroll changes the natural force, its terrain, and the camera's passage. */
export const elementalIntelligence = {
    wave: {
        mistColor: '#b48a4f',
        glsl: `
float echoChannel(vec2 q) {
    return 1.65*sin(q.y*.135)+.55*sin(q.y*.31+.7);
}
float echoHeight(vec2 q) {
    float wind=phase(.035,.54);
    float opening=phase(.25,.91);
    float swept=smoothstep(mix(12.,-17.,wind)-3.,mix(12.,-17.,wind)+3.,q.y)*wind;
    float meander=echoChannel(q);
    float dunePhase=q.x*.57+sin(q.y*.16)*1.18+sin(q.y*.047+.6)*.82;
    dunePhase-=swept*.58;
    float dune=pow(clamp(.5+.5*sin(dunePhase),0.,1.),1.8);
    float second=.5+.5*sin(q.x*.27-q.y*.095+.5);
    float basinWidth=mix(1.65,3.35,opening);
    float channel=exp(-pow((q.x-meander)/basinWidth,2.));
    float h=.12+2.75*dune+.52*second+.24*sin(q.y*.21+q.x*.057);
    h=mix(h,-.78+.12*sin(q.y*.16),channel*(.2+.8*opening));
    float ripplePhase=q.y*22.+sin(q.x*.65)*2.1+sin(q.x*2.1)*.23-swept*1.5;
    h+=sin(ripplePhase)*.021*(1.-channel*.65);
    return h;
}
vec2 mapScene(vec3 p) {
    // The scale bounds both dune slipfaces and the newly cut valley wall.
    return vec2((p.y-echoHeight(p.xz))*.36,1.);
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal) {
    float opening=phase(.25,.91);
    float channel=exp(-pow((p.x-echoChannel(p.xz))/mix(1.65,3.35,opening),2.));
    float ripple=.5+.5*sin(p.z*22.+sin(p.x*.65)*2.1+sin(p.x*2.1)*.23);
    float mineral=fbm(p*vec3(.7,.25,.7));
    float grain=noise3(p*vec3(48.,32.,48.));
    vec3 sand=mix(vec3(.31,.155,.044),vec3(.72,.47,.185),.46+mineral*.42);
    sand=mix(sand,vec3(.39,.23,.095),channel*.27);
    sand*=.91+.11*ripple+.06*grain;
    sand=mix(sand,mix(vec3(.88,.62,.27),uAccent,.14),pow(max(normal.y,0.),7.)*.13);
    return sand;
}
float sceneDensity(vec3 p) {
    float altitude=p.y-echoHeight(p.xz);
    float nearSand=exp(-max(altitude,0.)*.7)*smoothstep(-.02,.15,altitude);
    float drifting=fbm(vec3(p.x*.13-uTime*.25,p.y*.65,p.z*.18));
    return .009*nearSand*smoothstep(.46,.72,drifting);
}
`,
        shots: [
            { p: 0, eye: [-5.8, 4.15, 9.2], look: [-3.8, 1.25, 2.3], fov: 43 },
            { p: .24, eye: [-2.5, 5.9, 8.6], look: [1.2, 1.15, -2.5], fov: 46 },
            { p: .49, eye: [1.3, 4.6, 5.4], look: [-1.4, -.15, -5.9], fov: 47 },
            { p: .75, eye: [-2.2, 5.1, .2], look: [-1.1, -.5, -10.7], fov: 48 },
            { p: 1, eye: [7.4, 10.4, 7.5], look: [-.5, .15, -6.3], fov: 48 },
        ],
        captions: [
            'A voice moves through the stillness.',
            'Wind gives the smallest signal a visible shape.',
            'A passage opens where the currents meet.',
            'What was noise becomes a clear way through.',
        ],
        stages: ['First breath', 'A shifting current', 'The resonant valley', 'A clear passage'],
    },
    shield: {
        glsl: `
float vigilFault(vec2 q) {
    return .95*sin(q.y*.17)+.38*sin(q.y*.43+.4);
}
float vigilBasin(vec2 q) {
    float erosion=noise3(vec3(q.x*.31,4.7,q.y*.31));
    float x=q.x-vigilFault(q)+(erosion-.5)*1.8;
    float width=2.1+1.1*exp(-pow((q.y+3.5)*.17,2.))+.38*sin(q.y*.58+.7);
    float channel=1.-smoothstep(width*.65,width+1.5,abs(x));
    float back=-10.7+sin(q.x*.61)*.68+(erosion-.5)*2.4;
    float headwall=1.-smoothstep(back-1.25,back+1.2,q.y);
    return channel*(1.-headwall);
}
float vigilHeight(vec2 q) {
    float rise=phase(.12,.82);
    float protection=phase(.44,.94);
    float basin=vigilBasin(q);
    float fold=sin(q.y*.3+sin(q.x*.11)*.7);
    float broad=noise3(vec3(q.x*.21,8.3,q.y*.21));
    float fine=noise3(vec3(q.x*.83,2.4,q.y*.83));
    float escarpment=mix(1.35,6.65,rise)+fold*.6+(broad-.5)*(1.4+rise*2.1);
    float gullies=abs(sin(q.y*1.21+q.x*.23+fine*.9));
    float shoulder=.45*sin(q.x*.34+q.y*.12)+.24*sin(q.y*.9+q.x*.2)+(fine-.5)*.78-gullies*.31;
    float h=mix(escarpment,-.9,basin*(.48+.52*protection));
    h+=shoulder*(1.-basin*.86);
    float fractures=sin(q.y*2.6+q.x*.7)*sin(q.y*.73-q.x*1.1);
    h+=fractures*.075*(1.-basin*.9);
    return h;
}
vec2 mapScene(vec3 p) {
    float rock=(p.y-vigilHeight(p.xz))*.19;
    float fracture=noise3(p*vec3(.62,.77,.62));
    float smallFracture=noise3(p*2.1+vec3(7.4,3.1,12.8));
    float veinWarp=(fracture-.5)*2.15+(smallFracture-.5)*.32;
    float layer=abs(sin(p.y*1.17+p.x*.31+p.z*.18+veinWarp));
    float branch=abs(sin(p.x*.81-p.z*.47+veinWarp*.78));
    float seam=phase(.36,.74);
    float broken=noise3(p*vec3(.37,.53,.44)+vec3(17.2,3.8,8.1));
    float fissure=min(layer,branch);
    bool vein=broken>.58&&p.y>.45&&seam>.1;
    if(vein){
        float cut=max(fissure*.18-.006,-rock-.018*seam);
        rock=max(rock,-cut);
    }
    float materialID=fissure<.026&&vein?2.:0.;
    // The shallow basin receives water only after its retaining strata rise.
    float calm=phase(.8,1.);
    vec2 q=vec2((p.x-vigilFault(p.xz))/3.8,(p.z+3.3)/6.8);
    float shore=(length(q)+(fracture-.5)*.12-mix(.001,1.,calm))*1.75;
    float water=max(p.y+.56,shore)*.7;
    if(calm>.001&&water<rock)return vec2(water,3.);
    return vec2(rock,materialID);
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal) {
    float folded=noise3(p*vec3(.61,.28,.57));
    float strata=.5+.5*sin(p.y*7.3+p.x*.52+folded*2.4);
    float iron=fbm(p*vec3(.53,1.1,.53));
    float grain=noise3(p*vec3(12.,22.,12.));
    vec3 basalt=mix(vec3(.033,.029,.031),vec3(.115,.077,.065),iron);
    basalt=mix(basalt,vec3(.19,.051,.035),pow(strata,9.)*.32);
    basalt*=.83+.22*grain;
    if(materialID>2.5)return mix(vec3(.045,.063,.065),vec3(.105,.068,.056),iron*.24);
    if(materialID>1.5)return mix(vec3(.075,.008,.004),uAccent*.06,.12)*phase(.36,.74);
    return basalt+vec3(.045,.03,.02)*max(normal.y,0.);
}
`,
        shots: [
            { p: 0, eye: [5.8, 5.3, 10.5], look: [.5, .45, -1.6], fov: 43 },
            { p: .25, eye: [6.5, 8.6, 5.4], look: [.1, 1.15, -3.4], fov: 45 },
            { p: .52, eye: [1.6, 7.8, 6.3], look: [-.3, .25, -5.6], fov: 46 },
            { p: .76, eye: [.15, 4.2, 5.6], look: [-.45, -.15, -5.4], fov: 47 },
            { p: 1, eye: [8.4, 13.1, 8.2], look: [-.2, .1, -4.5], fov: 47 },
        ],
        captions: [
            'Read the fault lines beneath the surface.',
            'The structure emerges, layer by layer.',
            'A strong boundary creates room for clarity.',
            'Inside the protected basin, the water settles.',
        ],
        stages: ['The fault line', 'Rising strata', 'A protected interior', 'A quiet basin'],
    },
};
