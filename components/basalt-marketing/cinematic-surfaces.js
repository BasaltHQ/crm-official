/* Light catches a worn edge before it catches a label. These finishes use object
 * coordinates so a moving prop carries its grain with it; no remote texture maps. */
import {RoundedBoxGeometry} from './three-runtime.js';

export function prepareSurfaces(c){
    for(const [name,finish] of Object.entries({wood:'timber',darkwood:'timber',stone:'stone',brass:'metal',copper:'metal',iron:'metal',paper:'paper',cloth:'cloth',terra:'stone'})){
        c[name].userData.basaltFinish=finish;
        c[name].flatShading=false;
    }
    c.brass.metalness=.79;c.brass.roughness=.32;
    c.copper.metalness=.64;c.copper.roughness=.38;
    c.wood.roughness=.69;c.darkwood.roughness=.73;
}

const surfaceNoise=`
varying vec3 basaltLocal;
float basaltHash(vec3 p){p=fract(p*.3183099+vec3(.13,.31,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float basaltNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(basaltHash(i),basaltHash(i+vec3(1,0,0)),f.x),mix(basaltHash(i+vec3(0,1,0)),basaltHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(basaltHash(i+vec3(0,0,1)),basaltHash(i+vec3(1,0,1)),f.x),mix(basaltHash(i+vec3(0,1,1)),basaltHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`;

function finishMaterial(material){
    const finish=material.userData.basaltFinish;
    if(!finish||material.map||material.transparent||material.userData.basaltFinished)return;
    material.userData.basaltFinished=true;
    const grain=finish==='timber' ? `
        float grain=sin(basaltLocal.x*160.+basaltNoise(basaltLocal*vec3(8.,.65,8.))*18.+basaltLocal.z*39.);
        float patina=basaltNoise(basaltLocal*vec3(3.,.35,3.));
        float finishValue=.955+grain*.014+patina*.07;`
        :finish==='metal'?`
        float patina=basaltNoise(basaltLocal*17.);
        float finishValue=.92+.12*patina;`
        :finish==='cloth'?`
        float patina=basaltNoise(basaltLocal*38.);
        float weave=sin(basaltLocal.x*630.)*sin(basaltLocal.y*630.);
        float finishValue=.94+patina*.06+weave*.018;`
        :`
        float patina=basaltNoise(basaltLocal*23.);
        float finishValue=.91+patina*.14;`;
    material.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 basaltLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nbasaltLocal=position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+surfaceNoise)
            .replace('#include <color_fragment>','#include <color_fragment>\n'+grain+'\ndiffuseColor.rgb*=finishValue;')
            .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(patina-.5)*.12,.14,1.);');
    };
    material.customProgramCacheKey=()=>`basalt-surface-3-${finish}`;
    material.needsUpdate=true;
}

export function finishSurfaces(root){
    const rounded=new Map(),replaced=new Set();
    root.traverse(object=>{
        if(!object.isMesh)return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        materials.forEach(finishMaterial);
        const geometry=object.geometry;
        if(object.userData.figure||geometry.type!=='BoxGeometry'||materials.some(m=>m.map||m.transparent))return;
        const {width,height,depth}=geometry.parameters,minimum=Math.min(width,height,depth);
        if(minimum<.045||Math.max(width,height,depth)<.12)return;
        const radius=Math.min(.018,minimum*.12),key=[width,height,depth,radius].join('/');
        if(!rounded.has(key))rounded.set(key,new RoundedBoxGeometry(width,height,depth,1,radius));
        object.geometry=rounded.get(key);replaced.add(geometry);
        materials.forEach(material=>{material.flatShading=false;});
    });
    // All references have been replaced; shared replacement geometry is disposed
    // with the rest of the renderer's geometry set on unmount.
    replaced.forEach(geometry=>geometry.dispose());
}
