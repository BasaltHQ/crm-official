/* A gallery film rig: warm sculpting key, restrained bounce and a cool rim.
 * The seamless dark environment gives each moving artifact its own silhouette. */
import {THREE as T} from './three-runtime.js';

const moods={
    network:{sky:'#264a50',horizon:'#b99b79',fog:'#344d4e',sun:'#ffe5bd',fill:'#bddfe5',density:.016,shaft:.026},
    crystal:{sky:'#36324d',horizon:'#bd9390',fog:'#444454',sun:'#ffe8d2',fill:'#ccd0f2',density:.015,shaft:0},
    constellation:{sky:'#3b6079',horizon:'#d4af87',fog:'#607d85',sun:'#ffe8bf',fill:'#c7e1f2',density:.014,shaft:0},
    modules:{sky:'#224750',horizon:'#b09b7e',fog:'#345451',sun:'#ffe4ba',fill:'#bce1dc',density:.016,shaft:.024},
    pages:{sky:'#344e5e',horizon:'#c4aa8b',fog:'#435765',sun:'#ffecd0',fill:'#cad9eb',density:.017,shaft:.022},
    wave:{sky:'#3f5558',horizon:'#c3a16b',fog:'#4f6258',sun:'#ffe5b5',fill:'#d1e4d8',density:.016,shaft:.025},
    shield:{sky:'#273748',horizon:'#a48673',fog:'#394552',sun:'#ffe1bc',fill:'#c2d6ec',density:.021,shaft:.018},
};

export function lightWorld(scene,kind,mobile){
    const m=moods[kind],intimate=kind==='shield',open=kind==='constellation'||kind==='crystal';
    // Neutral reflections keep glazed ceramic readable and brass distinct from
    // timber; color comes from the key/sky rather than a brown ambient wash.
    scene.environmentIntensity=intimate?.34:open?.47:.42;
    const backdrop=new T.Color(m.sky).multiplyScalar(.24);
    scene.background=backdrop;scene.fog=new T.FogExp2(backdrop,m.density*.45);
    const sky=new T.Mesh(new T.SphereGeometry(85,24,16),new T.ShaderMaterial({
        side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:new T.Color(m.sky)},horizon:{value:new T.Color(m.horizon)}},
        vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`uniform vec3 zenith;uniform vec3 horizon;varying vec3 direction;void main(){vec3 d=normalize(direction);float h=smoothstep(-.16,.76,d.y);vec3 color=mix(horizon*.035,zenith*.12,h);float sun=pow(max(0.,dot(d,normalize(vec3(-.6,.45,-.65)))),32.);color+=horizon*sun*.04;gl_FragColor=vec4(color,1.);}`
    }));sky.name='atmospheric-sky';sky.renderOrder=-100;scene.add(sky);
    scene.add(new T.HemisphereLight(m.fill,'#64635c',intimate?.4:open?.62:.54));
    const sun=new T.DirectionalLight(m.sun,intimate?2.0:2.65);sun.position.set(-6,9,5);sun.target.position.set(0,0,-1);sun.castShadow=true;
    sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
    Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:38});
    sun.shadow.normalBias=.012;sun.shadow.bias=-.00008;sun.shadow.radius=3;
    scene.add(sun,sun.target);
    const rim=new T.DirectionalLight(m.fill,intimate?.9:1.25);rim.position.set(4,5,-6);scene.add(rim);
    const fill=new T.DirectionalLight('#e8eff1',intimate?.28:.38);fill.position.set(2,3,8);scene.add(fill);
    // A practical pool complements the window instead of doubling its exposure.
    const task=new T.SpotLight(m.sun,intimate?30:18,16,Math.PI*(intimate?.2:.27),.92,1.4);task.position.set(-2,6,2);task.target.position.set(0,1,-1);scene.add(task,task.target);
    return target=>{if(intimate){task.target.position.copy(target);task.position.copy(target).add(new T.Vector3(-2,5,2));}};
}

export const FilmGrade={uniforms:{tDiffuse:{value:null}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;void main(){
        vec4 c=texture2D(tDiffuse,vUv);float luminance=dot(c.rgb,vec3(.2126,.7152,.0722));
        // Multiplicative split toning leaves true black and emissive accents
        // intact. Warm highlights stay cream, while shaded joins gain depth.
        float shadow=1.-smoothstep(.035,.45,luminance);float highlight=smoothstep(.35,1.6,luminance);
        c.rgb*=mix(vec3(1.),vec3(.97,1.005,1.035),shadow*.7);
        c.rgb*=mix(vec3(1.),vec3(1.018,1.006,.983),highlight*.55);
        vec2 p=(vUv-.5)*vec2(.8,1.);float vignette=1.-smoothstep(.28,.78,length(p))*.09;
        c.rgb*=vignette;gl_FragColor=c;
    }`
};

// Reuse the occlusion pass's depth rather than rendering the entire world again.
// A broad sharp plane keeps engraving and folded paper legible; only extreme
// foreground and distant edges soften slightly into the atmosphere.
export const CinematicFocus={uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new T.Vector2(1,1)},nearPlane:{value:.08},farPlane:{value:110},focusDistance:{value:5}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D tDepth;uniform vec2 resolution;uniform float nearPlane;uniform float farPlane;uniform float focusDistance;varying vec2 vUv;
        float distanceAt(vec2 uv){float z=texture2D(tDepth,uv).x;return nearPlane*farPlane/(farPlane-z*(farPlane-nearPlane));}
        void main(){float depth=distanceAt(vUv);float radius=clamp((abs(depth-focusDistance)-3.)/max(depth,1.)*5.,0.,2.);
        vec4 result=texture2D(tDiffuse,vUv);float weight=1.;
        for(int i=0;i<12;i++){float a=float(i)*2.399963;float r=sqrt((float(i)+.5)/12.);vec2 uv=vUv+vec2(cos(a),sin(a))*r*radius/resolution;float neighbor=distanceAt(uv);float accept=1.-smoothstep(.3,1.5,max(0.,depth-neighbor));result+=texture2D(tDiffuse,uv)*accept;weight+=accept;}
        gl_FragColor=result/weight;}`
};
