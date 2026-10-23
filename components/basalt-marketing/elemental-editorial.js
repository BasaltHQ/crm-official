/* Landscape-scale films. The fields are deliberately conservative: substantial
 * height changes use a reduced march distance, while all physical development
 * follows progress. No actors, constructed artifacts, or world-space lettering. */
export const elementalEditorial={
    network:{
        stages:['headwater','confluence','cascade','continuity'],
        captions:[
            'A first connection finds its opening.',
            'Separate currents begin to carry one another.',
            'Context becomes momentum.',
            'Every connection changes what can flow next.',
        ],
        shots:[
            {p:0,eye:[4.2,5.7,14.6],look:[1.9,2.6,8.2],fov:41},
            {p:.24,eye:[11.8,9.6,13.4],look:[1,1.5,5.2],fov:45},
            {p:.5,eye:[-11.5,8.2,8],look:[.3,.6,1],fov:44},
            {p:.76,eye:[9.6,7.6,-13.5],look:[-.8,-.5,-4.6],fov:46},
            {p:1,eye:[19.5,18,-26],look:[-.5,.1,-2],fov:43},
        ],
        glsl:`
float crmCourse(float z){return sin(z*.19)*1.8+sin(z*.43)*.34;}
float crmWaterLevel(float z){
    return -1.36+1.22*smoothstep(-3.2,-2.25,z)+1.2*smoothstep(2.9,3.8,z)+.88*smoothstep(7.2,8.15,z);
}
vec2 mapScene(vec3 p){
    float opened=phase(.035,.62),joined=phase(.22,.57),filled=phase(.64,.98);
    float n=noise3(vec3(p.x*.16,3.7,p.z*.16));
    float broad=noise3(vec3(p.x*.047,11.4,p.z*.047));
    float route=abs(p.x-crmCourse(p.z));
    float width=mix(.28,1.12,opened)+.32*(1.-smoothstep(-7.,5.,p.z));
    float channel=1.-smoothstep(width,width+1.25,route);
    float tributary=abs(p.x-crmCourse(p.z)-max(p.z-1.1,0.)*.54);
    float branch=(1.-smoothstep(.35,1.35,tributary))*smoothstep(.7,2.,p.z)*(1.-smoothstep(10.,12.,p.z))*joined;
    float basin=length((p.xz-vec2(-1.,-10.5))/vec2(1.15,1.));
    float bowl=(1.-smoothstep(3.2,6.2,basin))*filled;
    float waterY=crmWaterLevel(p.z);
    float strata=.19*sin(p.x*.56+p.z*.21)+.08*sin(p.z*1.4+p.x*.23);
    float land=1.1+3.2*smoothstep(-9.,11.,p.z)+(broad-.5)*3.2+(n-.5)*.7+strata;
    land=mix(land,waterY-.65,channel*mix(.07,1.,opened));
    land=mix(land,waterY-.58,branch);
    land=mix(land,-2.05+.1*n,bowl);
    float rock=(p.y-land)*.24;
    float wetEdge=(1.-smoothstep(width+.6,width+1.1,route))*opened;
    float mineral=wetEdge>.3&&p.y<waterY+.95?1.:0.;
    vec2 result=vec2(rock,mineral);
    float front=mix(8.8,-15.,phase(.08,.88));
    float river=max(max(p.y-waterY,route-width*.84),front-p.z)*.64;
    float branchFront=mix(10.8,1.,joined);
    float secondary=max(max(p.y-waterY,tributary-.3*joined),max(branchFront-p.z,p.z-10.8))*.64;
    float pool=max(p.y+1.35,basin-mix(.01,5.3,filled))*.65;
    float source=max(p.y-1.93,length(p.xz-vec2(crmCourse(8.8),8.8))-1.02)*.65;
    float water=min(source,min(river,min(secondary,pool)));
    if(water<result.x)result=vec2(water,3.);
    return result;
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal){
    float grain=noise3(p*2.5),band=.5+.5*sin(p.y*8.5+p.x*.24+p.z*.19);
    vec3 basalt=mix(vec3(.027,.037,.037),vec3(.12,.135,.124),grain*.6+max(normal.y,0.)*.24);
    basalt*=.83+.17*band;
    if(materialID>2.5){
        float depthTint=smoothstep(-7.,8.,p.z);
        return mix(vec3(.012,.11,.105),mix(vec3(.025,.3,.26),uAccent*.57,.45),depthTint)*(.88+.12*grain);
    }
    if(materialID>.5)return mix(basalt,vec3(.075,.29,.225),.38+.24*band);
    return basalt;
}
`,
    },
    crystal:{
        stages:['obsidian','pressure','spectrum','presence'],
        captions:[
            'An idea waits beneath the surface.',
            'Pressure gives it a direction.',
            'A clear voice reveals its full spectrum.',
            'One presence. Many ways to meet the light.',
        ],
        shots:[
            {p:0,eye:[10.3,7.8,12.8],look:[3.3,2.6,4.5],fov:40},
            {p:.26,eye:[-16.5,10.4,12.5],look:[-2.,2.7,1.5],fov:44},
            {p:.52,eye:[2.1,12.8,-15.4],look:[.2,2.8,-1.7],fov:42},
            {p:.78,eye:[18.4,9.4,-7.4],look:[2.1,3.3,0],fov:45},
            {p:1,eye:[23.8,18.5,25.4],look:[0,2.5,0],fov:43},
        ],
        glsl:`
float onyxStratum(vec3 p){return p.y+.5*sin(p.z*.19)+.28*sin(p.x*.27)+.18*sin(p.z*.57);}
vec2 mapScene(vec3 p){
    float rise=phase(.08,.62),part=phase(.28,.76),reveal=phase(.46,.9);
    float fine=noise3(vec3(p.x*.22,6.3,p.z*.22));
    float broad=noise3(vec3(p.x*.055,1.6,p.z*.055));
    float x=p.x+sin(p.z*.18)*2.4+sin(p.z*.41+.6)*.7+(broad-.5)*2.;
    float cleft=.55+part*1.65;
    float lengthMask=1.-smoothstep(10.5,17.,abs(p.z));
    float left=1.-smoothstep(.1,1.15,length(vec2((x+5.8)/7.6,p.z/14.)));
    float right=1.-smoothstep(.07,1.14,length(vec2((x-6.3)/8.2,(p.z-1.7)/15.)));
    float raised=left*(5.6+rise*2.25)+right*(7.3+rise*1.2);
    float cut=(1.-smoothstep(cleft,cleft+2.3,abs(x)))*lengthMask;
    float land=-2.6+raised*(1.-cut*.92)+(fine-.5)*.32+(broad-.5)*1.2;
    float d=(p.y-land)*.18;
    float strata=onyxStratum(p);
    float glassBand=1.-smoothstep(.035,.085,abs(sin(strata*1.47)));
    float hotBand=1.-smoothstep(.009,.03,abs(sin((strata-.24)*1.47)));
    float innerWall=(1.-smoothstep(cleft+.55,cleft+3.,abs(x)))*lengthMask;
    float material=glassBand>.35&&raised>.7&&p.y>-.7?1.:0.;
    if(hotBand>.3&&reveal>.08&&innerWall>.1&&strata>-.8)material=2.;
    return vec2(d,material);
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal){
    float reveal=phase(.46,.9),grain=noise3(p*3.1);
    float polished=.35+.65*pow(1.-abs(normal.y),2.);
    vec3 dark=mix(vec3(.023,.023,.034),vec3(.105,.075,.12),grain*.5+polished*.15);
    float strata=onyxStratum(p);
    vec3 spectrum=mix(vec3(.08,.045,.14),vec3(.22,.12,.19),smoothstep(-.5,5.,strata));
    spectrum=mix(spectrum,uAccent*.28,.33);
    if(materialID>2.5)return mix(dark,spectrum,.19+.23*reveal);
    if(materialID>1.5)return mix(dark,spectrum*(.12+reveal*.32),reveal);
    if(materialID>.5)return mix(dark,spectrum,.32+.36*reveal);
    return dark*(.8+.2*grain);
}
`,
    },
    pages:{
        stages:['grains','contours','growth','living-landscape'],
        captions:[
            'An idea begins as a thousand small possibilities.',
            'Give the possibilities a shape.',
            'Let the composition grow into its own rhythm.',
            'A living story makes room for what comes next.',
        ],
        shots:[
            {p:0,eye:[8.7,3.1,12.6],look:[3.2,-.9,6.1],fov:40},
            {p:.26,eye:[15.7,8.1,11.8],look:[1.7,.1,1.4],fov:44},
            {p:.52,eye:[-13.7,11.9,10.8],look:[0,2.1,0],fov:43},
            {p:.78,eye:[10.2,12.8,-14.4],look:[1.1,3.6,-.7],fov:43},
            {p:1,eye:[24.5,20.2,27.3],look:[0,2.6,0],fov:42},
        ],
        glsl:`
float cmsSeed(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
vec2 mapScene(vec3 p){
    float forming=phase(.055,.68),growth=phase(.37,.94);
    float broad=noise3(vec3(p.x*.09,4.1,p.z*.09));
    float fine=noise3(vec3(p.x*.37,8.9,p.z*.37));
    vec2 warped=p.xz+vec2(sin(p.z*.17)*1.8,sin(p.x*.2)*1.4);
    float radius=length(warped/vec2(12.5,10.4))+(broad-.5)*.28;
    float massA=1.-smoothstep(.04,1.18,length((warped-vec2(-2.,1.5))/vec2(9.,9.)));
    float massB=(1.-smoothstep(.08,1.15,length((warped-vec2(4.,-2.))/vec2(7.,10.))))*.83;
    float massC=(1.-smoothstep(.04,1.15,length((warped-vec2(-5.,-5.))/vec2(5.,6.))))*.67;
    float mass=max(massA,max(massB,massC));
    float contour=mass*6.3+(fine-.5)*.34*mass+sin(p.x*.34+p.z*.16)*mass*.19;
    float terrace=floor(contour)+smoothstep(.28,.8,fract(contour));
    float dunes=.26*sin(p.x*.42+p.z*.2+broad*1.7)+.12*sin(p.x*1.2-p.z*.23);
    float sand=-1.48+dunes+(fine-.5)*.11;
    float land=sand+forming*(mix(contour,terrace,.3)*1.13+.45*mass)-phase(.6,.95)*.55*(1.-mass);
    float valley=(1.-smoothstep(.2,.85,abs(p.x-sin(p.z*.29)*2.1)))*mass;
    land-=valley*forming*.68;
    // Sparse mineral blossoms emerge from the terrain, with five lobes and
    // offsets derived from the same cell. They never orbit or drift freely.
    vec2 cell=floor(p.xz*.85),local=fract(p.xz*.85)-.5;
    float seed=cmsSeed(cell),other=cmsSeed(cell+vec2(19.1,7.3));
    local-=vec2(seed-.5,other-.5)*.39;
    float angle=atan(local.y,local.x);
    float petalRadius=.22+.04*cos(angle*5.+seed*6.28);
    float petal=(1.-smoothstep(0.,petalRadius,length(local)))*step(.8,seed)*mass*growth;
    float blossom=petal*.16;
    float d=(p.y-land-blossom)*.32;
    float material=blossom>.025&&p.y>land+.025?1.:0.;
    float seaLevel=mix(-2.2,-1.05,phase(.5,.9));
    float sea=max(p.y-seaLevel,.91-radius)*.65;
    if(sea<d)return vec2(sea,3.);
    return vec2(d,material);
}
vec3 sceneColor(vec3 p,float materialID,vec3 normal){
    float growth=phase(.37,.94),grain=noise3(p*5.4),broad=noise3(vec3(p.x*.14,2.8,p.z*.14));
    vec3 sand=mix(vec3(.19,.145,.095),vec3(.41,.34,.22),grain*.48+max(normal.y,0.)*.3);
    vec3 basalt=mix(vec3(.045,.055,.052),vec3(.12,.14,.105),grain);
    float altitude=smoothstep(-.8,2.,p.y),upward=smoothstep(.3,.8,normal.y);
    vec3 vegetation=mix(vec3(.055,.16,.095),vec3(.23,.34,.12),broad);
    vec3 result=mix(sand,basalt,altitude*(1.-upward*.45));
    result=mix(result,vegetation,growth*upward*smoothstep(-.5,1.8,p.y)*(.65+.3*broad));
    if(materialID>2.5)return vec3(.018,.09,.095);
    if(materialID>.5)return mix(vec3(.28,.11,.32),uAccent*.7,.52)*(.65+.35*grain);
    return result;
}
`,
    },
};
