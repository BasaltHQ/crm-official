/* Two landscapes, authored as conservative distance fields. Progress changes
 * the geography and the flow; time only moves small details on water surfaces. */
export const elementalOperations={
    modules:{
        mistColor:'#c0e2dc',
        stages:['Find the source','Join the currents','Release the pressure','Let the work flow'],
        captions:[
            'Every operation begins with a source.',
            'The next step changes what can move through the whole system.',
            'Connected work becomes a current.',
            'Give the business room to move.',
        ],
        shots:[
            {p:0,eye:[5.1,7.8,-16.7],look:[-.3,4.95,-21],fov:47},
            {p:.25,eye:[7.5,8.8,-8.5],look:[0,3.4,-5],fov:48},
            {p:.5,eye:[-7.8,7.5,4.5],look:[0,2.2,-1.5],fov:50},
            {p:.75,eye:[4.8,.8,10.8],look:[0,-.1,3.7],fov:52},
            {p:1,eye:[13.5,7,18],look:[0,-.8,0],fov:50},
        ],
        glsl:`
float worksBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float worksCentre(float z){return sin(z*.13)*1.32+sin(z*.37)*.43;}
float worksWidth(float z){return 3.05+1.45*smoothstep(-1.,3.6,z)+sin(z*.43)*.34;}
float worksPool(vec3 p,float start,float finish,float level,float fill){
    float end=mix(start+.02,finish,fill);
    float wetWidth=worksWidth(p.z)-.18;
    float d=max(abs(p.y-level)-.028,abs(p.x-worksCentre(p.z))-wetWidth);
    return max(d,max(start-p.z,p.z-end));
}
float worksFall(vec3 p,float z,float top,float bottom,float fill,float width){
    float low=mix(top-.012,bottom,fill);
    vec3 q=p-vec3(worksCentre(z),(top+low)*.5,z);
    // The broad sheet accelerates outward slightly as it leaves the lip.
    q.z-=pow(clamp((top-p.y)/max(top-bottom,.01),0.,1.),2.)*.24;
    return worksBox(q,vec3(width,max(.006,(top-low)*.5),.05));
}
vec2 mapScene(vec3 p){
    // Every cliff lip bends across the valley. Rock displacement breaks the
    // long planes while the same warp keeps pools and falling sheets joined.
    vec3 flow=p;flow.z-=sin(p.x*.34)*1.2+sin(p.x*.77)*.55;
    float erosion=(noise3(p*.29)-.5)*1.18+(noise3(p*1.13)-.5)*.21;
    vec3 q=flow;q.y+=erosion;
    float land=min(worksBox(q-vec3(0.,-1.8,-18.),vec3(30.,7.2,12.)),
               min(worksBox(q-vec3(0.,-2.8,-3.4),vec3(28.,6.4,2.6)),
                   worksBox(q-vec3(0.,-3.7,1.4),vec3(26.,5.5,2.3))));
    float bed=4.7-1.8*smoothstep(-6.4,-5.9,flow.z)-1.8*smoothstep(-1.2,-.7,flow.z);
    float channel=max(abs(p.x-worksCentre(flow.z))-worksWidth(flow.z)+erosion*.38,bed-p.y+erosion*.16);
    land=max(land,-channel);
    float floorField=p.y+5.6+(noise3(p*.075)-.5)*.2;
    land=min(land,floorField)*.22;
    vec2 result=vec2(land,0.);
    float a=.58+.42*phase(.015,.36),b=phase(.29,.61),c=phase(.51,.8);
    float upper=mix(4.76,5.23,a),middle=mix(2.96,3.43,b),lower=mix(1.16,1.63,c);
    // The surface stays seated in each basin as its level rises. It never ends
    // in a floating vertical cut halfway across the river bed.
    float water=worksPool(flow,-31.,-5.94,upper,1.);
    water=min(water,worksPool(flow,-5.95,-.74,middle,1.));
    water=min(water,worksPool(flow,-.75,3.76,lower,1.));
    // Each spill exists only once its upstream pool has reached the lip.
    if(uProgress>.325)water=min(water,worksFall(flow,-5.94,upper,middle,phase(.325,.48),2.83));
    if(uProgress>.575)water=min(water,worksFall(flow,-.74,middle,lower,phase(.575,.71),2.95));
    if(uProgress>.735)water=min(water,worksFall(flow,3.76,lower,-5.16,phase(.735,.94),4.18));
    float flood=phase(.78,1.);
    if(flood>.001){
        float pool=max(abs(p.y+5.16)-.024,length((p.xz-vec2(.55,6.7))*vec2(.68,.56))-1.-flood*6.5);
        pool=max(pool,3.82-flow.z);water=min(water,pool);
    }
    if(water*.4<result.x)result=vec2(water*.4,3.);
    return result;
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal){
    if(materialID>2.5){
        float fall=1.-smoothstep(.12,.55,abs(normal.y));
        float streak=noise3(vec3(p.x*3.4,p.y*.7+uTime*.25,p.z*.7));
        float ripple=sin(p.z*6.+p.x*2.2-uTime*.65)*.5+.5;
        vec3 deep=mix(vec3(.025,.14,.16),uAccent*.56,.55);
        vec3 foam=vec3(.65,.91,.88);
        return mix(deep,foam,clamp(fall*(.25+pow(streak,3.)*.72)+ripple*.06,0.,.88));
    }
    float grain=noise3(p*1.8);
    float strata=smoothstep(.88,1.,sin(p.y*6.+noise3(p*.24)*1.7)*.5+.5);
    float wet=1.-smoothstep(worksWidth(p.z)-.2,worksWidth(p.z)+.7,abs(p.x-worksCentre(p.z)));
    vec3 rock=mix(vec3(.035,.055,.06),vec3(.13,.18,.17),grain*.6+strata*.16);
    rock=mix(rock,vec3(.022,.072,.073),wet*.5);
    float moss=smoothstep(.66,.91,normal.y)*smoothstep(.55,.8,noise3(p*.31))*phase(.67,.98);
    return mix(rock,vec3(.15,.24,.13),moss*.55);
}
float sceneDensity(vec3 p){
    float spray=exp(-dot((p-vec3(.5,-3.3,5.2))*vec3(.2,.38,.3),(p-vec3(.5,-3.3,5.2))*vec3(.2,.38,.3)));
    return spray*phase(.74,.98)*.055*(.65+.35*noise3(p*.32));
}
`,
    },
    constellation:{
        mistColor:'#bacdd9',
        stages:['Above the cloudline','The landscape opens','A passage emerges','A larger horizon'],
        captions:[
            'There is more beyond the work in front of you.',
            'Clear a path between the possibilities.',
            'Different strengths. Common ground.',
            'One ecosystem. A much larger horizon.',
        ],
        shots:[
            {p:0,eye:[4,10.5,16],look:[0,1.4,-12],fov:48},
            {p:.25,eye:[11,12.6,7],look:[0,.9,-11.5],fov:49},
            {p:.5,eye:[7,10,-2],look:[0,1,-12],fov:51},
            {p:.75,eye:[-3.3,4.8,-5.3],look:[0,1.4,-12.5],fov:50},
            {p:1,eye:[13,14.5,9],look:[0,.3,-12],fov:51},
        ],
        glsl:`
float calderaArch(vec3 p,float erosion){
    // A broad, irregular rock wall eroded into a bridge. The lower half is
    // buried in the caldera floor; there is no closed circular ring.
    vec3 q=p-vec3(.25,.45,-12.);
    q.x+=.33*sin(p.y*.61);q.z+=.28*sin(p.x*.49);
    vec3 stretch=q/vec3(6.4,5.3,1.85);
    float mass=(length(stretch)-1.)*1.85+erosion*.72;
    vec2 opening=vec2((q.x+.45+.23*sin(q.y*.83))/3.6,(q.y+.8)/3.65);
    float aperture=(length(opening)-1.)*3.6+erosion*.31;
    return max(max(mass,-aperture),-p.y-3.4)*.22;
}
float calderaFracture(vec3 p){return p.x-.7*sin(p.z*.22)-.32*sin(p.z*.53);}
vec2 mapScene(vec3 p){
    float n=(noise3(p*.31)-.5)*1.25+(noise3(p*1.08)-.5)*.25;
    float radial=length(p.xz-vec2(0.,-12.));
    float angle=atan(p.z+12.,p.x);
    float reveal=phase(.12,.79);
    float drift=sin(angle*3.)*1.2+sin(angle*7.+.8)*.65;
    float crest=5.4+sin(angle*3.+.5)*1.35+sin(angle*9.)*.5;
    float outer=radial-(18.-(p.y+3.)*.61+drift);
    float inner=radial-(6.4+(p.y+3.)*.77+drift*.45);
    float rim=max(max(outer,-inner),p.y-crest)+n*.74;
    float plain=p.y+3.8-(noise3(vec3(p.x*.06,0.,p.z*.06))-.5)*1.1;
    // The caldera settles as the fog parts, exposing the foot of the arch.
    float basin=p.y-mix(-.8,-3.75,reveal);
    basin=max(basin,radial-9.2);
    float land=min(rim,min(plain,basin))*.18;
    float crackWidth=.15+phase(.3,.78)*.68;
    float cut=max(abs(calderaFracture(p))-crackWidth,-p.y-8.);
    land=max(land,-cut*.18);
    float arch=calderaArch(p,n);
    vec2 result=arch<land?vec2(arch,1.):vec2(land,0.);
    if(land<arch&&abs(calderaFracture(p))<crackWidth+.1&&p.y< -2.7)result.y=2.;
    // Deep heat belongs to the fissure floor; the arch itself is mineral stone.
    float ember=max(abs(p.y+7.82)-.035,abs(calderaFracture(p))-crackWidth*.9);
    ember=max(ember,abs(p.z+11.)-27.);
    if(ember*.45<result.x)result=vec2(ember*.45,2.);
    return result;
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal){
    if(materialID>1.5&&materialID<2.5){
        float crust=noise3(p*2.8);
        return mix(vec3(.36,.075,.018),vec3(1.,.37,.065),smoothstep(.36,.73,crust))*(.6+.5*phase(.22,.8));
    }
    float mineral=noise3(p*.68);
    float strata=smoothstep(.86,.99,sin(p.y*5.5+mineral*1.2)*.5+.5);
    vec3 rock=mix(vec3(.026,.041,.059),vec3(.105,.14,.17),mineral*.7+strata*.12);
    if(materialID>.5){
        float exposed=smoothstep(-1.,4.,p.y)*phase(.18,.85);
        rock=mix(rock,mix(vec3(.13,.22,.27),uAccent*.36,.35),exposed*.66);
        float vein=smoothstep(.87,.96,sin(p.y*4.3+noise3(p*.41)*3.2)*.5+.5);
        rock+=vec3(.095,.13,.14)*vein*.22;
    }
    return rock;
}
float sceneDensity(vec3 p){
    float r=length(p.xz-vec2(0.,-12.)),opening=phase(.08,.9);
    float cloudHeight=1.65+(noise3(p*.095)-.5)*1.4;
    float layer=exp(-pow((p.y-cloudHeight)*.48,2.));
    float cleared=mix(1.,smoothstep(3.+opening*18.,8.+opening*18.,r),opening);
    float cloud=layer*cleared*(.55+.45*noise3(p*.22))*.073;
    float heat=exp(-pow(calderaFracture(p)*1.8,2.))*exp(-pow((p.y+2.)*.5,2.))*phase(.3,.8)*.006;
    return cloud+heat;
}
`,
    },
};
