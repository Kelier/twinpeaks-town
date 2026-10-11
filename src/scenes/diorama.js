import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {TwinPeaksWorld} from './twinPeaksWorld.js';
import {curtainMaterial,chevronTexture,textTexture} from './materials.js';
import {PLACES} from '../content/twinPeaks.js';
import T from '../design/tokens.json';
const M=T.miniature;
// Nested miniature: a valley plinth carries the town plinth, which carries four cutaway sets.
// Each layer is revealed by flying in: valley → town → building (roof lifts) → 1:1 room.
export const SETS={diner:{pos:[-5.3,.62,4.4],scale:.43,shell:[6.4,1.95,8.1]},lodge:{pos:[-5.7,.62,-4.4],scale:.45,shell:[6.2,2.4,6.7]},woods:{pos:[5.5,.62,-4.1],scale:.29,shell:[9.6,2.6,10.6]},redroom:{pos:[5.8,.62,6],scale:.46,shell:[5,2.2,5]}};
export const ORDER=['diner','lodge','woods','redroom'];
export function placeStatus(s,id){
 if(id==='diner')return s.evidence.includes('receipt')?'done':'open';
 if(id==='lodge')return s.evidence.includes('key')?'done':s.evidence.includes('receipt')?'open':'locked';
 if(id==='woods')return s.evidence.includes('tape')?'done':s.evidence.includes('key')?'open':'locked';
 return s.completed?'done':s.flags.deduced?'open':'locked';
}
let seed=771;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const mat=(color,roughness=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});

class CutawaySet extends TwinPeaksWorld{
 box(w,h,d,x,y,z,m,parent,round=0){
  if(this.id==='diner'&&y>3.9&&h<.4)return new THREE.Group();
  if(this.id==='lodge'&&y>4.2)return new THREE.Group();
  if((this.id==='diner'&&Math.abs(x)>=6.5&&h>=3)||(this.id==='lodge'&&Math.abs(x)>=6.4&&h>=3)){h=.85;y=.425;}
  if(this.id==='woods'&&w===48){w=36;d=43;z=-4;}
  return super.box(w,h,d,x,y,z,m,parent,round);
 }
 door(){return new THREE.Group();}
 build(){super.build();const removals=[];this.root.traverse(o=>{if(o.isLight)removals.push(o);if(this.id==='redroom'&&o.isMesh&&o.material?.userData?.uTime&&(o.position.z>4||o.position.x>4))removals.push(o);});for(const o of removals)o.removeFromParent();if(this.id==='redroom'){const floor=this.root.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry'&&Math.abs(o.rotation.x+Math.PI/2)<.01);if(floor)floor.material.color.set(M.redroomFloorTint);}}
}

function signTexture(lines,{fg='#f2e6c9',bg='#2b443b',w=1024,h=256,font='bold 92px Georgia',border=null}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);
 if(border){x.strokeStyle=border;x.lineWidth=14;x.strokeRect(14,14,w-28,h-28);}
 x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';const lh=h/(lines.length+.4);lines.forEach((l,i)=>{x.font=i===0?font:font.replace(/\d+px/,m=>Math.round(parseInt(m)*.5)+'px');x.fillText(l,w/2,lh*(i+.7));});
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function windowTexture(lit){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle=lit?'#ffcf8a':'#1a1d22';x.fillRect(0,0,128,128);
 if(lit){const g=x.createRadialGradient(64,90,4,64,70,90);g.addColorStop(0,'#fff1cf');g.addColorStop(1,'rgba(255,170,90,.2)');x.fillStyle=g;x.fillRect(0,0,128,128);}
 x.strokeStyle=lit?'#6b3b1c':'#0c0d10';x.lineWidth=10;x.strokeRect(0,0,128,128);x.beginPath();x.moveTo(64,0);x.lineTo(64,128);x.moveTo(0,64);x.lineTo(128,64);x.lineWidth=6;x.stroke();
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function markerTexture(kind,label){
 const c=document.createElement('canvas');c.width=256;c.height=320;const x=c.getContext('2d');
 x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(128,300,40,10,0,0,Math.PI*2);x.fill();
 const color=kind==='locked'?'#3a3337':kind==='done'?'#2b443b':'#6e101c';
 x.fillStyle='#f5f3ed';x.beginPath();x.arc(128,118,104,0,Math.PI*2);x.fill();
 x.fillStyle=color;x.beginPath();x.arc(128,118,92,0,Math.PI*2);x.fill();
 x.beginPath();x.moveTo(98,200);x.lineTo(158,200);x.lineTo(128,286);x.closePath();x.fillStyle='#f5f3ed';x.fill();
 x.fillStyle='#f5f3ed';x.textAlign='center';x.textBaseline='middle';
 if(kind==='locked'){x.font='bold 120px Georgia';x.fillText('?',128,124);}
 else if(kind==='done'){x.lineWidth=18;x.strokeStyle='#f5f3ed';x.lineCap='round';x.beginPath();x.moveTo(84,120);x.lineTo(116,150);x.lineTo(176,86);x.stroke();}
 else{x.font='bold 44px "Noto Serif SC",Georgia';x.fillText(label,128,104);x.font='26px "Courier New"';x.fillText('ENTER',128,148);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export class Diorama{
 constructor(game){this.game=game;this.root=new THREE.Group();this.root.name='TwinPeaks_Diorama';this.items=[];this.sets={};this.shells={};this.markers={};this.id='diner';this.built=false;this.layer='town';this.open=null;this.time=0;}
 build(){
  this.buildValley();this.buildTown();this.built=true;this.refresh();
 }
 // ---------- Layer 0: the valley ----------
 buildValley(){
  const v=new THREE.Group();v.name='Valley';this.root.add(v);this.valley=v;
  const R=150,rings=90,segs=180,pos=[],col=[],idx=[];
  const peak=(x,z,cx,cz,h,s)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(2*s*s));
  const hill=(x,z)=>{const r=Math.hypot(x,z);const flat=THREE.MathUtils.smoothstep(r,24,60);
   let y=flat*(4+Math.sin(x*.07)*3+Math.cos(z*.06+1)*3+Math.sin((x+z)*.13)*1.5)+peak(x,z,-42,-118,92,20)+peak(x,z,38,-112,84,19)+peak(x,z,-95,-60,40,24)+peak(x,z,100,-55,46,26)+peak(x,z,-110,40,22,20)+peak(x,z,115,50,26,22);
   // River valley carved from the falls down to the east.
   const rz=-38+x*.15,rv=Math.exp(-((z-rz)**2)/30)*(x>-58?1:0);y-=rv*4*flat;
   return y-.42;};
  this.height=hill;const C=new THREE.Color(),grass=new THREE.Color('#2f3d2c'),moss=new THREE.Color('#47513a'),rock=new THREE.Color('#5d5a55'),snow=new THREE.Color('#e9ebe8');
  for(let i=0;i<=rings;i++){const r=R*i/rings;for(let j=0;j<segs;j++){const a=j/segs*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r;let y=hill(x,z);if(i===rings)y=-8;
   pos.push(x,y,z);const n=Math.sin(x*.4)*Math.cos(z*.37)*.5+.5;C.copy(grass).lerp(moss,n*.6);if(y>18)C.lerp(rock,THREE.MathUtils.smoothstep(y,18,40));if(y>52)C.lerp(snow,THREE.MathUtils.smoothstep(y+n*8,52,64));if(i===rings)C.set('#1d1a17');col.push(C.r,C.g,C.b);}}
  for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){const a=i*segs+j,b=i*segs+(j+1)%segs,c=(i+1)*segs+j,d=(i+1)*segs+(j+1)%segs;if(i===0){idx.push(a,c,d);continue;}idx.push(a,c,b,b,c,d);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:false}));ground.receiveShadow=true;ground.name='ValleyTerrain';v.add(ground);
  // Hide terrain beneath the town plinth.
  // Plinth: an oxblood drum with a chevron band, the same language as the Red Room floor.
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(R,R+3,10,128,1,true),mat(M.base,.6));drum.position.y=-13;v.add(drum);
  const chev=chevronTexture(512,T.pattern.chevron.bands);chev.wrapS=THREE.RepeatWrapping;chev.repeat.set(60,1);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(R+.15,R+.15,2.4,128,1,true),new THREE.MeshStandardMaterial({map:chev,roughness:.6}));band.position.y=-9.2;v.add(band);
  const cap=new THREE.Mesh(new THREE.CircleGeometry(R+3,96),mat('#140b0e'));cap.rotation.x=Math.PI/2;cap.position.y=-18;v.add(cap);
  // Douglas firs: three stacked cones per tree, instanced, two tones.
  const fir=new THREE.ConeGeometry(1,2.2,7);fir.translate(0,1.1,0);const firMat=mat('#ffffff',.9);const trunkGeo=new THREE.CylinderGeometry(.12,.18,1,6);trunkGeo.translate(0,.5,0);
  const N=2600,trees=new THREE.InstancedMesh(fir,firMat,N*2),trunks=new THREE.InstancedMesh(trunkGeo,mat('#3b2a20'),N);const d=new THREE.Object3D();let k=0,tk=0;
  const tone=[new THREE.Color('#1f3327'),new THREE.Color('#2b443b'),new THREE.Color('#263a2c'),new THREE.Color('#33402f')];
  for(let i=0;i<N*3&&tk<N;i++){const a=rnd()*Math.PI*2,r=26+Math.sqrt(rnd())*118,x=Math.cos(a)*r,z=Math.sin(a)*r;const y=hill(x,z);if(y>46||y<-1)continue;
   if(Math.abs(x-this.roadX(z))<5&&z>10)continue;if(Math.abs(z-(-38+x*.15))<4&&x>-58)continue;
   const s=1.1+rnd()*1.6;d.position.set(x,y,z);d.rotation.set(0,rnd()*6,0);d.scale.set(1,s,1);d.updateMatrix();trunks.setMatrixAt(tk++,d.matrix);
   const c=tone[(rnd()*4)|0];for(const [lift,w] of [[.6,1.25],[2.1,.9]]){d.position.set(x,y+lift*s,z);d.scale.set(w*s*.75,s*.9,w*s*.75);d.updateMatrix();trees.setMatrixAt(k,d.matrix);trees.setColorAt(k++,c);}}
  trees.count=k;trunks.count=tk;trees.castShadow=true;v.add(trees,trunks);
  // Road from the town to the plinth edge, with the welcome sign beside it.
  const pts=[];for(let z=13;z<=148;z+=2)pts.push(new THREE.Vector3(this.roadX(z),0,z));
  const rp=[],ri=[];pts.forEach((p,i)=>{for(const s of [-1.2,1.2]){const x=p.x+s;rp.push(x,hill(x,p.z)+.06,p.z);}if(i){const b=(i-1)*2;ri.push(b,b+2,b+1,b+1,b+2,b+3);}});
  const road=new THREE.BufferGeometry();road.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));road.setIndex(ri);road.computeVertexNormals();v.add(new THREE.Mesh(road,mat(M.road,.7)));
  const sg=new THREE.Group();const sx=this.roadX(34)+5.2;sg.position.set(sx,hill(sx,34),34);sg.rotation.y=-.5;v.add(sg);
  for(const px of [-1.5,1.5]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,2.4,8),mat('#4a3423'));post.position.set(px,1.2,0);sg.add(post);}
  const board=new THREE.Mesh(new RoundedBoxGeometry(4.2,1.7,.16,2,.08),[mat('#5b3b26'),mat('#5b3b26'),mat('#5b3b26'),mat('#5b3b26'),new THREE.MeshStandardMaterial({map:this.welcomeTexture(),roughness:.8}),mat('#5b3b26')]);board.position.y=2.6;sg.add(board);this.welcome=sg;
  // Falls, river and sawmill: the town's other landmark.
  const cliff=new THREE.Mesh(new THREE.DodecahedronGeometry(14,1),mat('#4e4a44',1,{flatShading:true}));cliff.scale.set(1.5,1.05,.8);cliff.position.set(-66,hill(-66,-50)-5,-50);v.add(cliff);
  this.fallsMat=new THREE.ShaderMaterial({transparent:true,uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uTime;float h(float x){return fract(sin(x*91.7)*437.5);}void main(){float col=floor(vUv.x*38.);float s=fract(vUv.y*3.+uTime*(1.2+h(col)*.8)+h(col));float a=mix(.55,.95,smoothstep(.2,.9,s));vec3 c=mix(vec3(.62,.74,.76),vec3(.96,.98,.97),s);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(1.,.92,vUv.x);gl_FragColor=vec4(c,a*edge);}'});
  const falls=new THREE.Mesh(new THREE.PlaneGeometry(7,15,1,1),this.fallsMat);falls.position.set(-54.5,hill(-54,-41)+7.5,-41);falls.rotation.y=1.0;v.add(falls);
  const river=[],rIdx=[];for(let x=-56,i=0;x<=140;x+=3,i++){const z=-38+x*.15;for(const s of [-2,2])river.push(x,hill(x,z)+.25,z+s);if(i){const b=(i-1)*2;rIdx.push(b,b+2,b+1,b+1,b+2,b+3);}}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(river,3));rg.setIndex(rIdx);rg.computeVertexNormals();v.add(new THREE.Mesh(rg,new THREE.MeshStandardMaterial({color:'#4b6f78',roughness:.12,metalness:.3,emissive:'#1c2f35',emissiveIntensity:.6})));
  const mill=new THREE.Group();mill.position.set(-24,hill(-24,-36),-30);mill.rotation.y=.2;v.add(mill);
  const millBody=new THREE.Mesh(new THREE.BoxGeometry(10,4,5),mat('#6b5545'));millBody.position.y=2;mill.add(millBody);const millRoof=new THREE.Mesh(new THREE.CylinderGeometry(.01,3.6,10.4,4,1),mat('#3b2f2a'));millRoof.rotation.z=Math.PI/2;millRoof.rotation.x=Math.PI/4;millRoof.scale.set(1,1,.75);millRoof.position.y=4.9;mill.add(millRoof);
  const stack=new THREE.Mesh(new THREE.CylinderGeometry(.5,.7,9,12),mat('#5a4038'));stack.position.set(3.5,5.5,0);mill.add(stack);
  this.smoke=[];for(let i=0;i<10;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshStandardMaterial({color:'#9b9a97',transparent:true,opacity:.35,depthWrite:false}));p.userData.offset=i/10;mill.add(p);this.smoke.push(p);}this.smokeOrigin=new THREE.Vector3(3.5,10,0);
  // Low cloud banks drift around the twin peaks.
  this.clouds=[];const cloudMat=new THREE.MeshStandardMaterial({color:'#c9ccd0',transparent:true,opacity:.42,depthWrite:false,roughness:1});
  for(let i=0;i<14;i++){const cl=new THREE.Group();for(let j=0;j<5;j++){const s=new THREE.Mesh(new THREE.SphereGeometry(4+rnd()*4,12,8),cloudMat);s.position.set(j*5-10,rnd()*2,rnd()*4);s.scale.y=.45;cl.add(s);}cl.position.set(-120+i*18,66+rnd()*14,-70+rnd()*60);cl.userData.speed=.6+rnd()*.8;v.add(cl);this.clouds.push(cl);}
  // Valley-only dusk light so the far slopes and snow read from the top layer.
  const dusk=new THREE.DirectionalLight('#b9c6d8',1.6);dusk.position.set(60,120,90);v.add(dusk);const rim=new THREE.DirectionalLight('#d9897a',.9);rim.position.set(-80,40,-120);v.add(rim);
  const twin=new THREE.Mesh(new THREE.PlaneGeometry(30,6),new THREE.MeshBasicMaterial({map:signTexture(['TWIN PEAKS'],{fg:'#f5f3ed',bg:'rgba(0,0,0,0)',font:'bold 120px Georgia'}),transparent:true,depthWrite:false}));twin.visible=false;this.twinLabel=twin;
 }
 roadX(z){return Math.sin(z*.035)*9;}
 welcomeTexture(){const c=document.createElement('canvas');c.width=1024;c.height=420;const x=c.getContext('2d');x.fillStyle='#2b443b';x.fillRect(0,0,1024,420);x.strokeStyle='#e8dcc0';x.lineWidth=12;x.strokeRect(18,18,988,384);
  x.fillStyle='#9fb0a3';x.beginPath();x.moveTo(120,300);x.lineTo(330,90);x.lineTo(470,250);x.lineTo(600,120);x.lineTo(900,300);x.closePath();x.fill();x.fillStyle='#e8ebe6';x.beginPath();x.moveTo(290,130);x.lineTo(330,90);x.lineTo(372,138);x.closePath();x.fill();x.beginPath();x.moveTo(565,155);x.lineTo(600,120);x.lineTo(640,152);x.closePath();x.fill();
  x.fillStyle='#f2e6c9';x.textAlign='center';x.font='bold 50px Georgia';x.fillText('WELCOME TO',512,70);x.font='bold 104px Georgia';x.fillText('TWIN PEAKS',512,350);x.font='28px "Courier New"';x.fillText('POPULATION 51,201',512,396);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
 // ---------- Layer 1: the town plinth and building shells ----------
 buildTown(){
  const g=this.game;const town=new THREE.Group();town.name='TownPlinth';this.root.add(town);this.town=town;
  const block=(w,h,d,x,y,z,color,r=.15,parent=town)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat(color));m.position.set(x,y,z);m.receiveShadow=m.castShadow=true;parent.add(m);return m;};
  block(23,.65,28,0,-.02,-.8,M.base,.25);block(22.85,.12,27.85,0,.34,-.8,M.rim,.12);block(22.6,.09,27.6,0,.42,-.8,M.ground,.08);
  block(1.45,.025,25.5,0,.48,-.7,M.road,.025);block(19,.028,1.15,0,.482,.05,M.road,.025);
  for(let z=-12;z<12;z+=1.35)block(.06,.008,.52,0,.5,z,M.roadMark,.005);for(let x=-9;x<9;x+=1.4)block(.5,.008,.055,x,.503,.05,M.roadMark,.005);
  for(const [id,cfg] of Object.entries(SETS)){
   if(id!=='woods')block(id==='diner'?6.25:id==='lodge'?6.1:4.9,.12,id==='diner'?8.05:id==='lodge'?6.6:4.9,cfg.pos[0],.53,cfg.pos[2],M.rim,.07);
   const set=new CutawaySet(g,id);set.build();set.root.scale.setScalar(cfg.scale);set.root.position.set(...cfg.pos);town.add(set.root);this.sets[id]=set;set.root.traverse(o=>o.userData.place=id);
   for(const it of set.items){it.place=id;const action=it.action;it.action=()=>{if(this.layer!=='set'||this.open!==id)return this.game.dive(id);g.state.place=id;g.save();this.id=id;g.camera.focus(this.center(it),it.id.startsWith('npc:')?T.camera.npcDistance*.6:T.camera.propDistance*.6);g.ambience();action();};this.items.push(it);}
   this.shells[id]=this.shell(id,cfg);const mk=new THREE.Sprite(new THREE.SpriteMaterial({depthTest:false,transparent:true}));mk.scale.set(1.3,1.62,1);mk.position.set(cfg.pos[0],cfg.pos[1]+cfg.shell[1]+1.6,cfg.pos[2]);mk.renderOrder=10;mk.userData.place=id;town.add(mk);this.markers[id]={sprite:mk,kind:null};
  }
  // Traffic light over the crossroads, swinging on its wire.
  const wire=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,5,6),mat('#111'));wire.rotation.z=Math.PI/2;wire.position.set(0,3.2,.05);town.add(wire);
  for(const x of [-2.5,2.5]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,2.8,10),mat('#2c2a28'));pole.position.set(x,1.85,.05);town.add(pole);}
  const tl=new THREE.Group();tl.position.set(0,3.2,.05);town.add(tl);const housing=new THREE.Mesh(new RoundedBoxGeometry(.32,.86,.32,2,.04),mat('#d7b23a',.5));housing.position.y=-.55;tl.add(housing);
  this.lamps=[];for(const [i,c] of ['#ff3b2f','#ffb02e','#3bdc7a'].entries()){const l=new THREE.Mesh(new THREE.SphereGeometry(.085,16,10),new THREE.MeshStandardMaterial({color:'#222',emissive:c,emissiveIntensity:i===0?2.4:.05}));l.position.set(0,-.3-i*.25,.17);tl.add(l);this.lamps.push(l);}this.traffic=tl;
  // Background houses, parked cars and street firs make the plinth a place, not a board.
  const houses=[[-1.9,-11.5,0],[2.2,-11.6,0],[-10,.6,1.57],[10,.9,-1.57],[2.3,10.8,3.14],[-2.4,11.2,3.14]];
  for(const [x,z,r] of houses){const h=new THREE.Group();h.position.set(x,.5,z);h.rotation.y=r;town.add(h);const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,1,1.4),mat(['#d8cdb8','#7b5a48','#8a9b90'][(Math.abs(x*3)|0)%3]));body.position.y=.5;body.castShadow=true;h.add(body);const roof=new THREE.Mesh(new THREE.CylinderGeometry(.01,1.15,1.95,4,1),mat('#3a2f2c'));roof.rotation.set(0,Math.PI/4,0);roof.scale.set(1,.45,.85);roof.position.y=1.28;h.add(roof);for(const dx of [-.45,.45]){const w=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3),new THREE.MeshBasicMaterial({map:windowTexture(true)}));w.position.set(dx,.55,.701);h.add(w);}}
  const carMat=['#8c2f2f','#3e5d6b','#d8cdb8'];[[1.1,-7.5,0],[-1.05,7.6,Math.PI],[3.4,.7,Math.PI/2]].forEach(([x,z,r],i)=>{const car=new THREE.Group();car.position.set(x,.5,z);car.rotation.y=r;town.add(car);const b=new THREE.Mesh(new RoundedBoxGeometry(.5,.22,1.1,2,.08),mat(carMat[i],.35,{metalness:.4}));b.position.y=.16;car.add(b);const top=new THREE.Mesh(new RoundedBoxGeometry(.44,.18,.55,2,.07),mat('#1a2024',.2,{metalness:.5}));top.position.set(0,.33,-.05);car.add(top);for(const dx of [-.23,.23])for(const dz of [-.33,.33]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.06,12),mat('#111'));w.rotation.z=Math.PI/2;w.position.set(dx,.08,dz);car.add(w);}});
  const fir=new THREE.ConeGeometry(.45,1.3,7);fir.translate(0,.65,0);const firs=new THREE.InstancedMesh(fir,mat('#24382c',.9),120);const dm=new THREE.Object3D();let n=0;
  for(let i=0;i<400&&n<120;i++){const x=(rnd()-.5)*22,z=(rnd()-.5)*27-.8;if(Math.abs(x)<1.6||Math.abs(z-.05)<1.4)continue;if(Object.values(SETS).some(s=>Math.abs(x-s.pos[0])<s.shell[0]/2+.5&&Math.abs(z-s.pos[2])<s.shell[2]/2+.5))continue;if(houses.some(([hx,hz])=>Math.hypot(x-hx,z-hz)<1.6))continue;if(Math.abs(x)<10.8&&Math.abs(z+.8)<13.3&&Math.abs(x)>9.6||Math.abs(z+.8)>12.4){const s=.7+rnd()*.7;dm.position.set(x,.47,z);dm.scale.set(s,s*(1+rnd()*.4),s);dm.updateMatrix();firs.setMatrixAt(n++,dm.matrix);}}
  firs.count=n;firs.castShadow=true;town.add(firs);
  // Street lamps: lit only along the stretch the investigation has reached.
  this.streetLamps=[];const dark=mat('#273f36',.45);for(const z of [-10,-5,4,10])for(const x of [-1.2,1.2]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.2,12),dark);pole.position.set(x,1.08,z);town.add(pole);const lantern=new THREE.Mesh(new THREE.BoxGeometry(.16,.2,.16),new THREE.MeshStandardMaterial({color:'#f5d595',emissive:'#efc06d',emissiveIntensity:.6}));lantern.position.set(x,1.75,z);lantern.userData.z=z;town.add(lantern);this.streetLamps.push(lantern);}
  const ambient=new THREE.HemisphereLight(M.hemisphereSky,M.hemisphereGround,M.hemisphereIntensity);this.root.add(ambient);
  const sun=new THREE.DirectionalLight(M.sunColor,M.sunIntensity);sun.position.set(-9,22,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:24,bottom:-24,near:.5,far:70});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;this.root.add(sun);
  const fill=new THREE.DirectionalLight(M.fillColor,M.fillIntensity);fill.position.set(10,12,-8);this.root.add(fill);
 }
 shell(id,cfg){
  const [w,h,d]=cfg.shell,g=new THREE.Group();g.position.set(cfg.pos[0],cfg.pos[1],cfg.pos[2]);g.name='Shell_'+id;this.town.add(g);const parts=[];
  const add=(m)=>{m.castShadow=m.receiveShadow=true;m.material.transparent=true;g.add(m);parts.push(m);m.userData.place=id;return m;};
  const lit=windowTexture(true),dark=windowTexture(false);g.userData.windows=[];
  const windows=(face,count,y,size,offset)=>{for(let i=0;i<count;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(size[0],size[1]),new THREE.MeshStandardMaterial({map:lit,emissive:'#ffb866',emissiveMap:lit,emissiveIntensity:1,transparent:true}));const t=(i+.5)/count-.5;
   if(face==='front'){m.position.set(t*w*.85,y,d/2+.012);}else if(face==='back'){m.position.set(t*w*.85,y,-d/2-.012);m.rotation.y=Math.PI;}else if(face==='left'){m.position.set(-w/2-.012,y,t*d*.85);m.rotation.y=-Math.PI/2;}else{m.position.set(w/2+.012,y,t*d*.85);m.rotation.y=Math.PI/2;}
   m.userData.lit=lit;m.userData.dark=dark;add(m);g.userData.windows.push(m);}};
  if(id==='diner'){
   add(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.06),mat('#d9cfbb',.7))).position.y=h/2;
   const stripe=add(new THREE.Mesh(new THREE.BoxGeometry(w+.04,.18,d+.04),mat('#2b443b',.5)));stripe.position.y=h*.2;
   const roof=add(new THREE.Mesh(new RoundedBoxGeometry(w+.5,.2,d+.5,2,.08),mat('#3b3431',.6)));roof.position.y=h+.1;roof.userData.roof=true;
   windows('right',5,h*.58,[1.05,.62]);windows('left',4,h*.58,[.9,.62]);windows('front',2,h*.58,[1.1,.62]);
   const sign=add(new THREE.Mesh(new THREE.BoxGeometry(3.2,.8,.08),[mat('#1a1a1a'),mat('#1a1a1a'),mat('#1a1a1a'),mat('#1a1a1a'),new THREE.MeshStandardMaterial({map:signTexture(['DOUBLE R','DINER · PIE · COFFEE'],{bg:'#f2e6c9',fg:'#6e101c',border:'#6e101c'}),emissive:'#ffffff',emissiveIntensity:.25,emissiveMap:signTexture(['DOUBLE R','DINER · PIE · COFFEE'],{bg:'#f2e6c9',fg:'#6e101c',border:'#6e101c'})}),mat('#1a1a1a')]));sign.position.set(0,h+.85,d*.15);sign.rotation.y=Math.PI/2;sign.userData.roof=true;
  }else if(id==='lodge'){
   add(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.05),mat('#6b4a33',.85))).position.y=h/2;
   for(let i=0;i<9;i++){const log=add(new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,w+.06,10),mat('#5a3d29',.9)));log.rotation.z=Math.PI/2;log.position.set(0,.15+i*h/9,d/2+.03);}
   const roofA=add(new THREE.Mesh(new THREE.BoxGeometry(w+.6,.16,d*.62),mat('#2f2724',.7)));roofA.position.set(0,h+.7,-d*.25);roofA.rotation.x=.5;roofA.userData.roof=true;
   const roofB=add(new THREE.Mesh(new THREE.BoxGeometry(w+.6,.16,d*.62),mat('#2f2724',.7)));roofB.position.set(0,h+.7,d*.25);roofB.rotation.x=-.5;roofB.userData.roof=true;
   const gable=new THREE.Shape();gable.moveTo(-d/2,0);gable.lineTo(0,1.45);gable.lineTo(d/2,0);gable.closePath();for(const s of [-1,1]){const gm=add(new THREE.Mesh(new THREE.ShapeGeometry(gable),mat('#6b4a33',.85,{side:THREE.DoubleSide})));gm.rotation.y=Math.PI/2;gm.position.set(s*w/2,h,0);gm.userData.roof=true;}
   const chimney=add(new THREE.Mesh(new THREE.BoxGeometry(.6,2.6,.6),mat('#77706a',1)));chimney.position.set(-w*.3,h+.9,-d*.3);chimney.userData.roof=true;
   windows('front',5,h*.62,[.6,.55]);windows('front',5,h*.25,[.6,.5]);windows('right',4,h*.6,[.6,.55]);
   const sign=add(new THREE.Mesh(new THREE.PlaneGeometry(3.4,.62),new THREE.MeshStandardMaterial({map:signTexture(['THE GREAT NORTHERN'],{bg:'#2b2119',fg:'#e1ac6c',font:'bold 84px Georgia'}),transparent:true})));sign.position.set(0,h+.25,d/2+.2);sign.userData.roof=true;
  }else if(id==='woods'){
   // Low mist and a ring of stakes keep the clearing hidden until the key is found.
   const mist=new THREE.MeshStandardMaterial({color:'#b8c4c2',transparent:true,opacity:.5,depthWrite:false,roughness:1});
   for(let i=0;i<22;i++){const s=add(new THREE.Mesh(new THREE.SphereGeometry(1.2+rnd()*1.1,14,10),mist));s.position.set((rnd()-.5)*w*.8,.5+rnd()*.9,(rnd()-.5)*d*.8);s.scale.y=.4;s.userData.mist=true;}
  }else{
   const velvet=curtainMaterial(T.color.red,{time:{value:0}});const tent=add(new THREE.Mesh(new THREE.CylinderGeometry(w*.5,w*.56,h,48,1,true),velvet));tent.position.y=h/2;tent.material.side=THREE.DoubleSide;
   const lid=add(new THREE.Mesh(new THREE.ConeGeometry(w*.6,1.2,48),mat('#2a0a10',.8)));lid.position.y=h+.6;lid.userData.roof=true;
   const chev=chevronTexture(512,T.pattern.chevron.bands);chev.wrapS=THREE.RepeatWrapping;chev.repeat.set(10,1);const ring=add(new THREE.Mesh(new THREE.CylinderGeometry(w*.57,w*.57,.3,48,1,true),new THREE.MeshStandardMaterial({map:chev})));ring.position.y=.15;
  }
  g.userData.parts=parts;g.userData.lift=0;g.userData.target=0;return g;
 }
 // ---------- state ----------
 refresh(){
  const s=this.game.state;
  for(const id of ORDER){const st=placeStatus(s,id),shell=this.shells[id];shell.userData.status=st;
   for(const w of shell.userData.windows){const on=st!=='locked';w.material.map=on?w.userData.lit:w.userData.dark;w.material.emissiveIntensity=on?1:0;w.material.needsUpdate=true;}
   const set=this.sets[id];set.root.visible=st!=='locked'||this.open===id;
   const mk=this.markers[id];if(mk.kind!==st){mk.kind=st;mk.sprite.material.map?.dispose();mk.sprite.material.map=markerTexture(st,PLACES[id].name.replace(/\s/g,'').slice(0,4));mk.sprite.material.needsUpdate=true;}
  }
  const reach=ORDER.filter(id=>placeStatus(s,id)!=='locked').length;
  for(const l of this.streetLamps){const on=reach>=4||(reach>=3?true:reach>=2?l.userData.z>-6:l.userData.z>0);l.material.emissiveIntensity=on?1.6:0;l.material.color.set(on?'#f5d595':'#3a3633');}
 }
 setLayer(layer,open=null){this.layer=layer;this.open=open;for(const id of ORDER){const shell=this.shells[id];shell.userData.target=layer==='set'&&open===id?1:0;this.markers[id].sprite.visible=layer==='town';}
  this.valley.visible=layer==='valley'||this.keepValley===true;this.refresh();
  const g=this.game;g.engine.scene.fog=layer==='valley'?new THREE.FogExp2('#2a2b33',.0019):null;g.engine.scene.background=new THREE.Color(layer==='valley'?'#22232b':M.backdrop);g.engine.u.uTilt.value=g.settings.reducedMotion?0:layer==='valley'?.55:layer==='town'?.75:.6;
  Object.assign(g.camera.controls,layer==='valley'?{maxDistance:430,minDistance:40,maxTargetRadius:160}:{maxDistance:T.camera.maxDistance,minDistance:layer==='set'?1.4:T.camera.minDistance,maxTargetRadius:25});}
 center(it){this.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(it.mesh).getCenter(new THREE.Vector3());}
 setBox(id){this.root.updateMatrixWorld(true);const c=SETS[id];const [w,h,d]=c.shell;return new THREE.Box3(new THREE.Vector3(c.pos[0]-w/2,c.pos[1],c.pos[2]-d/2),new THREE.Vector3(c.pos[0]+w/2,c.pos[1]+h*.8,c.pos[2]+d/2));}
 // Where the 1:1 room's spawn point sits inside the miniature — the dive ends here.
 spawnPoint(id){const set=this.sets[id];this.root.updateMatrixWorld(true);return set.root.localToWorld(new THREE.Vector3(...set.spawn));}
 mount(){if(!this.built)this.build();const g=this.game;g.engine.scene.add(this.root);g.engine.scene.background=new THREE.Color(M.backdrop);g.engine.scene.environment=null;g.engine.renderer.toneMappingExposure=T.lighting.roomExposure;g.engine.renderer.shadowMap.enabled=g.engine.qualityName!=='low';}
 update(dt,t){
  this.time=t;for(const set of Object.values(this.sets))if(set.root.visible)set.update(dt,t);
  for(const id of ORDER){const sh=this.shells[id],u=sh.userData;u.lift+=(u.target-u.lift)*(1-Math.exp(-dt*3.2));const L=u.lift;
   const ghost=this.layer==='set'&&this.open!==id?.22:1;u.ghost=(u.ghost??1)+(ghost-(u.ghost??1))*(1-Math.exp(-dt*4));for(const p of u.parts){p.material.opacity=Math.max(0,1-L*1.25)*(p.userData.mist?(u.status==='locked'?.5:0):1)*u.ghost;p.material.depthWrite=u.ghost>.9&&L<.05;p.visible=p.material.opacity>.02;}
   sh.position.y=SETS[id].pos[1]+L*2.4*(id==='woods'?0:1);if(id==='woods')sh.scale.setScalar(1+L*.6);
   const mk=this.markers[id].sprite;mk.position.y=SETS[id].pos[1]+SETS[id].shell[1]+1.5+Math.sin(t*2+ORDER.indexOf(id))*.12*(this.game.settings.reducedMotion?0:1);}
  if(this.traffic){this.traffic.rotation.z=Math.sin(t*.9)*.08;this.traffic.rotation.x=Math.sin(t*.6+1)*.05;const phase=Math.floor(t/3)%3;this.lamps.forEach((l,i)=>l.material.emissiveIntensity=i===(2-phase)?2.6:.05);}
  if(this.fallsMat)this.fallsMat.uniforms.uTime.value=t;
  for(const cl of this.clouds??[]){cl.position.x+=dt*cl.userData.speed;if(cl.position.x>140)cl.position.x=-140;}
  for(const p of this.smoke??[]){const k=(t*.12+p.userData.offset)%1;p.position.copy(this.smokeOrigin).add(new THREE.Vector3(k*6,k*10,Math.sin(k*5)*1.2));p.scale.setScalar(.6+k*2.2);p.material.opacity=.35*(1-k);}
 }
 collide(){}
}
