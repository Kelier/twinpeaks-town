import T from '../design/tokens.json';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { curtainMaterial, curtainWall, chevronTexture, textTexture } from './materials.js';
import TOKENS from '../design/tokens.json';
import { Figure } from './figures.js';
const C=TOKENS.color;
const sm=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.65,...opts});
let seed=3921;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function surface(kind){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle=kind==='wood'?'#513426':kind==='floor'?'#847768':'#1e2824';ctx.fillRect(0,0,512,512);
 for(let i=0;i<5500;i++){
  const x=rnd()*512,y=rnd()*512;ctx.strokeStyle=`rgba(${rnd()>.5?'0,0,0':'220,187,135'},${rnd()*.14})`;ctx.lineWidth=.3+rnd()*1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(kind==='wood'?rnd()*130:3),y+(kind==='wood'?Math.sin(x*.08)*2:3));ctx.stroke();
 }
 if(kind==='floor'){for(let y=0;y<8;y++)for(let x=0;x<8;x++){ctx.fillStyle=(x+y)%2?'rgba(24,38,32,.72)':'rgba(237,220,178,.34)';ctx.fillRect(x*64+1,y*64+1,62,62);}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.repeat.set(kind==='wood'?2:4,kind==='wood'?2:5);return t;
}
export class TwinPeaksWorld{
 constructor(game,id){this.game=game;this.id=id;this.root=new THREE.Group();this.items=[];this.colliders=[];this.time={value:0};this.built=false;this.bounds={minX:-6.4,maxX:6.4,minZ:-8,maxZ:7.5};this.spawn=[-1.2,1.62,6.4];this.yaw=0;}
 mesh(geo,mat,x=0,y=0,z=0,parent=this.root){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 box(w,h,d,x,y,z,mat,parent=this.root,round=0){return this.mesh(round?new RoundedBoxGeometry(w,h,d,3,round):new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
 cyl(r1,r2,h,x,y,z,mat,parent=this.root){return this.mesh(new THREE.CylinderGeometry(r1,r2,h,32),mat,x,y,z,parent);}
 sign(lines,w,h,x,y,z,color='#e4dcc6',bg=null,parent=this.root){return this.mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(lines,{w:1024,h:512,fg:color,bg,font:'46px Georgia'}),transparent:!bg,side:THREE.DoubleSide}),x,y,z,parent);}
 item(mesh,id,label,action,radius=3){const it={mesh,id,label,action,radius};mesh.traverse(o=>o.userData.item=it);this.items.push(it);return it;}
 wall(x,z,w,d){this.colliders.push({x,z,w,d});}
 light(color,intensity,x,y,z,distance=15){const l=new THREE.PointLight(color,intensity,distance,1.6);l.position.set(x,y,z);this.root.add(l);return l;}
 build(){
  this.wood=sm('#6c4630',{map:surface('wood'),roughness:TOKENS.material.walnut.roughness});this.green=sm(C.pine);this.leather=sm('#783139',TOKENS.material.leather);this.cream=sm('#d9c7a5',{roughness:.42});this.chrome=sm('#b8bdb6',TOKENS.material.chrome);this.dark=sm('#222821');this.warm=new THREE.MeshBasicMaterial({color:'#ffd8a0'});
  this[this.id]();this.built=true;
 }
 mount(){if(!this.built)this.build();const g=this.game;g.engine.scene.add(this.root);g.engine.scene.background=new THREE.Color(this.id==='woods'?'#102326':'#100f0d');g.engine.scene.fog=new THREE.FogExp2(this.id==='woods'?'#1f3938':'#100f0d',this.id==='woods'?.04:.009);g.camera.bounds=this.bounds;g.camera.colliders=[];g.camera.free=true;g.camera.eyeY=1.62;g.camera.place(new THREE.Vector3(...this.spawn),this.yaw);g.camera.locked=false;}
 cup(x,y,z,parent=this.root){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);const pts=[new THREE.Vector2(.08,0),new THREE.Vector2(.115,.018),new THREE.Vector2(.13,.2),new THREE.Vector2(.126,.23),new THREE.Vector2(.105,.23),new THREE.Vector2(.1,.035),new THREE.Vector2(.08,.025)];this.mesh(new THREE.LatheGeometry(pts,40),sm('#e9dec4',TOKENS.material.ceramic),0,0,0,g);const coffee=this.mesh(new THREE.CircleGeometry(.105,32),sm('#211207',{roughness:.12}),0,.207,0,g);coffee.rotation.x=-Math.PI/2;this.mesh(new THREE.TorusGeometry(.08,.023,12,32),this.cream,.145,.135,0,g);this.cyl(.18,.17,.015,0,-.005,0,this.cream,g);return g;}
 lamp(x,z){const g=new THREE.Group();g.position.set(x,0,z);this.root.add(g);this.cyl(.018,.018,.9,0,3.55,0,this.chrome,g);this.mesh(new THREE.CylinderGeometry(.12,.4,.28,40,1,true),this.green,0,3.04,0,g);const bulb=this.mesh(new THREE.CircleGeometry(.33,32),this.warm,0,2.89,0,g);bulb.rotation.x=Math.PI/2;return g;}
 npc(id,x,y,z,rotation=0){
  const placements={cooper:[-3.35,3.2],truman:[-3.35,-5.2],audrey:[1,-4.75],margaret:[-2.6,-2.1],laura:[3.05,-.35]};
  const [nx,nz]=placements[id];const fig=new Figure(this.game,id);fig.root.position.set(nx,0,nz);this.root.add(fig.root);
  // Rest pose faces the arrival point, so the first look at each character is frontal.
  fig.setRest(Math.atan2(this.spawn[0]-nx,this.spawn[2]-nz));(this.figures??=[]).push(fig);
  const grounding=this.mesh(new THREE.CircleGeometry(.36,32),new THREE.MeshBasicMaterial({color:'#0b0a08',transparent:true,opacity:.42,depthWrite:false}),nx,.024,nz);grounding.rotation.x=-Math.PI/2;grounding.scale.y=.7;grounding.castShadow=false;
  this.item(fig.root,`npc:${id}`,{cooper:'库珀 · 交谈',laura:'劳拉 · 聆听',audrey:'奥黛丽 · 交谈',margaret:'原木夫人 · 交谈',truman:'杜鲁门 · 推理'}[id],()=>this.game.talk(id),4.4);
  fig.ready.then(()=>fig.mesh&&fig.mesh.traverse(o=>Object.assign(o.userData,fig.root.userData)));
 }
 door(label,destination,x,z,rotation=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;this.root.add(g);this.box(1.4,2.7,.12,0,1.35,0,this.green,g,.035);this.box(1.05,1.7,.04,0,1.65,.08,sm('#688178',{metalness:.4,roughness:.15,transparent:true,opacity:.45}),g);this.cyl(.025,.025,.3,.48,1.1,.15,this.chrome,g);this.sign([label],1,.26,0,2.3,.1,'#eddec2',null,g);this.item(g,`door:${destination}`,label,()=>this.game.travel(destination),4);}
 diner(){
  this.box(14,.12,18,0,-.08,0,sm('#c8b59a',{map:surface('floor'),roughness:.78}));
  this.box(14,4,.15,0,2,-9,this.wood);this.box(.15,4,18,-7,2,0,this.wood);this.box(.15,4,18,7,2,0,this.wood);this.box(14,.15,18,0,4.05,0,sm('#4b493d'));
  for(const x of [-6.9,6.9])for(const y of [.2,1,2.8])this.box(.12,.06,18,x,y,0,this.chrome);
  // Large windows and cold dawn beyond them.
  for(let i=0;i<4;i++){
   const z=4.5-i*3.5;const pane=this.box(.02,1.75,2.6,-6.89,2.05,z,new THREE.MeshBasicMaterial({color:'#4a6b68',transparent:true,opacity:.65}));
   for(const dz of [-1.36,1.36])this.box(.08,1.9,.07,-6.78,2.05,z+dz,this.cream);
   for(const y of [1.15,2.96])this.box(.08,.06,2.75,-6.78,y,z,this.cream);
   const outline=this.sign(['DOUGLAS FIRS'],2,.16,-6.72,2.82,z,'#b7c8af');outline.rotation.y=Math.PI/2;
  }
  // Booth seats with curved upholstery, piping and button seams.
  for(let i=0;i<3;i++){
   const z=3.7-i*4.3;
   for(const d of [-1,1]){
    this.box(2.3,1.2,.26,-4.85,.77,z+d*.9,this.leather,this.root,.12);
    this.box(2.25,.25,.65,-4.85,.48,z+d*.58,this.leather,this.root,.1);
    this.box(2.2,.035,.025,-4.85,1.27,z+d*.9-d*.145,this.cream);
    for(let j=0;j<7;j++)this.box(.015,.86,.016,-5.75+j*.3,.84,z+d*.9-d*.14,sm('#431b23'));
    this.wall(-4.85,z+d*.9,2.3,.4);
   }
   this.box(2.15,.1,.95,-4.85,.94,z,this.cream,this.root,.07);this.cyl(.055,.08,.87,-4.85,.44,z,this.chrome);this.wall(-4.85,z,2.2,.95);
   this.cup(-5.1,1,z);this.cyl(.028,.038,.12,-4.3,1.05,z+.1,this.chrome);
  }
  this.npc('cooper',-4.8,1.55,2.86);this.npc('truman',-4.8,1.55,-5.74);
  // Walnut counter, chrome edge and red stools.
  this.box(2.1,1.1,12,5.2,.55,-.8,this.wood,this.root,.08);this.box(2.35,.12,12.2,5.15,1.16,-.8,this.cream,this.root,.06);this.wall(5.2,-.8,2.2,12.2);
  for(const x of [4,6.3])this.box(.025,.03,12.1,x,1.14,-.8,this.chrome);
  for(let i=0;i<7;i++){const z=4.1-i*1.55;this.cyl(.22,.32,.07,3.05,.035,z,this.chrome);this.cyl(.035,.065,.6,3.05,.37,z,this.chrome);this.cyl(.34,.34,.16,3.05,.76,z,this.leather);const foot=this.mesh(new THREE.TorusGeometry(.19,.016,8,32),this.chrome,3.05,.32,z);foot.rotation.x=Math.PI/2;this.wall(3.05,z,.55,.55);}
  // Counter objects: coffee maker, glass carafe, napkins, pastry dome.
  const maker=new THREE.Group();maker.position.set(5.7,1.22,-3.2);this.root.add(maker);this.box(.7,.9,.5,0,.45,0,this.chrome,maker,.06);this.box(.5,.35,.12,0,.66,.27,this.dark,maker,.025);this.cyl(.16,.17,.26,0,.18,.38,sm('#755435',{metalness:.1,roughness:.2}),maker);this.box(.19,.1,.07,.16,.71,.35,this.leather,maker,.02);
  const cup=this.cup(4.5,1.23,2.3);this.item(cup,'receipt','咖啡与账单 · 调查',()=>this.game.inspect('receipt'),3.2);
  const receipt=this.sign(['DOUBLE R','06:18  /  315'],.27,.4,4.25,1.231,2.62,'#392e27','#e4dcc6');receipt.rotation.x=-Math.PI/2;
  this.cyl(.4,.42,.035,4.9,1.23,.25,this.cream);this.cyl(.32,.35,.16,4.9,1.33,.25,sm('#9a6138',{roughness:.8}));
  for(let i=0;i<8;i++){const strip=this.box(.62,.018,.055,4.9,1.42,.03+i*.06,sm('#cb9b61'));strip.rotation.y=.45;}
  const menu=this.sign(['THE DOUBLE R','COFFEE  ·  CHERRY PIE','OPEN ALL NIGHT'],3.7,1.8,4.3,2.7,-8.88,'#e0c995','#284339');
  this.sign(['A PLACE TO STAY AWHILE'],3,.26,-2.1,3.4,-8.86,'#d4ae7d');
  this.door('大北方旅馆','lodge',-.6,-8.83);this.door('林中小路','woods',2,8.6,Math.PI);
  for(const z of [4,-1,-6])this.lamp(.2,z);
  this.root.add(new THREE.HemisphereLight('#b1b5a2','#3b261b',1.15));
  this.light('#ffd3a0',28,1,2.7,2,15);this.light('#f4b66e',22,2,2.8,-5,13);this.light('#87b2b5',12,-5,2.3,1,12);
  this.rain();
 }
 rain(){const pos=[];for(let i=0;i<140;i++){const y=rnd()*2+1.2,z=rnd()*15-7;pos.push(-6.85,y,z,-6.85,y-.08-rnd()*.2,z+.025);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.rainMesh=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#b5d3cf',transparent:true,opacity:.25}));this.root.add(this.rainMesh);}
 lodge(){
  this.bounds={minX:-6,maxX:6,minZ:-6,maxZ:6};this.spawn=[0,1.62,5];
  this.box(13,.1,14,0,-.06,0,sm('#836348',{map:surface('wood')}));
  this.box(13,5,.2,0,2.5,-7,this.wood);for(const x of [-6.5,6.5])this.box(.15,5,14,x,2.5,0,this.wood);
  for(let x=-6;x<=6;x+=.65)this.box(.065,5,.06,x,2.5,-6.85,sm('#36291f'));
  this.box(7,.03,7,0,.01,-.5,sm('#59383a'));
  this.box(4,1.1,1.3,1,.55,-4,this.wood,this.root,.04);this.box(4.2,.12,1.5,1,1.16,-4,this.cream,this.root,.03);this.wall(1,-4,4.2,1.5);
  this.npc('audrey',1,1.82,-4.7);
  this.sign(['THE GREAT','NORTHERN'],4,1.5,0,3.4,-6.82,'#d3b477');
  for(let i=0;i<12;i++){const x=3.6+(i%3)*.5,y=1.6+Math.floor(i/3)*.45;this.box(.4,.3,.1,x,y,-6.78,this.dark);this.sign([`${310+i}`],.3,.14,x,y,-6.71,'#c6ae83');}
  const key=new THREE.Group();key.position.set(.5,1.25,-3.65);this.root.add(key);this.mesh(new THREE.TorusGeometry(.08,.018,12,32),sm('#c6a363',{metalness:.8,roughness:.25}),0,0,0,key);this.box(.03,.19,.025,0,-.13,0,this.chrome,key);key.rotation.x=-Math.PI/2;this.item(key,'key','315 房间钥匙 · 调查',()=>this.game.inspect('key'));
  const stoneColors=['#777062','#83796a','#675f54','#938877'];
  this.box(2.6,.18,1.3,-4.65,.09,-4.9,sm('#5a554c'),this.root,.04);
  this.box(1.45,1.6,.08,-4.65,.95,-5.2,this.dark);
  for(let row=0;row<9;row++)for(let col=0;col<5;col++){if(row<5&&col>0&&col<4)continue;const width=.44+rnd()*.08;this.box(width,.24,.52,-5.65+col*.5+(row%2?.06:0),.28+row*.27,-4.9,sm(stoneColors[(row+col)%4],{roughness:1}),this.root,.04);}
  this.box(2.8,.17,.8,-4.65,2.78,-4.9,this.wood,this.root,.035);
  for(let i=0;i<5;i++){const log=this.cyl(.08,.1,.8,-4.95+i*.16,.32,-4.65+i*.04,this.wood);log.rotation.z=Math.PI/2;log.rotation.y=(i-2)*.25;}
  const fireMat=new THREE.MeshBasicMaterial({color:'#e89846',transparent:true,opacity:.7});
  for(let i=0;i<9;i++){const flame=this.mesh(new THREE.SphereGeometry(1,10,8),fireMat,-5.1+i*.11,.43+rnd()*.15,-4.75);flame.scale.set(.04,.13+rnd()*.13,.035);}
  // Heavy timber beams and joinery give the room its actual architecture.
  this.box(13,.15,14,0,4.8,0,sm('#372d23'));for(const z of [-5,-1,3])this.box(13,.3,.33,0,4.45,z,this.wood);for(const x of [-5.5,5.5])this.box(.27,.35,14,x,4.42,0,this.wood);
  for(const x of [-.55,.5,1.55,2.6]){this.box(.89,.71,.02,x,.6,-3.337,sm('#795337',{map:surface('wood'),roughness:.8}),this.root,.025);this.box(.8,.018,.024,x,.92,-3.31,this.chrome);}
  const bell=this.cyl(.1,.14,.08,-.2,1.31,-3.65,sm('#ba9e60',{metalness:.8,roughness:.28}));this.cyl(.022,.032,.045,-.2,1.37,-3.65,this.chrome);
  const book=this.box(.38,.025,.29,1.8,1.24,-3.65,sm('#cbc1a4'));book.rotation.y=.2;
  const rc=document.createElement('canvas');rc.width=512;rc.height=512;const rctx=rc.getContext('2d');rctx.fillStyle='#633839';rctx.fillRect(0,0,512,512);for(let k=0;k<4;k++){rctx.strokeStyle=k%2?'#a99571':'#263d35';rctx.lineWidth=7;rctx.strokeRect(14+k*12,14+k*12,484-k*24,484-k*24);}for(let yy=100;yy<450;yy+=90)for(let xx=100;xx<450;xx+=90){rctx.fillStyle=(xx+yy)%180?'#bcaa82':'#293e34';rctx.beginPath();rctx.moveTo(xx,yy-28);rctx.lineTo(xx+28,yy);rctx.lineTo(xx,yy+28);rctx.lineTo(xx-28,yy);rctx.closePath();rctx.fill();}for(let y=0;y<512;y+=3){rctx.fillStyle='rgba(15,15,10,.1)';rctx.fillRect(0,y,512,1);}const rugTexture=new THREE.CanvasTexture(rc);rugTexture.colorSpace=THREE.SRGBColorSpace;const rug=this.mesh(new THREE.PlaneGeometry(6.8,7.8),sm('#ffffff',{map:rugTexture,roughness:1}),0,.032,.2);rug.rotation.x=-Math.PI/2;
  for(const x of [-5,5]){this.box(1.4,.22,1.7,x,.5,2,this.leather,this.root,.08);this.box(.24,.8,1.7,x+Math.sign(x)*.6,.87,2,this.wood,this.root,.06);for(const z of [1.3,2.7])this.cyl(.035,.045,.43,x,.22,z,this.wood);}
  for(const x of [-2.8,3]){this.box(.2,.5,.12,x,2.8,-6.65,this.wood);this.mesh(new THREE.CylinderGeometry(.12,.22,.28,24),sm('#ddc9a3',{emissive:'#c49a59',emissiveIntensity:.25}),x,2.85,-6.46);this.light('#efd4a2',7,x,2.8,-6.1,8);}

  for(const x of [-4,4]){this.cyl(.22,.3,4.7,x,2.35,1,this.wood);this.lamp(x,1);}
  this.door('返回餐馆','diner',0,6.8,Math.PI);this.door('前往森林','woods',4.5,-6.8);
  this.root.add(new THREE.HemisphereLight('#c4b493','#291b16',1.1));this.light('#e7c48c',46,0,3.8,0,20);this.light('#ff7131',12,-4.8,1.4,-4.2,8);
 }
 woods(){
  this.bounds={minX:-10,maxX:10,minZ:-12,maxZ:9};this.spawn=[0,1.62,7];
  const ground=surface('ground');ground.repeat.set(9,10);
  this.box(48,.15,52,0,-.1,-8,sm('#34403a',{map:ground,roughness:1}));
  // An open walking corridor; the canopy is made from alpha-tested needle sprays, never cones.
  const needleCanvas=document.createElement('canvas');needleCanvas.width=needleCanvas.height=256;const nc=needleCanvas.getContext('2d');
  nc.lineCap='round';nc.strokeStyle='#544c39';nc.lineWidth=3;nc.beginPath();nc.moveTo(128,246);nc.bezierCurveTo(140,180,120,75,128,12);nc.stroke();
  for(let j=0;j<29;j++){const cy=20+j*7.6,spread=12+Math.sin(j/30*Math.PI)*80;for(const side of [-1,1]){const ex=128+side*spread,ey=cy+20;nc.strokeStyle='#404e37';nc.lineWidth=1.4;nc.beginPath();nc.moveTo(128,cy);nc.lineTo(ex,ey);nc.stroke();for(let k=0;k<18;k++){const f=k/18,x=128+(ex-128)*f,y=cy+(ey-cy)*f;nc.strokeStyle=['#526b4e','#354e3d','#6a7b57'][k%3];nc.lineWidth=1.1;nc.beginPath();nc.moveTo(x,y);nc.lineTo(x+side*(6+rnd()*8),y-8-rnd()*9);nc.moveTo(x,y);nc.lineTo(x+side*(5+rnd()*7),y+7+rnd()*7);nc.stroke();}}}
  const nt=new THREE.CanvasTexture(needleCanvas);nt.colorSpace=THREE.SRGBColorSpace;nt.anisotropy=8;
  const leafMat=sm('#9ba88b',{map:nt,alphaTest:.3,side:THREE.DoubleSide,roughness:.95});const bark=sm('#655447',{map:surface('wood'),roughness:1});
  const needles=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leafMat,7500);const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.042,1,7),bark,1300);let ni=0,bi=0;const dummy=new THREE.Object3D();const up=new THREE.Vector3(0,1,0);
  const limb=(a,b,r)=>{const dir=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,dir.clone().normalize());dummy.scale.set(r,dir.length(),r);dummy.updateMatrix();branches.setMatrixAt(bi++,dummy.matrix);};
  for(let i=0;i<34;i++){
   const a=i*2.39996,dist=10+(i%5)*2.1;let x=Math.cos(a)*dist,z=Math.sin(a)*dist-4;if(Math.abs(x)<6&&z>-10&&z<12)x=Math.sign(x||1)*7.8;
   const h=10+(i%5)*1.35;const trunkGeo=new THREE.CylinderGeometry(.09,.32,h,14,12);const attr=trunkGeo.attributes.position;for(let v=0;v<attr.count;v++){const y=attr.getY(v);attr.setX(v,attr.getX(v)+Math.sin(y*.5+i)*.06);attr.setZ(v,attr.getZ(v)+Math.cos(y*.4+i)*.06);}trunkGeo.computeVertexNormals();this.mesh(trunkGeo,bark,x,h/2,z);this.wall(x,z,.65,.65);
   for(let tier=0;tier<8;tier++){const y=3.2+tier*(h-4)/8,r=(h-y)*.23;for(let k=0;k<4;k++){const ang=a+tier*.78+k*Math.PI/2;const from=new THREE.Vector3(x,y,z),to=new THREE.Vector3(x+Math.cos(ang)*r,y+.25,z+Math.sin(ang)*r);limb(from,to,.7+(h-y)*.05);
    for(let q=0;q<5;q++){const f=.22+q*.19;dummy.position.lerpVectors(from,to,f);dummy.position.y+=.1+rnd()*.18;dummy.rotation.set(-.8+(rnd()-.5)*.4,ang+Math.PI/2+(rnd()-.5)*.6,(rnd()-.5)*.3);dummy.scale.set(r*.9*(1-f*.45),1.3*(1-f*.2),1);dummy.updateMatrix();needles.setMatrixAt(ni++,dummy.matrix);}
   }}
  }
  needles.count=ni;branches.count=bi;needles.instanceMatrix.needsUpdate=true;branches.instanceMatrix.needsUpdate=true;this.root.add(needles,branches);
  // Fine ground cover keeps the route legible without blocking the eye line.
  const ferns=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leafMat,360);for(let i=0;i<360;i++){const x=(rnd()-.5)*32,z=(rnd()-.5)*35-4;dummy.position.set(Math.abs(x)<2.8?x+Math.sign(x||1)*3.5:x,.25,z);dummy.rotation.set(-.4,rnd()*Math.PI*2,(rnd()-.5)*.5);dummy.scale.set(.5+rnd()*.5,.5+rnd()*.6,1);dummy.updateMatrix();ferns.setMatrixAt(i,dummy.matrix);}this.root.add(ferns);
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),sm('#667469',{roughness:1}),160);for(let i=0;i<160;i++){let x=(rnd()-.5)*28,z=(rnd()-.5)*30-5;if(Math.abs(x)<2&&z>0)x+=3;dummy.position.set(x,.025,z);dummy.rotation.set(rnd(),rnd(),rnd());dummy.scale.set(.05+rnd()*.12,.035+rnd()*.04,.06+rnd()*.1);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}this.root.add(stones);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const rock=this.mesh(new THREE.DodecahedronGeometry(.25+rnd()*.2,1),sm('#627166',{roughness:1}),Math.sin(a)*3,.14,-4+Math.cos(a)*3);rock.scale.y=.45;}
  this.cyl(.46,.6,.6,-2,.3,-2,this.wood);this.npc('margaret',-2,1.45,-2.1);
  const radio=new THREE.Group();radio.position.set(1.3,.65,-2.8);this.root.add(radio);this.box(.75,.4,.25,0,0,0,this.wood,radio,.04);this.sign(['F M  /  3 1 5'],.5,.14,-.08,.06,.132,'#c0cfb3','#253a31',radio);this.cyl(.05,.05,.06,.26,-.06,.15,this.chrome,radio).rotation.x=Math.PI/2;for(let i=0;i<8;i++)this.box(.025,.14,.008,-.25+i*.05,-.1,.14,this.dark,radio);this.cyl(.008,.008,.65,.31,.48,0,this.chrome,radio);this.item(radio,'radio','收音机 · 调谐',()=>this.game.radio(),3.5);
  const curtain=curtainWall(2.8,3.6,curtainMaterial(T.color.red,{time:this.time}),180);curtain.position.set(0,0,-8);this.root.add(curtain);this.item(curtain,'dream','林中红幕 · 穿过',()=>this.game.enterDream(),4);this.portal=this.light('#a53740',5,0,1.8,-7,9);
  this.door('回到餐馆','diner',0,8.8,Math.PI);
  this.root.add(new THREE.HemisphereLight('#afc5c4','#233729',2.2));const moon=new THREE.DirectionalLight('#afcac6',2.2);moon.position.set(3,10,-2);this.root.add(moon);this.light('#b8cfb9',10,1.5,2.8,-2.8,10);
 }
 redroom(){
  this.bounds={minX:-4.5,maxX:4.5,minZ:-4.5,maxZ:4.5};this.spawn=[0,1.62,3.8];
  const floor=this.mesh(new THREE.PlaneGeometry(10,10),sm('#ffffff',{map:chevronTexture(1024,T.pattern.chevron.bands),roughness:.74}),0,0,0);floor.rotation.x=-Math.PI/2;
  const mat=curtainMaterial(T.color.red,{time:this.time});for(const [x,z,rot] of [[0,-5,0],[-5,0,Math.PI/2],[5,0,-Math.PI/2],[0,5,Math.PI]]){const m=curtainWall(10,4,mat,220);m.position.set(x,0,z);m.rotation.y=rot;this.root.add(m);}
  for(const x of [-1.8,1.8]){this.box(1.1,.4,.9,x,.3,-1.4,this.dark,this.root,.14);this.box(1.1,.8,.25,x,.86,-1.76,this.dark,this.root,.12);for(const side of [-1,1])this.box(.22,.55,.9,x+side*.5,.6,-1.4,this.dark,this.root,.09);this.wall(x,-1.4,1.2,1);}
  this.npc('laura',1.8,1.65,-1.65);this.cyl(.38,.35,.05,0,.64,-1.4,this.chrome);this.cyl(.025,.07,.62,0,.31,-1.4,this.chrome);this.cup(0,.67,-1.4);
  this.root.add(new THREE.HemisphereLight('#b9aa93','#21080b',1.3));this.light('#ffd2aa',13,0,3.2,0,15);this.light('#9e2940',9,3,2,-3,12);
  this.door('回到小镇','diner',0,4.87,Math.PI);
 }
 update(dt,t){this.time.value=t;if(this.figures){const cam=this.game.engine.camera;for(const f of this.figures)f.update(dt,t,cam);}if(this.rainMesh)this.rainMesh.position.y=-((t*.18)%.3);if(this.portal)this.portal.intensity=this.game.state.flags.deduced?10:2;}
 collide(p){for(const c of this.colliders){const dx=p.x-c.x,dz=p.z-c.z,ox=c.w/2+.22-Math.abs(dx),oz=c.d/2+.22-Math.abs(dz);if(ox>0&&oz>0){if(ox<oz)p.x+=Math.sign(dx||1)*ox;else p.z+=Math.sign(dz||1)*oz;}}}
}
