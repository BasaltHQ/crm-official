/* Character-free editorial installations. Every consequential movement is
 * reversible and owned by scroll: hinges, bindings, shutters and paper feeds. */
import {T,v,range,mix,ground,panel,state} from './kinetic-kit.js';

const PI=Math.PI;
const ink='#243d38',ivory='#eee2c5',gold='#ad8750';
const accentOf=w=>'#'+w.accent.getHexString();
function printBase(ctx,cw,ch,tint=ivory){
    ctx.fillStyle=tint;ctx.fillRect(0,0,cw,ch);
    // Deterministic fibers are large enough to survive the canvas mip chain.
    ctx.fillStyle='rgba(64,48,27,.035)';
    for(let i=0;i<560;i++)ctx.fillRect((i*137.71)%cw,(i*81.37)%ch,1.5,2+(i%4));
}
function text(ctx,words,x,y,size=36,color=ink,face='Georgia',weight='400'){
    ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${face}`;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(words,x,y);
}
function line(ctx,x1,y1,x2,y2,color=gold,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function copyLines(ctx,x,y,width,count=4,color=ink,step=19){
    ctx.fillStyle=color;ctx.globalAlpha=.38;
    for(let i=0;i<count;i++)ctx.fillRect(x,y+i*step,width*(i===count-1?.67:1),2.5);
    ctx.globalAlpha=1;
}
function seal(ctx,x,y,r,tint=ink,label='B'){
    ctx.fillStyle=tint;ctx.beginPath();ctx.arc(x,y,r,0,PI*2);ctx.fill();
    ctx.strokeStyle=ivory;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r*.79,0,PI*2);ctx.stroke();
    ctx.fillStyle=ivory;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${r}px Georgia`;ctx.fillText(label,x,y+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';
}
function mountainPrint(ctx,x,y,width,height,tint='#788a78'){
    ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.fillStyle='#d8d5b4';ctx.fillRect(x,y,width,height);
    ctx.fillStyle='#ecbd72';ctx.beginPath();ctx.arc(x+width*.7,y+height*.25,height*.2,0,PI*2);ctx.fill();
    for(let layer=0;layer<3;layer++){
        ctx.fillStyle=[tint,'#536e5f','#2d5146'][layer];ctx.beginPath();ctx.moveTo(x,y+height);
        for(let i=0;i<9;i++)ctx.lineTo(x+i*width/8,y+height*(.35+layer*.15)+Math.sin(i*1.7+layer)*height*.15);
        ctx.lineTo(x+width,y+height);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle='#e5ca88';ctx.lineWidth=width*.018;ctx.beginPath();ctx.moveTo(x+width*.1,y+height);ctx.bezierCurveTo(x+width*.65,y+height*.85,x+width*.28,y+height*.65,x+width*.65,y+height*.54);ctx.stroke();ctx.restore();
}
function rivet(w,c,parent,x,y,z=.065,size=.025){const m=c.cylinder(size,size,.014,c.brass,parent,v(x,y,z),16);m.rotation.x=PI/2;return m;}
function hinge(w,c,parent,x,height,z=0){
    const g=w.group(parent);g.position.set(x,0,z);
    for(let i=0;i<5;i++)c.cylinder(.032,.032,height/5-.012,i%2?c.darkwood:c.brass,g,v(0,(i-2)*height/5,0),20);
    c.cylinder(.011,.011,height+.12,c.brass,g,v(),16);return g;
}
function plate(w,c,parent,width,height,draw,position=v(),frame=false){
    return panel(w,c,{width,height,parent,position,draw,frame,depth:.025});
}
function board(w,c,parent,width,height,draw,position=v(),color=c.darkwood){
    const g=w.group(parent);g.position.copy(position);
    w.box(width+.1,height+.1,.11,color,g,v(0,0,-.055));
    plate(w,c,g,width,height,draw,v(0,0,.012));
    for(const x of [-width/2+.035,width/2-.035])for(const y of [-height/2+.035,height/2-.035])rivet(w,c,g,x,y,.035,.014);
    return g;
}
function label(w,c,parent,labelText,width=1.7,height=.18,position=v()){
    return plate(w,c,parent,width,height,(ctx,cw,ch)=>{printBase(ctx,cw,ch,'#293b35');ctx.fillStyle=ivory;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${ch*.4}px monospace`;ctx.fillText(labelText,cw/2,ch/2,cw*.91);},position);
}
function leafTexture(index,tint){
    const titles=[['A person,','not a record.'],['The first','conversation.'],['Remember','the details.'],['Make room','for the next.'],['A considered','response.'],['Keep the','promise.'],['Begin','again.']];
    return (ctx,cw,ch)=>{
        printBase(ctx,cw,ch);const m=cw*.1;
        text(ctx,`BASALT / RELATIONSHIP ATLAS`,m,ch*.062,cw*.035,ink,'monospace');
        text(ctx,`0${index+1}`,m,ch*.2,cw*.17,tint);line(ctx,m,ch*.24,cw-m,ch*.24);
        titles[index].forEach((s,i)=>text(ctx,s,m,ch*(.31+i*.06),cw*.088,ink));
        if(index===0){
            seal(ctx,cw*.5,ch*.55,cw*.22,tint,'M');text(ctx,'MIRA / FIELDWORK STUDIO',m,ch*.75,cw*.043,ink,'monospace');
            copyLines(ctx,m,ch*.79,cw*.8,4,ink,ch*.022);
        }else{
            const y=ch*.47;ctx.fillStyle=index%2?tint:'#d2c9a7';ctx.fillRect(m,y,cw*.8,ch*.22);
            if(index===1){ctx.strokeStyle=ivory;ctx.lineWidth=3;ctx.strokeRect(cw*.24,y+ch*.055,cw*.52,ch*.11);ctx.beginPath();ctx.moveTo(cw*.24,y+ch*.055);ctx.lineTo(cw*.5,y+ch*.12);ctx.lineTo(cw*.76,y+ch*.055);ctx.stroke();}
            else if(index===2)mountainPrint(ctx,m,y,cw*.8,ch*.22,tint);
            else if(index===3){ctx.strokeStyle=tint;ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.strokeRect(cw*.19+i*cw*.21,y+ch*.055,cw*.13,ch*.12);} }
            else if(index===4){text(ctx,'Thank you.',cw*.17,y+ch*.11,cw*.12,ink);text(ctx,'Here is the next step.',cw*.17,y+ch*.17,cw*.052,ink);}
            else if(index===5){seal(ctx,cw*.5,y+ch*.115,cw*.15,ink,'✓');}
            else {ctx.strokeStyle=ivory;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cw*.5,y+ch*.11,cw*.18,-PI*.4,PI*1.3);ctx.stroke();}
            copyLines(ctx,m,ch*.76,cw*.8,5,ink,ch*.023);
        }
        line(ctx,0,ch*.92,cw,ch*.92,tint,4);seal(ctx,cw*.5,ch*.92,cw*.035,tint,String(index+1));
        text(ctx,['UNDERSTAND','LISTEN','REMEMBER','PLAN','RESPOND','FOLLOW THROUGH','CONTINUE'][index],m,ch*.975,cw*.04,ink,'monospace');
    };
}

export function buildCRM(w,c){
    ground(w,c,-1.92);w.kineticSubjects=[];
    const tint=accentOf(w),atlas=w.group();atlas.name='relationship-concertina';
    const leafWidth=1.25,leafHeight=2.8,leaves=[],hinges=[];
    let previous=atlas;
    for(let i=0;i<7;i++){
        const pivot=w.group(previous);if(i)pivot.position.x=leafWidth;
        const leaf=board(w,c,pivot,leafWidth-.018,leafHeight,leafTexture(i,tint),v(leafWidth/2,0,0),i===0||i===6?c.darkwood:c.paper);
        hinge(w,c,pivot,0,leafHeight+.07,-.055);
        // Canvas edge and doubled stitching carry the scale of a real bound atlas.
        for(const y of [-leafHeight/2-.012,leafHeight/2+.012])w.box(leafWidth,.025,.045,c.brass,pivot,v(leafWidth/2,y,.015));
        leaves.push(leaf);hinges.push(pivot);w.kineticSubjects.push(pivot);previous=pivot;
    }
    const clasp=w.group(leaves[0]);clasp.position.set(.55,-.04,.12);
    w.box(.17,.44,.045,c.brass,clasp);w.box(.07,.21,.07,c.darkwood,clasp,v(0,0,.035));
    const medallion=c.cylinder(.095,.095,.035,c.brass,clasp,v(0,.04,.07),48);medallion.rotation.x=PI/2;
    const openingNote=board(w,c,leaves[1],.8,.52,(ctx,cw,ch)=>{
        printBase(ctx,cw,ch,'#f3e7c9');text(ctx,'Thank you for listening.',cw*.09,ch*.38,cw*.06);text(ctx,'Let’s make something good.',cw*.09,ch*.61,cw*.052);line(ctx,cw*.09,ch*.78,cw*.65,ch*.78,tint,3);
    },v(.05,-.25,.08),c.paper);
    const response=board(w,c,leaves[4],.86,.58,(ctx,cw,ch)=>{
        printBase(ctx,cw,ch,'#f0dfb8');seal(ctx,cw*.16,ch*.28,ch*.14,ink,'B');text(ctx,'A thoughtful next step.',cw*.1,ch*.64,cw*.06);line(ctx,cw*.1,ch*.78,cw*.8,ch*.78,tint,3);
    },v(0,-.25,.09),c.paper);
    const beginning=plate(w,c,atlas,1.13,2.7,(ctx,cw,ch)=>{
        printBase(ctx,cw,ch,'#25483f');ctx.strokeStyle=gold;ctx.lineWidth=3;ctx.strokeRect(cw*.09,ch*.04,cw*.82,ch*.92);
        text(ctx,'THE',cw*.2,ch*.2,cw*.1,ivory);text(ctx,'RELATIONSHIP',cw*.13,ch*.28,cw*.075,ivory);text(ctx,'ATLAS',cw*.2,ch*.39,cw*.14,ivory);
        seal(ctx,cw*.5,ch*.61,cw*.24,gold,'B');text(ctx,'EVERY CONVERSATION',cw*.13,ch*.84,cw*.047,ivory,'monospace');text(ctx,'LEAVES A MARK.',cw*.13,ch*.88,cw*.047,ivory,'monospace');
    },v(leafWidth/2,0,.13));
    // The cloth cover is a real hinge, not a title plane appearing over the pages.
    const coverPivot=w.group(atlas);beginning.position.set(leafWidth/2,0,.13);coverPivot.add(beginning);
    hinge(w,c,coverPivot,0,2.8,.1);w.kineticSubjects.push(coverPivot,openingNote,response,clasp);
    const ribbon=w.mesh(new T.PlaneGeometry(8.75,.035,140,1),new T.MeshStandardMaterial({color:tint,roughness:.62,side:T.DoubleSide}),atlas,v(4.375,-1.18,.12));
    ribbon.visible=false;
    w.motions.push(p=>{
        const unfold=range(p,.13,.61),settle=range(p,.68,.9);
        atlas.position.set(mix(-.7,-4.35,unfold),-.2,mix(.15,-.2,settle));
        atlas.rotation.set(mix(.02,-.1,settle),mix(-.12,-.03,settle),mix(-.035,.012,settle));
        hinges.forEach((h,i)=>{if(!i)return;const opening=range(p,.13+i*.047,.39+i*.036);h.rotation.y=(i%2?1:-1)*mix(PI-.085,.035,opening);});
        coverPivot.rotation.y=-mix(.025,PI*.86,range(p,.025,.24));
        clasp.rotation.y=-range(p,0,.1)*PI*.8;clasp.position.x=mix(.55,.65,range(p,0,.1));
        openingNote.rotation.x=-range(p,.28,.44)*.32;openingNote.position.z=mix(.08,.27,range(p,.28,.44));
        response.rotation.x=-range(p,.59,.76)*.28;response.position.z=mix(.09,.3,range(p,.59,.76));
        // Embossed timeline only becomes continuous when all leaves are open.
        ribbon.visible=p>.61;ribbon.scale.x=range(p,.61,.79);ribbon.position.x=4.375*ribbon.scale.x;
        state(w,p,{installation:'relationship-atlas',panelsOpen:unfold,contextJoined:range(p,.4,.64),response:range(p,.59,.76),continuity:range(p,.79,1)});
        w.caption={speaker:'THE RELATIONSHIP ATLAS',text:p<.25?'Every relationship starts with a moment.':p<.54?'Bring the moments into one shared story.':p<.8?'A thoughtful response grows from remembered context.':'Carry the whole relationship into the next conversation.'};
    });
    return {shots:[
        {p:0,eye:[.85,.4,4.5],look:[0,-.15,0],fov:37},
        {p:.22,eye:[-1.8,1.1,5.5],look:[-.3,0,0],fov:39},
        {p:.46,eye:[3.2,1.9,7.6],look:[.2,0,-.3],fov:42},
        {p:.72,eye:[4.3,.45,8.4],look:[.4,-.1,0],fov:43},
        {p:1,eye:[1.6,2.6,12.8],look:[0,-.2,-.2],fov:42},
    ]};
}

function onyxArt(ctx,cw,ch,mode='master'){
    const portrait=mode==='portrait',wide=mode==='wide';
    printBase(ctx,cw,ch,mode==='square'?'#d9c7e8':ivory);
    ctx.fillStyle='#3c304b';ctx.fillRect(0,0,cw,ch*.08);
    text(ctx,'FIELD NOTES / VOL. 01',cw*.07,ch*.054,cw*.025,ivory,'monospace');
    const artY=.43,artHeight=portrait?.34:.39;
    if(wide){mountainPrint(ctx,cw*.48,ch*.14,cw*.47,ch*.72,'#9b86a4');text(ctx,'MAKE',cw*.07,ch*.29,cw*.115,'#392d46','Georgia','600');text(ctx,'ROOM.',cw*.07,ch*.47,cw*.115,'#392d46','Georgia','600');text(ctx,'For a brighter way to work.',cw*.07,ch*.61,cw*.031,'#392d46');}
    else {
        const headline=Math.min(cw*.2,ch*.15);
        text(ctx,'MAKE',cw*.075,ch*.24,headline,'#392d46','Georgia','600');text(ctx,'ROOM.',cw*.075,ch*.39,headline,'#392d46','Georgia','600');
        mountainPrint(ctx,cw*.07,ch*artY,cw*.86,ch*artHeight,'#9b86a4');
        text(ctx,'For a brighter way to work.',cw*.07,ch*(portrait?.84:.89),cw*.048,'#392d46');
    }
    line(ctx,cw*.07,ch*.94,cw*.93,ch*.94,'#877096',2);
    text(ctx,mode==='master'?'ONE IDEA. MANY CONVERSATIONS.':mode==='portrait'?'AN EDITORIAL STORY':mode==='wide'?'A PROFESSIONAL PERSPECTIVE':'A MOMENT WORTH SHARING',cw*.07,ch*.975,cw*.022,'#392d46','monospace');
}

export function buildOnyx(w,c){
    ground(w,c,-2.05);w.kineticSubjects=[];
    const theater=w.group();theater.name='editorial-type-theater';
    const columns=9,width=4.5,height=3.4,shutters=[];
    const fullMap=c.texture((ctx,cw,ch)=>onyxArt(ctx,cw,ch),1536,1160);
    for(let i=0;i<columns;i++){
        const g=w.group(theater);g.position.set((i-(columns-1)/2)*width/columns,.4,0);
        const stripMap=fullMap.clone();stripMap.repeat.set(1/columns,1);stripMap.offset.x=i/columns;stripMap.needsUpdate=true;
        w.box(width/columns-.014,height,.1,c.darkwood,g);
        w.mesh(new T.PlaneGeometry(width/columns-.014,height),new T.MeshStandardMaterial({map:stripMap,roughness:.76}),g,v(0,0,.057));
        for(const x of [-width/columns/2+.012,width/columns/2-.012])w.box(.014,height,.015,c.brass,g,v(x,0,.067));
        for(const y of [-height/2-.16,height/2+.16])c.cylinder(.026,.026,.33,c.brass,g,v(0,y,0),20);
        for(let j=0;j<5;j++){const rib=w.box(width/columns-.06,.012,.012,c.brass,g,v(0,(j-2)*.46,-.06));rib.name='shutter-reverse-binding';}
        shutters.push(g);w.kineticSubjects.push(g);
    }
    // Both shaft bearings are supported by a continuous metal yoke.
    for(const y of [-1.5,2.3]){w.box(4.95,.14,.31,c.darkwood,theater,v(0,y,0));w.box(4.82,.035,.35,c.brass,theater,v(0,y+.09,0));}
    for(const x of [-2.48,2.48]){w.box(.16,4.02,.3,c.darkwood,theater,v(x,.4,0));for(const y of [-1.47,2.28])rivet(w,c,theater,x,y,.17,.045);}
    const roller=c.cylinder(.15,.15,4.72,c.brass,theater,v(0,-1.67,.18),64);roller.rotation.z=PI/2;
    const pressure=c.cylinder(.095,.095,4.7,c.darkwood,theater,v(0,-1.85,.27),48);pressure.rotation.z=PI/2;
    const handles=[];
    for(const x of [-2.65,2.65]){const crank=w.group(theater);crank.position.set(x,-1.67,.18);const wheel=w.ring(.29,.025,c.brass,crank);wheel.rotation.y=PI/2;for(let i=0;i<3;i++){const spoke=w.box(.035,.55,.035,c.brass,crank);spoke.rotation.x=i*PI/3;}handles.push(crank);}
    label(w,c,theater,'BASALT ONYX / THE EDITORIAL ENGINE',3.3,.17,v(0,2.52,.08));
    const outputs=[],sizes=[[1.6,1.6,'square'],[1.45,2.15,'portrait'],[2.35,1.32,'wide']];
    sizes.forEach(([pw,ph,format],i)=>{
        const frame=w.group();frame.name=`printed-${format}-format`;
        // Paper emerges from a roller with a curled leading edge and a real feed shaft.
        const paper=board(w,c,frame,pw,ph,(ctx,cw,ch)=>onyxArt(ctx,cw,ch,format),v(),c.paper);
        const edge=c.cylinder(.035,.035,pw,c.brass,paper,v(0,-ph/2-.045,-.045),32);edge.rotation.z=PI/2;
        const hanger=w.group(frame);hanger.position.set(0,ph/2+.085,-.06);
        c.cylinder(.025,.025,pw+.2,c.brass,hanger,v(),20).rotation.z=PI/2;
        for(const x of [-pw*.36,pw*.36])w.box(.03,.15,.04,c.brass,hanger,v(x,-.06,0));
        const cables=[-.36,.36].map(side=>({side,mesh:c.cylinder(.008,.008,1,c.iron,w.root,v(),10)}));
        outputs.push({frame,paper,ph,pw,cables});w.kineticSubjects.push(frame);
    });
    const pull=plate(w,c,theater,4.25,.58,(ctx,cw,ch)=>{printBase(ctx,cw,ch,'#d9c7e8');text(ctx,'ONE IDEA. / THREE WAYS IN.',cw*.06,ch*.63,cw*.064,'#392d46','Georgia');},v(0,-1.83,.29));
    w.kineticSubjects.push(pull,roller,pressure);
    w.motions.push(p=>{
        const reveal=range(p,.05,.4),printing=range(p,.41,.66),formats=range(p,.61,.93);
        theater.position.set(0,mix(-.05,.65,formats),mix(0,-1.4,formats));
        theater.rotation.y=mix(.22,-.1,range(p,0,.54));
        shutters.forEach((g,i)=>g.rotation.y=mix((i%2?1:-1)*(1.15+(i%3)*.18),0,range(p,.04+i*.019,.22+i*.022)));
        roller.rotation.x=-printing*PI*4;pressure.rotation.x=printing*PI*6;
        handles.forEach(h=>h.rotation.x=-printing*PI*4);
        pull.scale.y=mix(.03,1,printing);pull.position.y=-1.76-.29*printing;pull.rotation.x=-.18*printing;
        outputs.forEach(({frame,ph,pw,cables},i)=>{
            const f=range(p,.61+i*.035,.82+i*.045);frame.visible=f>0;
            frame.position.set(mix(0,[-2.55,0,2.55][i],f),mix(-1.25,[-.15,-.1,-.12][i],f),mix(.42,[1.35,1.8,1.3][i],f));
            frame.rotation.set(mix(-PI*.46,[-.04,.015,.03][i],f),mix(0,[.2,0,-.24][i],f),mix(0,[.075,0,-.06][i],f));
            frame.scale.setScalar(mix(.025,1,f));
            frame.updateWorldMatrix(true,false);theater.updateWorldMatrix(true,false);
            cables.forEach(({side,mesh})=>{
                mesh.visible=f>.01;
                const a=theater.localToWorld(v((i-1)*1.5+side*.5,2.32,.04));
                const b=frame.localToWorld(v(pw*side,ph/2+.08,-.06));
                mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=a.distanceTo(b);
                mesh.quaternion.setFromUnitVectors(v(0,1,0),b.sub(a).normalize());
            });
        });
        state(w,p,{installation:'editorial-type-theater',messageResolved:reveal,impression:printing,audienceFormats:formats});
        w.caption={speaker:'THE EDITORIAL ENGINE',text:p<.3?'Turn a point of view into a message.':p<.58?'Give the message a clear, confident shape.':p<.84?'Translate the idea for different kinds of attention.':'One voice. Three considered ways to reach people.'};
    });
    return {shots:[
        {p:0,eye:[3.8,1.1,5.2],look:[.35,.35,0],fov:38},
        {p:.29,eye:[.3,.6,6.7],look:[0,.4,0],fov:38},
        {p:.52,eye:[-2.3,-.3,6.1],look:[-.25,-.65,.25],fov:39},
        {p:.76,eye:[4.6,1.65,8.4],look:[.2,.2,.2],fov:43},
        {p:1,eye:[.8,2.1,11.3],look:[0,.4,.1],fov:42},
    ]};
}

function pageArt(ctx,cw,ch,role){
    printBase(ctx,cw,ch);const tint='#7b627d';
    if(role==='cover'){
        printBase(ctx,cw,ch,'#3f3448');line(ctx,cw*.08,ch*.07,cw*.92,ch*.07,gold,3);
        text(ctx,'FIELDWORK',cw*.1,ch*.17,cw*.09,ivory,'monospace');text(ctx,'A brighter',cw*.1,ch*.36,cw*.115,ivory);text(ctx,'way to',cw*.1,ch*.46,cw*.115,ivory);text(ctx,'build.',cw*.1,ch*.58,cw*.17,ivory);
        mountainPrint(ctx,cw*.1,ch*.65,cw*.8,ch*.22,tint);text(ctx,'A LIVING PUBLICATION / 001',cw*.1,ch*.94,cw*.038,ivory,'monospace');return;
    }
    text(ctx,'FIELDWORK / A LIVING PUBLICATION',cw*.075,ch*.065,cw*.032,tint,'monospace');line(ctx,cw*.075,ch*.085,cw*.925,ch*.085,tint,2);
    if(role==='image'){
        mountainPrint(ctx,cw*.07,ch*.14,cw*.86,ch*.59,tint);text(ctx,'ROOM TO GROW.',cw*.075,ch*.81,cw*.09,ink);copyLines(ctx,cw*.075,ch*.86,cw*.8,4,ink,ch*.027);
    }else if(role==='story'){
        text(ctx,'The shape',cw*.075,ch*.23,cw*.13,ink);text(ctx,'of an idea.',cw*.075,ch*.32,cw*.13,ink);copyLines(ctx,cw*.075,ch*.42,cw*.82,8,ink,ch*.035);
        seal(ctx,cw*.27,ch*.83,cw*.15,tint,'B');text(ctx,'MAKE IT YOURS.',cw*.075,ch*.96,cw*.05,tint,'monospace');
    }else{
        text(ctx,'A brighter',cw*.075,ch*.23,cw*.13,ink);text(ctx,'way to build.',cw*.075,ch*.34,cw*.13,ink);
        mountainPrint(ctx,cw*.075,ch*.41,cw*.85,ch*.34,tint);copyLines(ctx,cw*.075,ch*.82,cw*.8,4,ink,ch*.027);
    }
}

export function buildCMS(w,c){
    ground(w,c,-2.05);w.kineticSubjects=[];
    const publication=w.group();publication.name='living-gatefold';
    const width=2.25,height=3.22;
    const core=board(w,c,publication,width,height,(ctx,cw,ch)=>{
        printBase(ctx,cw,ch);text(ctx,'FIELDWORK',cw*.075,ch*.075,cw*.06,ink,'monospace');line(ctx,cw*.075,ch*.095,cw*.925,ch*.095,'#7b627d',3);text(ctx,'001 / A LIVING PUBLICATION',cw*.075,ch*.96,cw*.032,ink,'monospace');
    });
    for(let i=0;i<12;i++)w.box(width-.04,height-.04,.007,i%2?c.paper:c.brass,publication,v(0,-i*.001,-.09-i*.012));
    const left=w.group(publication);left.position.set(-width/2,0,.12);
    const leftPage=board(w,c,left,1.7,height,(ctx,cw,ch)=>pageArt(ctx,cw,ch,'story'),v(-.85,0,0),c.paper);hinge(w,c,left,0,height,.02);
    const right=w.group(publication);right.position.set(width/2,0,.28);
    const rightPage=board(w,c,right,1.7,height,(ctx,cw,ch)=>pageArt(ctx,cw,ch,'image'),v(.85,0,0),c.paper);hinge(w,c,right,0,height,.02);
    const top=w.group(publication);top.position.set(0,height/2,.44);
    const title=plate(w,c,top,width,1.02,(ctx,cw,ch)=>{printBase(ctx,cw,ch,'#bbaa99');text(ctx,'A GOOD IDEA',cw*.08,ch*.39,cw*.11,ink);text(ctx,'DESERVES A WORLD.',cw*.08,ch*.75,cw*.085,ink);},v(0,.51,0));
    const crease=c.cylinder(.023,.023,width,c.brass,top,v(),20);crease.rotation.z=PI/2;
    const cover=w.group(publication);cover.position.set(-width/2,0,.76);
    const front=board(w,c,cover,width,height,(ctx,cw,ch)=>pageArt(ctx,cw,ch,'cover'),v(width/2,0,0));hinge(w,c,cover,0,height,.04);
    const heading=plate(w,c,publication,1.87,.65,(ctx,cw,ch)=>{printBase(ctx,cw,ch);text(ctx,'A brighter',cw*.025,ch*.42,cw*.145,ink);text(ctx,'way to build.',cw*.025,ch*.88,cw*.145,ink);},v(0,.88,.11));
    const landscape=plate(w,c,publication,1.88,1.08,(ctx,cw,ch)=>mountainPrint(ctx,0,0,cw,ch,'#9a84a3'),v(0,-.09,.12));
    const description=plate(w,c,publication,1.87,.48,(ctx,cw,ch)=>{printBase(ctx,cw,ch);text(ctx,'Design for the life beyond the screen.',cw*.025,ch*.28,cw*.047,ink);copyLines(ctx,cw*.025,ch*.46,cw*.95,4,ink,ch*.16);},v(0,-1.03,.13));
    const action=plate(w,c,publication,.96,.22,(ctx,cw,ch)=>{printBase(ctx,cw,ch,'#7b627d');text(ctx,'EXPLORE THE STORY  ↗',cw*.09,ch*.66,cw*.06,ivory,'monospace');},v(-.43,-1.31,.14));
    const bottom=w.group(publication);bottom.position.set(0,-height/2,.58);
    const colophon=plate(w,c,bottom,width,.68,(ctx,cw,ch)=>{printBase(ctx,cw,ch,'#7b627d');text(ctx,'MADE TO MOVE WITH YOU.',cw*.08,ch*.43,cw*.065,ivory);text(ctx,'DESKTOP / TABLET / POCKET',cw*.08,ch*.75,cw*.043,ivory,'monospace');},v(0,-.34,0));
    const footCrease=c.cylinder(.02,.02,width,c.brass,bottom,v(),20);footCrease.rotation.z=PI/2;
    const sealGroup=w.group(publication);sealGroup.position.set(.88,-1.25,.18);
    const wax=c.cylinder(.18,.18,.035,c.copper,sealGroup,v(),64);wax.rotation.x=PI/2;
    const sealMap=c.texture((ctx,cw,ch)=>{ctx.clearRect(0,0,cw,ch);seal(ctx,cw/2,ch/2,cw*.49,'#7b627d','✓');},384,384);
    const sealFace=w.mesh(new T.PlaneGeometry(.3,.3),new T.MeshStandardMaterial({map:sealMap,roughness:.75,transparent:true,depthWrite:false}),sealGroup,v(0,0,.025));
    sealFace.name='publication-review-seal';
    w.kineticSubjects.push(publication,left,right,top,bottom,cover,heading,landscape,description,action,sealGroup);
    w.motions.push(p=>{
        const opening=range(p,.08,.38),composition=range(p,.35,.57),responsive=range(p,.6,.84),publish=range(p,.86,1);
        publication.position.set(0,mix(-.1,-.16,responsive),0);
        publication.rotation.set(mix(.13,-.035,responsive),mix(-.23,.09,opening),mix(-.045,.025,responsive));
        cover.rotation.y=-mix(mix(.015,PI*1.48,range(p,.025,.24)),PI*2,responsive);
        cover.position.z=mix(.76,-.98,responsive);
        // Alternate fold directions keep the paper thickness on distinct planes.
        left.rotation.y=mix(PI-.06,.08,opening)-responsive*(PI-.04);
        right.rotation.y=-mix(PI-.045,.08,opening)+responsive*(PI-.04);
        top.rotation.x=mix(PI-.09,.02,range(p,.2,.44))-responsive*(PI-.04);
        bottom.rotation.x=-mix(PI-.08,.02,range(p,.29,.49))+responsive*(PI-.04);
        left.position.z=mix(.12,-.24,responsive);right.position.z=mix(.28,-.42,responsive);
        top.position.z=mix(.44,-.59,responsive);bottom.position.z=mix(.58,-.76,responsive);
        // The paper composition changes from a wide editorial pair to a readable
        // portrait hierarchy; content stays attached to the publication surface.
        const wide=composition*(1-responsive);
        heading.position.set(mix(0,-.44,wide),mix(.88,.79,wide),.13);heading.scale.x=mix(1,.55,wide);heading.scale.y=mix(1,1.18,wide);
        landscape.position.set(mix(0,.5,wide),mix(-.09,.44,wide),.14);landscape.scale.set(mix(1,.47,wide),mix(1,1.54,wide),1);
        description.position.y=mix(-1.03,-.74,wide);description.scale.y=mix(1,1.35,wide);
        action.position.set(mix(-.43,-.44,wide),mix(-1.31,-1.22,wide),.15);
        sealGroup.scale.setScalar(mix(.001,1,publish));sealGroup.rotation.z=mix(-.55,0,publish);
        // The bound back remains the structural support even as wings fold away.
        core.position.z=0;leftPage.visible=true;rightPage.visible=true;title.visible=true;colophon.visible=true;front.visible=true;
        state(w,p,{installation:'living-gatefold',paperUnfolded:opening,composition,portrait:responsive,published:publish});
        w.caption={speaker:'THE LIVING PUBLICATION',text:p<.25?'A folded sheet holds the beginning of a world.':p<.56?'Open it. Give the story a rhythm of its own.':p<.84?'The same idea finds its shape in every format.':'Reviewed, composed, and ready for the next reader.'};
    });
    return {shots:[
        {p:0,eye:[2.2,.8,4.9],look:[.1,.1,0],fov:37},
        {p:.26,eye:[-2.7,2.8,7.3],look:[0,.4,0],fov:41},
        {p:.5,eye:[1.5,1.2,9.2],look:[0,.35,0],fov:42},
        {p:.75,eye:[3.5,.6,6.3],look:[0,0,0],fov:39},
        {p:1,eye:[.4,.5,6.2],look:[0,0,0],fov:37},
    ]};
}
