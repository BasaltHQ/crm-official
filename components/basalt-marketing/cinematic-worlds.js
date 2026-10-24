import {cameraTrack,createKit} from './kinetic-kit.js';
import {buildCRM,buildOnyx,buildCMS} from './kinetic-editorial.js';
import {buildHQ} from './kinetic-gateway.js';
import {buildEcho,buildVigil} from './kinetic-intelligence.js';
import {buildERP} from './kinetic-operations.js';
import {prepareSurfaces,finishSurfaces} from './cinematic-surfaces.js';

const builders={network:buildCRM,crystal:buildOnyx,constellation:buildHQ,modules:buildERP,pages:buildCMS,wave:buildEcho,shield:buildVigil};
export function buildCinematicWorld(w,kind){
    w.kind=kind;
    w.kinetic=true;
    const materials=createKit(w);prepareSurfaces(materials);
    const result=builders[kind](w,materials);
    finishSurfaces(w.root);
    return {...result,shot:cameraTrack(result.shots)};
}
