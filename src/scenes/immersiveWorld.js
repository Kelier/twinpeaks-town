import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {TwinPeaksWorld} from './twinPeaksWorld.js';
import T from '../design/tokens.json';
import {placeEnvironment} from './env/environment.js';
import * as TX from './env/textures.js';
import * as FX from './env/atmosphere.js';
import * as P from './env/props.js';

const mat=(color,roughness=.6,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const IM=T.immersive;
const conf=id=>({envIntensity:.5,hemiScale:1,...IM[id]});
const UP=new THREE.Vector3(0,1,0);

// Additive reflection layer for the red room's polished floor (high quality only): the lit chevron
// floor stays a normal PBR surface and this adds a soft, fresnel-weighted mirror image on top.
const FloorReflectShader={
 name:'FloorReflect',
 uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},uStrength:{value:.3}},
 vertexShader:`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vW;void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 color;uniform sampler2D tDiffuse;uniform float uStrength;varying vec4 vUv;varying vec3 vW;
  void main(){vec2 uv=vUv.xy/vUv.w;float o=.0035;vec3 c=texture2D(tDiffuse,uv).rgb*.36+(texture2D(tDiffuse,uv+vec2(o,0.)).rgb+texture2D(tDiffuse,uv-vec2(o,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,o)).rgb+texture2D(tDiffuse,uv-vec2(0.,o)).rgb)*.16;
   vec3 V=normalize(cameraPosition-vW);float fres=.35+.65*pow(1.-max(V.y,0.),2.5);gl_FragColor=vec4(c*color*uStrength*fres,1.);}`,
};

export class ImmersiveWorld extends TwinPeaksWorld{
 build(){
  this.quality=this.game.engine.qualityName||'medium';this.anim=[];this.billboards=[];this.headBob=true;
  super.build();this.root.name='Immersive_'+this.id;this.detail();this.enrich();this.items.forEach(it=>it.place=this.id);
  this.root.traverse(o=>{o.userData.place=this.id;if(o.material?.map&&!o.material.bumpMap&&!o.material.transparent&&o.material.roughness>.5&&!o.isPoints){o.material.bumpMap=o.material.map;o.material.bumpScale=.012;}});
 }
 // Material upgrade runs before the base geometry is built so every shared material benefits.
 upgradeMaterials(){
  const w=TX.woodSet({},[2,2]);Object.assign(this.wood,{map:w.map,roughnessMap:w.roughnessMap,bumpMap:w.bumpMap,bumpScale:1.2,roughness:.95});this.wood.color.set('#d8c4b0');
  this.leather=new THREE.MeshPhysicalMaterial({color:'#7a2c35',roughness:.38,clearcoat:.55,clearcoatRoughness:.32,sheen:.35,sheenColor:new THREE.Color('#ff9a9a'),sheenRoughness:.5});
  this.chrome=new THREE.MeshStandardMaterial({color:'#d6d8d2',metalness:1,roughness:.16});
  this.cream=new THREE.MeshPhysicalMaterial({color:'#d9c7a5',roughness:.42,clearcoat:.45,clearcoatRoughness:.25});
  this.green=new THREE.MeshPhysicalMaterial({color:this.green.color,roughness:.45,clearcoat:.4,clearcoatRoughness:.3});
 }
 diner(){this.upgradeMaterials();super.diner();}
 lodge(){this.upgradeMaterials();super.lodge();}
 woods(){this.upgradeMaterials();super.woods();}
 redroom(){this.upgradeMaterials();super.redroom();}
 detail(){
  const brass=mat('#aa8853',.28,.8),black=mat('#17151a',.4),cream=mat('#e2dac8',.7);this.detailLights=[];this.brass=brass;
  const tube=(pts,r,m)=>this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),48,r,8,false),m);
  const panel=(x,z,w=1.2,h=1.6)=>{this.box(w+.16,h+.16,.09,x,2.3,z,brass);this.box(w,h,.1,x,2.3,z+.012,mat('#1e2725'));for(let i=0;i<9;i++){const tree=this.mesh(new THREE.ConeGeometry(.08+i*.004,.5+(i%3)*.2,7),mat('#3f5048'),x-w*.4+i*w*.1,2.2,z+.07);tree.scale.z=.08;}};
  if(this.id==='diner'){
   for(const y of [1.65,2.25,2.85]){this.box(1.35,.07,8,6.15,y,-2,this.wood,this.root,.025);for(let i=0;i<11;i++){const z=-5.5+i*.68;this.cup(6.1,y+.04,z);}}
   for(let i=0;i<12;i++){const z=-6+i;this.box(.035,.72,.08,4.08,.57,z,brass);}
   for(const z of [3.7,-.6,-4.9]){this.box(.18,.25,.11,-4.3,1.11,z-.22,this.chrome,this.root,.025);for(let j=0;j<5;j++)this.box(.14,.12,.008,-4.3,1.25,z-.24+j*.012,cream);this.cyl(.06,.06,.19,-4.1,1.12,z+.2,mat('#981f2c',.3));}
   const glass=new THREE.MeshPhysicalMaterial({color:'#e4efec',transparent:true,opacity:.16,roughness:.04,metalness:0,clearcoat:1,clearcoatRoughness:.03,side:THREE.DoubleSide,depthWrite:false});this.domeGlass=glass;this.mesh(new THREE.SphereGeometry(.46,40,24,0,Math.PI*2,0,Math.PI/2),glass,4.9,1.25,.25).castShadow=false;this.cyl(.035,.04,.08,4.9,1.74,.25,brass);
   this.cyl(.42,.42,.08,-2,2.85,-8.78,brass).rotation.x=Math.PI/2;this.mesh(new THREE.CircleGeometry(.38,48),cream,-2,2.85,-8.72);for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=this.box(.018,.055,.014,-2+Math.sin(a)*.32,2.85+Math.cos(a)*.32,-8.70,black);tick.rotation.z=-a;}for(const [l,a]of [[.24,Math.PI*.6],[.17,Math.PI]]){const hand=this.box(.016,l,.016,-2+Math.sin(a)*l/2,2.85+Math.cos(a)*l/2,-8.68,black);hand.rotation.z=-a;}
   for(const z of [4,-1,-6])this.spot('#f4bd83',35,[.2,2.86,z],[.2,0,z],.9);
   for(let i=0;i<8;i++){const z=-8+i*2;this.box(.09,3.1,.055,-6.72,1.7,z,this.chrome);this.cyl(.14,.28,7,-8.4,3,z,mat('#101d1d'));}
  }
  if(this.id==='lodge'){
   for(const x of [-6.32,6.32])for(let z=-6;z<7;z+=.7)this.box(.09,1,.57,x,.65,z,this.wood,this.root,.02);
   for(let i=0;i<12;i++){const z=-6+i;for(const x of [-5.8,5.8]){this.box(.16,.04,.4,x,1.19,z,brass);}}
   panel(-2.35,-6.68,1.4,1.75);panel(2.2,-6.68,1.15,1.5);
   for(let i=0;i<9;i++)this.cyl(.018,.018,.54,-5.12+i*.12,.48,-4.42,black);for(const y of [.23,.66])this.box(1.1,.025,.025,-4.65,y,-4.42,black);
   for(const x of [-5.32,-4]){this.cyl(.04,.07,.55,x,.3,-4.34,brass);this.mesh(new THREE.SphereGeometry(.075,16,12),brass,x,.61,-4.34);}
   for(let i=0;i<7;i++){const b=this.box(.065,.28+(i%3)*.045,.22,1.4+i*.075,1.4,-4.05,mat(['#502b2b','#283b35','#ad956c'][i%3]));b.rotation.z=(i-3)*.045;}
   this.box(1.5,3,.025,4.2,1.5,-6.82,mat('#08090b'));for(let i=0;i<5;i++){const w=1.35-i*.18,h=2.8-i*.3;this.box(.055,h,.035,4.2-w/2,h/2,-6.77+i*.012,this.wood);this.box(.055,h,.035,4.2+w/2,h/2,-6.77+i*.012,this.wood);this.box(w,.055,.035,4.2,h,-6.77+i*.012,this.wood);}
   this.sign(['315'],.3,.14,4.2,1.65,-6.7,'#a99478');this.spot('#edb16a',45,[0,4.1,-1],[0,0,-2],.85);
  }
  if(this.id==='woods'){
   const wet=new THREE.MeshPhysicalMaterial({color:'#2a3a3d',roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.75,depthWrite:false});for(let i=0;i<9;i++){const puddle=this.mesh(new THREE.CircleGeometry(.5+(i%3)*.2,40),wet,Math.sin(i*3.1)*2,.005,5-i*1.5);puddle.rotation.x=-Math.PI/2;puddle.scale.y=.38;}
   for(let i=0;i<7;i++){const x=(i%2?1:-1)*(4+i*.4),z=3-i*2;const log=this.cyl(.13,.19,2.3,x,.23,z,this.wood);log.rotation.z=1.4;log.rotation.y=i*.7;for(let j=0;j<3;j++)tube([[x,.2,z],[x+.3*j,.4,z+.25],[x+.5*j,.55,z+.4]],.025,this.wood);}
   const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.008,.025,.3,5),mat('#506148',.95),300);const d=new THREE.Object3D();for(let i=0;i<300;i++){d.position.set(Math.sin(i*2.39)*(3+(i%7)),.12,Math.cos(i*2.39)*12-4);d.rotation.set(Math.sin(i)*.3,i,.2);d.updateMatrix();stems.setMatrixAt(i,d.matrix);}this.root.add(stems);
   this.spot('#aacbd2',100,[4,9,-4],[-1,0,-3],.55);this.light('#853042',4,0,1.2,-7,8);
  }
  if(this.id==='redroom'){
   for(const x of [-1.8,1.8]){this.box(.77,.13,.68,x,.55,-1.35,mat('#29272b',.48),this.root,.06);for(const side of [-1,1])tube([[x+side*.4,.7,-.98],[x+side*.4,1.2,-1.6],[x+side*.4,1.23,-1.74]],.008,mat('#77716c'));
    for(const dx of [-.26,0,.26])for(const y of [.86,1.08]){this.mesh(new THREE.SphereGeometry(.018,12,8),black,x+dx,y,-1.615);}for(const dx of [-.42,.42])for(const z of [-1.75,-1.05])this.cyl(.045,.028,.2,x+dx,.12,z,brass);}
   this.floorLamps=[];for(const x of [-4.7,4.7]){this.cyl(.06,.11,1.75,x,.88,-3.9,brass);this.cyl(.2,.32,.1,x,.05,-3.9,brass);this.mesh(new THREE.CylinderGeometry(.24,.43,.6,40,1,true),new THREE.MeshStandardMaterial({color:'#d5c1a1',roughness:.9,side:THREE.DoubleSide,emissive:'#f3c58a',emissiveIntensity:.35}),x,1.95,-3.9);this.floorLamps.push(this.light('#f5cb93',8,x,1.7,-3.8,6));}
   this.spot('#e6d6c1',38,[0,3.8,1],[0,0,-1.5],.72);
  }
 }
 spot(color,power,from,to,angle){const l=new THREE.SpotLight(color,power,25,angle,.7,1.5);l.position.set(...from);l.target.position.set(...to);l.castShadow=true;l.shadow.mapSize.set(1024,1024);l.shadow.bias=-.0002;l.shadow.normalBias=.02;this.root.add(l,l.target);this.detailLights.push(l);return l;}

 // ------------------------------------------------------------------ helpers
 find(pred){const out=[];this.root.traverse(o=>{if(o.isMesh&&pred(o))out.push(o);});return out;}
 boxIs(o,w,h,d){const p=o.geometry?.parameters;return o.geometry?.type==='BoxGeometry'&&Math.abs(p.width-w)<1e-3&&Math.abs(p.height-h)<1e-3&&Math.abs(p.depth-d)<1e-3;}
 surface(m,set,color='#ffffff',bump=1){Object.assign(m,{map:set.map,roughnessMap:set.roughnessMap,bumpMap:set.bumpMap,bumpScale:bump,roughness:1});m.color.set(color);m.needsUpdate=true;}
 add(o,x=0,y=0,z=0){o.position.set(x,y,z);this.root.add(o);return o;}
 shaft(x,yTop,z,{top=.3,bottom=1.4,height=yTop,color='#ffd9a0',intensity=.25,power=1.6}={}){const m=FX.shaftCone(this.time,{top,bottom,height,color,intensity,power});m.position.set(x,yTop-height/2,z);this.root.add(m);return m;}
 // Wall–floor junction darkening: a floor strip and a wall strip, both alpha gradients.
 aoEdge(x,z,len,rotY,{floor=.75,wall=.7,opacity=.55}={}){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotY;this.root.add(g);const tex=TX.gradientStrip();
  const m=new THREE.MeshBasicMaterial({color:'#000000',map:tex,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const f=new THREE.Mesh(new THREE.PlaneGeometry(len,floor),m);f.rotation.x=-Math.PI/2;f.position.set(0,.012,floor/2);f.renderOrder=1;g.add(f);
  const w=new THREE.Mesh(new THREE.PlaneGeometry(len,wall),m.clone());w.material.opacity=opacity*.8;w.position.set(0,wall/2,.006);w.geometry.rotateZ(Math.PI);w.renderOrder=1;g.add(w);
  // PlaneGeometry uv.y=1 at +y; after rotateZ(PI) the opaque end sits at the wall/floor corner.
  return g;
 }
 blob(x,z,w,d,opacity=.5,y=.014){const b=P.contactBlob(w,d,opacity);b.position.set(x,y,z);this.root.add(b);return b;}
 steam(x,y,z,seed=0,scale=1){const m=new THREE.Mesh(new THREE.PlaneGeometry(.32*scale,.75*scale),FX.steamMaterial(this.time,{seed}));m.position.set(x,y+.36*scale,z);m.renderOrder=6;this.root.add(m);this.billboards.push(m);return m;}
 dust(opts){const lo=this.quality==='low',hi=this.quality==='high';const d=FX.dustMotes(this.time,{...opts,count:Math.round((opts.count||300)*(lo?.4:hi?1.5:1))});this.root.add(d);this.points=(this.points||[]).concat(d);return d;}

 enrich(){
  if(this.rainMesh)this.rainMesh.visible=false;
  const hemiScale=conf(this.id).hemiScale;this.root.traverse(o=>{if(o.isHemisphereLight)o.intensity*=hemiScale;});
  this['enrich_'+this.id]?.();
 }

 // ------------------------------------------------------------------ Double R diner
 enrich_diner(){
  const hi=this.quality==='high',lo=this.quality==='low';
  // Floor, ceiling and window glass.
  for(const o of this.find(o=>this.boxIs(o,14,.12,18)))this.surface(o.material,TX.linoleum([4,5]),'#ffffff',.6);
  for(const o of this.find(o=>this.boxIs(o,14,.15,18)))this.surface(o.material,TX.ceilingTiles([6,7.5]),'#80786a',.8);
  this.sweep={value:new THREE.Vector2(0,0)};const rainMat=FX.rainWindowMaterial(this.time,this.sweep);
  const panes=this.find(o=>this.boxIs(o,.02,1.75,2.6));for(const o of panes){o.material=rainMat;o.castShadow=false;}
  // Cherry pie replaces the plain cake under the dome.
  for(const o of this.find(o=>(o.geometry.type==='CylinderGeometry'&&Math.abs(o.geometry.parameters.radiusTop-.32)<1e-3&&Math.abs(o.position.y-1.33)<1e-3)||(this.boxIs(o,.62,.018,.055))))o.visible=false;
  const pie=this.add(P.cherryPie(),4.9,1.25,.25);pie.rotation.y=-.5;
  // DOUBLE R neon over the booths, with its red spill on the wood.
  const neon=this.add(P.neonSign('Double R','#ff3a46',2.3),-4.7,3.3,-8.88);this.neonGlow=neon.userData.glow;
  this.neonLight=this.light('#ff3341',5,-4.7,3.1,-8.2,6);
  this.anim.push(t=>{let k=1;if(!this.game.settings.reducedFlashing){const ph=t%11.3;k=ph>7.2&&ph<7.5?(Math.sin(t*90)>0?.35:1):.94+.06*Math.sin(t*37);}this.neonGlow[0].opacity=k;this.neonGlow[1].opacity=.45*k;this.neonLight.intensity=5*k;});
  // Two slow ceiling fans.
  for(const [x,z,s] of [[-2.6,1.2,.9],[1.9,-4.4,.75]]){const fan=this.add(P.ceilingFan(this.wood),x,3.98,z);const r=fan.userData.rotor;this.anim.push(t=>{r.rotation.y=t*s;});}
  // Volumetric cones under the three pendants and cold dawn sheets through the windows.
  for(const z of [4,-1,-6])this.shaft(.2,2.88,z,{top:.32,bottom:1.55,color:'#ffd29a',intensity:.2,power:1.3});
  if(!lo)for(const z of [4.5,1,-2.5,-6])this.windowSheets(z);
  // Passing headlights every ~17 s: glow travels across the panes and a beam rakes the room.
  const head=new THREE.SpotLight('#fff0d4',0,22,.42,.9,1.4);head.position.set(-11,1.3,8);head.target.position.set(-2,.6,4);this.root.add(head,head.target);
  this.anim.push(t=>{const ph=(t%17)/4.2;if(ph>=1||t<=0){this.sweep.value.y=0;head.intensity=0;return;}const z=9-ph*20;const k=Math.sin(ph*Math.PI);this.sweep.value.set(-z,k);head.intensity=140*k;head.position.set(-11,1.3,z+3);head.target.position.set(-3,.5,z-2);});
  // Steam over every coffee on a table or counter.
  [[-5.1,1.23,3.7],[-5.1,1.23,-.6],[-5.1,1.23,-4.9],[4.5,1.46,2.3]].forEach((p,i)=>this.steam(...p,i*1.7,.9));
  // Contact darkening.
  this.aoEdge(0,-8.92,14,0);this.aoEdge(-6.92,0,18,Math.PI/2);this.aoEdge(6.92,0,18,-Math.PI/2);
  this.aoEdge(5.2,5.32,1.9,0,{floor:.4,wall:.5,opacity:.45});this.aoEdge(4.14,-.8,12,-Math.PI/2,{floor:.5,wall:.35,opacity:.5});
  for(const z of [3.7,-.6,-4.9])this.blob(-4.85,z,2.8,2.6,.55);
  for(let i=0;i<7;i++)this.blob(3.05,4.1-i*1.55,.9,.9,.5);
  this.blob(-.6,-8.6,1.8,.6,.35);
  this.dust({count:320,min:[-6.6,.25,-8.6],max:[6.6,3.9,8],color:'#ffe0b0',lights:[[.2,1.9,4,1.3],[.2,1.9,-1,1.3],[.2,1.9,-6,1.3],[-5.6,1.8,1,1.6]]});
 }
 windowSheets(z){
  const mk=(y0,x1)=>{const g=new THREE.BufferGeometry();const x0=-6.86;
   g.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z-1.2, x0,y0,z+1.2, x1,0,z-1.6, x1,0,z+.8],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();
   const m=new THREE.Mesh(g,FX.shaftMaterial(this.time,{color:'#86aebb',intensity:.09,power:1.2,plane:1}));m.renderOrder=5;this.root.add(m);return m;};
  mk(2.85,-2.9);mk(1.25,-4.9);
 }

 // ------------------------------------------------------------------ Great Northern lodge
 enrich_lodge(){
  const lo=this.quality==='low';
  for(const o of this.find(o=>this.boxIs(o,13,.1,14)))this.surface(o.material,TX.plankFloor([3,3]),'#d9bfa4',.8);
  for(const o of this.find(o=>this.boxIs(o,13,.15,14))){const w=TX.woodSet({boards:8,seed:5},[4,4]);this.surface(o.material,w,'#6c5644',.6);}
  const st=TX.stone();for(const o of this.find(o=>o.geometry.type==='RoundedBoxGeometry'&&Math.abs(o.position.z+4.9)<1e-3&&o.geometry.parameters?.height===.24)){o.material.map=st.map;o.material.bumpMap=st.bumpMap;o.material.bumpScale=2;o.material.roughnessMap=st.roughnessMap;o.material.needsUpdate=true;}
  // Chimney breast with the mounted moose head.
  const chimney=this.box(2.3,1.95,.62,-4.65,3.85,-5.02,new THREE.MeshStandardMaterial({color:'#8a7f70',...st,roughness:1,bumpScale:2}));chimney.material.map=st.map.clone();chimney.material.map.repeat.set(3,2);chimney.material.map.needsUpdate=true;
  const moose=this.add(P.mooseMount(this.wood),-4.65,3.75,-4.68);moose.scale.setScalar(1.15);
  // Fire: noise-driven flame cards, a flickering hearth light, embers, glow pooled on the floor.
  for(const o of this.find(o=>o.material?.isMeshBasicMaterial&&o.material.color.getHexString()==='e89846'))o.visible=false;
  const fire=new THREE.Group();fire.position.set(-4.65,.36,-4.72);this.root.add(fire);this.billboards.push(fire);
  [[-.3,.42,.62],[0,.5,.8],[.3,.4,.6],[-.15,.32,.5],[.17,.34,.5]].forEach(([x,w,h],i)=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(w,h),FX.flameMaterial(this.time,{seed:i*.37,intensity:1.5}));f.position.set(x,h/2,(i%2)*.05);f.renderOrder=7;fire.add(f);});
  const fireLight=this.root.children.find(o=>o.isPointLight&&o.color.getHexString()==='ff7131');const hearth=this.light('#ff9a4a',6,-4.65,.8,-4.1,7);
  const glow=this.blob(-4.65,-3.95,3,2.2,.0);glow.material.color.set('#ff7a2a');glow.material.blending=THREE.AdditiveBlending;
  this.anim.push(t=>{const rf=this.game.settings.reducedFlashing;const n=rf?.97+.03*Math.sin(t*1.3):.78+.12*Math.sin(t*7.3)+.07*Math.sin(t*13.1+1.3)+.05*Math.sin(t*23.7);if(fireLight)fireLight.intensity=14*n;hearth.intensity=6*n;glow.material.opacity=.32*n;});
  const em=FX.embers(this.time,{count:lo?16:40,origin:[-4.65,.45,-4.72],spread:[.8,.2],height:1.15});this.root.add(em);this.points=(this.points||[]).concat(em);
  // Textiles, carved posts and warm wall-wash halos from the sconces.
  [[-6.33,2.55,2.1,Math.PI/2,0],[-6.33,2.55,-2.3,Math.PI/2,1],[6.33,2.55,2.1,-Math.PI/2,1],[6.33,2.55,-2.3,-Math.PI/2,0]].forEach(([x,y,z,r,v])=>{const t=this.add(P.hangingTextile(v),x,y,z);t.rotation.y=r;});
  for(const x of [-4,4])this.add(P.carvedPostSleeve(2.6,.34),x,0,1);
  const halo=TX.radial([[0,.7],[.35,.25],[1,0]]);for(const x of [-2.8,3]){const h=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.4),new THREE.MeshBasicMaterial({map:halo,color:'#ffb766',transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}));h.position.set(x,2.9,-6.84);this.root.add(h);}
  for(const x of [-4,4])this.shaft(x,2.88,1,{top:.33,bottom:1.25,color:'#ffcf8f',intensity:.16,power:1.4});
  // Contact darkening.
  this.aoEdge(0,-6.88,13,0);this.aoEdge(-6.26,0,14,Math.PI/2,{opacity:.45});this.aoEdge(6.26,0,14,-Math.PI/2,{opacity:.45});
  this.blob(1,-4,4.8,2,.6);for(const x of [-5,5])this.blob(x,2,2,2.3,.55);this.blob(-4.65,-4.9,3.2,1.6,.4);
  this.dust({count:280,min:[-6,.25,-6.5],max:[6,4.6,6],color:'#ffd4a0',lights:[[-4.65,1.2,-4,1.6],[-4,1.9,1,1.2],[4,1.9,1,1.2],[-2.8,2.6,-6,1.2]]});
 }

 // ------------------------------------------------------------------ Ghostwood clearing
 enrich_woods(){
  const lo=this.quality==='low',hi=this.quality==='high';
  for(const o of this.find(o=>this.boxIs(o,48,.15,52)))this.surface(o.material,TX.forestFloor([9,10]),'#ffffff',.7);
  // Wind sways needles, ferns and branches from the trunk base upward.
  const swayed=new Set();this.root.traverse(o=>{if(o.isInstancedMesh&&o.material?.map)swayed.add(o.material);});
  for(const m of swayed)this.wind(m,1);
  // Twelve pale sycamores in a ring, a dark oil pool at the heart of the grove.
  const ring=[];for(let i=0;i<12;i++){const a=(i+.5)/12*Math.PI*2,R=5.9;const x=Math.sin(a)*R,z=-5+Math.cos(a)*R;const tree=this.add(P.sycamore(i+3,8.5+(i%3)),x,0,z);tree.rotation.y=i*1.3;this.wall(x,z,.6,.6);ring.push(tree);this.wind(tree.userData.leaves.material,1.4);this.wind(tree.children[0].material,1.4);}
  const oil=new THREE.Mesh(new THREE.CircleGeometry(.95,48),new THREE.MeshPhysicalMaterial({color:'#050505',roughness:.04,metalness:.2,clearcoat:1,clearcoatRoughness:.02,iridescence:.85,iridescenceIOR:1.6,iridescenceThicknessRange:[200,700]}));oil.rotation.x=-Math.PI/2;oil.scale.y=.75;oil.position.set(0,.02,-4.4);this.root.add(oil);
  // Owl on a stub branch of the front-left sycamore.
  const host=ring[10],hp=host.position;const bark=host.children[0].material;const stub=this.mesh(new THREE.CylinderGeometry(.035,.06,1.1,8),bark,hp.x+.45,3.05,hp.z+.25);stub.rotation.z=Math.PI/2-.15;stub.rotation.y=-.5;
  const owl=this.add(P.owl(),hp.x+.62,3.12,hp.z+.32);owl.scale.setScalar(1.15);owl.lookAt(0,3.1,7);this.owl=owl.userData;
  this.anim.push(t=>{const rf=this.game.settings.reducedFlashing;const ph=t%13;let g=ph>7.5&&ph<11?Math.sin((ph-7.5)/3.5*Math.PI):0;if(rf)g=.35;this.owl.eyes.color.setRGB(.25+g*3.2,.13+g*1.6,.02+g*.25);this.owl.halo.opacity=g*.75;this.owl.head.rotation.y=Math.sin(t*.35)*.25;});
  // Traffic light swinging on its span wire at the forest edge.
  const tl=this.add(P.trafficLight(9),3,0,-13.5);tl.rotation.y=-.25;const tlu=tl.userData;const tLight=this.light('#ff2a1c',5,3,4.9,-13.1,9);
  this.anim.push(t=>{tlu.pivot.rotation.z=Math.sin(t*.8)*.11+Math.sin(t*1.9)*.02;tlu.pivot.rotation.x=Math.sin(t*.55+1)*.05;const ph=t%14;const s=ph<6?0:ph<8?1:2;const cols=['#ff2a1c','#ffb21e','#2cff9a'];tlu.lamps.forEach((l,i)=>l.mat.color.copy(l.color).multiplyScalar(i===s?2.2:.06));tlu.halo.color.set(cols[s]);tlu.haloMesh.position.y=-.5-s*.32;tLight.color.set(cols[s]);});
  // Fog sheets layered above the ground, mist curtains between the trunks, moonbeams.
  const sheets=lo?[[.15,.3],[.55,.22]]:hi?[[.12,.32],[.4,.25],[.85,.18],[1.4,.1]]:[[.12,.3],[.45,.24],[.95,.15]];
  sheets.forEach(([y,o],i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(44,44),FX.fogSheetMaterial(this.time,{opacity:o,scale:.12+i*.05,speed:1+i*.4,color:'#86a3a6'}));m.rotation.x=-Math.PI/2;m.position.set(0,y,-5);m.renderOrder=4;this.root.add(m);});
  if(!lo)[[-7,-13],[6,-15],[0,-18],[-10,-6],[10,-7],[-9,4],[9,3]].forEach(([x,z],i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(12,5),FX.mistCardMaterial(this.time,{opacity:.28,color:'#7e999b'}));m.position.set(x,2.4,z);m.renderOrder=3;this.root.add(m);this.billboards.push(m);});
  const moonDir=new THREE.Vector3(.32,1,-.2).normalize();
  [[-3,-6.5],[3.5,-9.5],[4.5,-1.5],[-5.5,1.5],[1,2.5]].forEach(([x,z],i)=>{const L=15;const m=FX.shaftCone(this.time,{top:.6,bottom:1.8+(i%2)*.6,height:L,color:'#a7c7cf',intensity:.07,power:.7});m.quaternion.setFromUnitVectors(UP,moonDir);m.position.set(x,0,z).addScaledVector(moonDir,L/2);this.root.add(m);});
  this.dust({count:220,min:[-9,.2,-12],max:[9,4.5,8],color:'#cfe2e4',lights:[[-3,1.5,-6.5,2],[3.5,1.5,-9.5,2],[4.5,1.5,-1.5,2],[-5.5,1.5,1.5,2]]});
 }
 // Vertex wind injected after instancing, in world space; branches and leaves move together.
 wind(m,amp=1){
  const time=this.time;const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);sh.uniforms.uWind=time;sh.uniforms.uAmp={value:amp};
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;uniform float uAmp;\nvec3 windOffset(vec3 p){float h=max(p.y-1.2,0.);float k=h*h*.0016*uAmp;float s=sin(uWind*.7+p.x*.13+p.z*.09)+.4*sin(uWind*1.7+p.x*.3);float f=sin(uWind*3.1+p.x*1.7+p.y*2.3+p.z*1.3)*.012*uAmp*min(h,4.);return vec3(s*k+f,0.,s*k*.5-f);}')
    .replace('#include <project_vertex>','vec4 mvPosition=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;\n#endif\nvec4 wpW=modelMatrix*mvPosition;wpW.xyz+=windOffset(wpW.xyz);mvPosition=viewMatrix*wpW;gl_Position=projectionMatrix*mvPosition;');};
  m.customProgramCacheKey=()=>'wind'+amp;m.needsUpdate=true;
 }

 // ------------------------------------------------------------------ Red room
 enrich_redroom(){
  const hi=this.quality==='high',lo=this.quality==='low';
  const floor=this.find(o=>o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===10&&Math.abs(o.rotation.x+Math.PI/2)<1e-3)[0];
  if(floor){floor.material.roughness=.55;floor.material.metalness=0;const r=TX.marble([3,3]);floor.material.roughnessMap=r.roughnessMap;floor.material.needsUpdate=true;this.floor=floor;}
  // Velvet: stronger sheen and a darker body so folds read in the low light.
  const curtains=new Set();this.root.traverse(o=>{if(o.material?.userData?.uTime)curtains.add(o.material);});
  for(const m of curtains){m.sheen=1;m.sheenRoughness=.32;m.sheenColor.set('#ff5a5f');m.roughness=.72;m.color.multiplyScalar(.85);}
  // Two armless goddesses between the curtains.
  for(const [x,z,r] of [[-3.3,-3.75,.45],[3.4,-3.85,-.5]]){const s=this.add(P.venusStatue(),x,0,z);s.rotation.y=r;this.wall(x,z,.7,.7);this.blob(x,z,1.1,1.1,.6);}
  // Floor lamps: downward pools, upward wash, slow flicker (unless reduced flashing).
  for(const x of [-4.7,4.7]){this.shaft(x,1.66,-3.9,{top:.43,bottom:1.1,height:1.66,color:'#ffc88a',intensity:.22,power:1.2});const up=this.shaft(x,3.6,-3.9,{top:.24,bottom:.95,height:1.35,color:'#ffc88a',intensity:.1,power:.6});up.scale.y=-1;}
  this.shaft(0,3.8,1,{top:.1,bottom:2.6,height:3.8,color:'#ead9c4',intensity:.035,power:.8}).position.z=-.3;
  const redLight=this.root.children.find(o=>o.isPointLight&&o.color.getHexString()===new THREE.Color('#9e2940').getHexString());
  const lamps=this.floorLamps||[];
  this.anim.push(t=>{const rf=this.game.settings.reducedFlashing;if(redLight)redLight.intensity=9*(1+.28*Math.sin(t*.55));
   lamps.forEach((l,i)=>{let k=1;if(!rf){const ph=(t+i*5.3)%9.7;if(ph<.35)k=.45+.55*Math.abs(Math.sin(ph*40));}l.intensity=8*k;});});
  if(hi){const refl=new Reflector(new THREE.PlaneGeometry(10,10),{shader:FloorReflectShader,textureWidth:Math.round(innerWidth*.5),textureHeight:Math.round(innerHeight*.5),clipBias:.003,color:0xffffff,multisample:0});
   Object.assign(refl.material,{transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});refl.rotation.x=-Math.PI/2;refl.position.y=.004;refl.renderOrder=2;this.root.add(refl);this.reflector=refl;}
  this.steam(0,.9,-1.4,2.1,.8);
  // Contact darkening where the velvet meets the floor and under furniture.
  for(const [x,z,r] of [[0,-4.92,0],[-4.92,0,Math.PI/2],[4.92,0,-Math.PI/2],[0,4.92,Math.PI]])this.aoEdge(x,z,10,r,{floor:.9,wall:.9,opacity:.5});
  for(const x of [-1.8,1.8])this.blob(x,-1.4,1.7,1.5,.6);this.blob(0,-1.4,1.1,1.1,.5);for(const x of [-4.7,4.7])this.blob(x,-3.9,1.4,1.4,.5);
  this.dust({count:240,min:[-4.6,.2,-4.6],max:[4.6,3.8,4.6],color:'#ffd0b0',lights:[[0,2.2,-.6,1.6],[-4.7,1.3,-3.9,1],[4.7,1.3,-3.9,1]]});
 }

 mount(){
  if(!this.built)this.build();const g=this.game,e=g.engine,c=conf(this.id);
  e.scene.add(this.root);e.scene.background=new THREE.Color(c.background);e.scene.fog=new THREE.FogExp2(c.background,c.fog);e.renderer.toneMappingExposure=c.exposure;e.renderer.shadowMap.enabled=e.qualityName!=='low';
  this.envMap=placeEnvironment(e.renderer,this.id);e.scene.environment=this.envMap;e.scene.environmentIntensity=c.envIntensity;
  if(!this._envHook){this._envHook=true;this.root.addEventListener('removed',()=>{if(e.scene.environment===this.envMap){e.scene.environment=null;e.scene.environmentIntensity=1;}});}
  g.camera.enterRoom(this);this._bobBase=null;
 }
 center(it){return new THREE.Box3().setFromObject(it.mesh).getCenter(new THREE.Vector3());}
 update(dt,t){
  super.update(dt,t);
  for(const f of this.anim)f(t,dt);
  const cam=this.game.engine.camera,cp=cam.position;
  for(const b of this.billboards)b.rotation.y=Math.atan2(cp.x-b.position.x,cp.z-b.position.z);
  if(this.points){const r=this.game.engine.renderer,h=r.getDrawingBufferSize(this._sz||(this._sz=new THREE.Vector2())).y,s=h/(2*Math.tan(THREE.MathUtils.degToRad(cam.fov/2)));for(const p of this.points)p.material.uniforms.uScale.value=s;}
  if(this.reflector)this.reflector.visible=this.game.engine.qualityName==='high';
  this.bob(dt,t);
 }
 // Subtle breathing + footstep bob. Only while playing in this room; the room camera never writes y.
 bob(dt,t){
  const c=this.game.camera;if(!this.headBob||c?.room!==this||this.game.mode!=='play'||this.game.settings.reducedMotion)return;
  const p=c.cam.position;if(!this._bobBase){this._bobBase={y:this.spawn[1],x:p.x,z:p.z,phase:0,speed:0};}
  const b=this._bobBase,moved=Math.hypot(p.x-b.x,p.z-b.z);b.x=p.x;b.z=p.z;const v=dt>0?moved/dt:0;b.speed+=(Math.min(v/2.1,1)-b.speed)*Math.min(1,dt*6);b.phase+=moved*4.6;
  p.y=b.y+Math.sin(b.phase)*.022*b.speed+Math.sin(t*1.25)*.006*(1-b.speed);
 }
}
