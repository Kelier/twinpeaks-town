import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
const ROOT='/models/twin-peaks/';
const assets=new Map(),loader=new GLTFLoader();
const load=name=>{if(!assets.has(name))assets.set(name,loader.loadAsync(ROOT+name+'?v=redroom-velvet-1').catch(e=>{assets.delete(name);throw e;}));return assets.get(name);};
let manifest;
const CAST_NAMES={'Dale Cooper':'库珀','Laura Palmer':'劳拉','Audrey Horne':'奥黛丽','Harry Truman':'杜鲁门','The Giant':'巨人','Pete Martell':'皮特','Leland Palmer':'利兰','BOB':'BOB'};
const FOCUS={diner:[[-1.8,1.43,.62],[1.03,1.65,-.24],[2.9,1.1,1.48]],redroom:[[-1.95,1.77,.55],[0,.16,.35],[2.05,1.77,.7]],shore:[[-.5,.35,.7],[-2.15,1.72,.2],[1.1,.95,-1.55]],stones:[[.36,1.7,.55],[-1.55,.9,-.4],[1.65,1.8,-.55]],hotel:[[1,2.4,-.2],[-.7,1.75,.82],[1.75,.9,-1.2]],roadhouse:[[0,2.45,-1.23],[1.2,1.7,1.8],[-2,.95,1.2]],cell:[[1.5,1.65,-1.1],[.4,1.7,-.4],[-1.7,.65,-1.75]],cave:[[0,2.2,-1.32],[1.72,1.7,.1],[.5,1.6,.4]],grove:[[0,.2,.76],[.2,1.7,.85],[2,1.7,.75]],mirror:[[-.35,2,-2.08],[-.33,1.7,-.72],[1.75,.95,-1.2]]};
export class MiniatureStage {
 constructor(){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
  this.canvas=this.renderer.domElement;this.canvas.className='miniature-canvas';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','真实三维微缩场景，含立体双峰人物');this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#182823');
  this.camera=new THREE.PerspectiveCamera(36,1,.1,90);this.camera.position.set(9,8,12);this.camera.lookAt(0,1,0);this.look=new THREE.Vector3(0,1,0);this.targetLook=this.look.clone();this.targetPosition=this.camera.position.clone();
  this.hemi=new THREE.HemisphereLight(0xece0c4,0x273c35,2);this.scene.add(this.hemi);
  const key=new THREE.DirectionalLight(0xffddad,3.2);this.key=key;key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.normalBias=.025;key.shadow.bias=-.00015;this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xc8dcff,1.7);this.fill=fill;fill.position.set(6,4,-1);this.scene.add(fill);
  // Red room: a single warm spot over the chair, everything else falls off into the black box.
  this.lodgeSpot=new THREE.SpotLight(0xfff0e0,0,26,.62,.55,1.2);this.lodgeSpot.position.set(5,9.5,6);this.lodgeSpot.target.position.set(.1,.4,-.4);this.lodgeSpot.castShadow=true;this.lodgeSpot.shadow.mapSize.set(2048,2048);this.lodgeSpot.shadow.bias=-.0002;this.lodgeSpot.shadow.normalBias=.02;this.scene.add(this.lodgeSpot,this.lodgeSpot.target);this.rim=new THREE.PointLight(0xff9955,25,15,2);this.rim.position.set(0,4,-3);this.scene.add(this.rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:0x182823,roughness:.95}));this.ground=floor;floor.rotation.x=-Math.PI/2;floor.position.y=-.36;floor.receiveShadow=true;this.scene.add(floor);
  this.mixers=[];this.old=[];this.angle=.58;this.view='wide';this.active=-1;this.sceneId=null;this.token=0;this.clock=new THREE.Clock();this.time=0;this.observer=new ResizeObserver(()=>this.resize());this.tick=this.tick.bind(this);requestAnimationFrame(this.tick);
 }
 async mount(host,id,active=-1,reduced=false,paused=false){
  if(!host)return;this.host=host;this.reduced=reduced;this.paused=paused;if(this.canvas.parentNode!==host){this.observer.disconnect();host.append(this.canvas);this.observer.observe(host);this.resize();}
  if(id===this.sceneId){if(active!==this.active){this.active=active;if(active>=0)this.view='wide';this.focus(active);}this.paintCastControls();return;}
  this.sceneId=id;this.active=active;const token=++this.token;this.status('正在装入微缩布景…');
  try{
   manifest ||= await fetch(ROOT+'manifest.json').then(r=>{if(!r.ok)throw Error('manifest');return r.json();});
   const spec=manifest.find(a=>a.id===id);if(!spec)throw Error('missing scene '+id);
   const [environment,...cast]=await Promise.all([load(spec.environment),...spec.cast.map(c=>load(c.asset))]);if(token!==this.token)return;
   const group=new THREE.Group();group.name='Live miniature '+id;group.add(environment.scene.clone(true));this.mixers=[];
   spec.cast.forEach((c,i)=>{const actor=cloneSkeleton(cast[i].scene);actor.position.set(...c.position);actor.rotation.y=c.rotation;actor.scale.multiplyScalar(c.scale||1);actor.name=c.name;group.add(actor);if(cast[i].animations.length){const mixer=new THREE.AnimationMixer(actor);mixer.clipAction(cast[i].animations[0]).play();this.mixers.push(mixer);}});
   group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   if(this.current){if(reduced){this.scene.remove(this.current);}else this.old.push({group:this.current,start:performance.now()});}
   this.current=group;this.spec=spec;group.position.x=reduced?0:11;group.rotation.y=reduced?0:-.22;this.entered=performance.now();this.scene.add(group);this.view='wide';this.actorIndex=0;this.angle=.58;this.focus(active);this.paintCastControls();this.status('');host.dataset.loaded=id;
   this.scene.background.set(id==='redroom'?'#070506':['mirror','grove','roadhouse'].includes(id)?'#1e141a':'#182823');this.rim.color.set(id==='redroom'?0xff5d44:0xffbb77);this.lighting(id);this.canvas.dataset.scene=id;this.canvas.dataset.renderer='threejs-webgl';
   this.canvas.dispatchEvent(new CustomEvent('miniature-ready',{bubbles:true,detail:{id,cast:spec.cast.length}}));
  }catch(e){this.status('三维布景加载失败 · 点击重试',true);console.error('Miniature asset load',e);}
 }
 lighting(id){const lodge=id==='redroom';this.hemi.intensity=lodge?.45:2;this.key.intensity=lodge?1.1:3.2;this.fill.intensity=lodge?.35:1.7;this.rim.intensity=lodge?12:25;this.lodgeSpot.intensity=lodge?230:0;this.renderer.toneMappingExposure=lodge?1.05:1.18;this.ground.material.color.set(lodge?0x050405:0x182823);}
 status(message,retry=false){this.host?.querySelector('.model-loading')?.remove();if(!message)return;const el=document.createElement(retry?'button':'div');el.className='model-loading';el.textContent=message;el.setAttribute('role','status');if(retry)el.onclick=()=>{const id=this.sceneId;this.sceneId=null;this.mount(this.host,id,this.active,this.reduced,this.paused);};this.host?.append(el);}
 resize(){if(!this.host)return;const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.focus(this.active);}
 focus(active){
  this.active=active;const picture=this.host?.closest('.picture');if(picture)picture.dataset.portrait=String(this.view==='close'&&active<0);let center=new THREE.Vector3(0,1,0),dist=this.camera.aspect<1.5?12.5:10.5;
  if(this.view==='close' && active<0){const c=this.spec?.cast?.[this.actorIndex||0];if(c){center.set(c.position[0],c.position[1]+(c.name==='The Giant'?2.13:1.55),c.position[2]);this.angle=c.rotation+.12;dist=this.camera.aspect<1.2?2.65:2.15;}}
  else if(active>=0){const c=this.spec?.cast?.[Math.min(Math.max(active,0),this.spec.cast.length-1)];if(c)center.set(c.position[0],1.40,c.position[2]);if(active>=0&&FOCUS[this.sceneId])center.set(...FOCUS[this.sceneId][active]);dist=this.camera.aspect<1.5?6.8:5.8;}
  const a=this.angle;this.targetLook.copy(center);this.targetPosition.set(center.x+Math.sin(a)*dist,center.y+dist*(this.view==='close'&&active<0?.10:active>=0?.32:.61),center.z+Math.cos(a)*dist);
  if(this.reduced){this.camera.position.copy(this.targetPosition);this.look.copy(center);}
 }
 viewpoint(view){this.view=view;this.angle=view==='left'?(this.sceneId==='redroom'?.08:-.58):view==='right'?1.02:.58;this.focus(-1);this.paintCastControls();}
 portrait(index){this.actorIndex=Math.max(0,Math.min(index,(this.spec?.cast.length||1)-1));this.view='close';this.focus(-1);this.paintCastControls();}
 paintCastControls(){const el=document.querySelector('.cast-tools');if(!el||!this.spec||this.spec.id!==this.sceneId)return;el.replaceChildren(...this.spec.cast.map((c,i)=>{const b=document.createElement('button');b.type='button';b.className='camera-button';b.dataset.action='actor';b.dataset.index=i;b.textContent=CAST_NAMES[c.name]||c.name;b.setAttribute('aria-label','查看'+b.textContent+'的面部与服装');b.setAttribute('aria-pressed',String(this.view==='close'&&i===(this.actorIndex||0)));return b;}));}
 tick(){setTimeout(()=>requestAnimationFrame(this.tick),1000/24);const delta=Math.min(this.clock.getDelta(),.05);if(!this.host?.isConnected)return;const now=performance.now();if(this.paused){this.renderer.render(this.scene,this.camera);return;}if(!this.paused&&!this.reduced){this.time+=delta;for(const mixer of this.mixers)mixer.update(delta);}
  const k=this.reduced?1:1-Math.exp(-delta*4);this.camera.position.lerp(this.targetPosition,k);this.look.lerp(this.targetLook,k);this.camera.lookAt(this.look);
  if(this.current){const t=this.reduced?1:Math.min(1,(now-this.entered)/1100),e=1-(1-t)**3;this.current.position.x=11*(1-e);this.current.rotation.y=-.22*(1-e);if(!this.paused&&!this.reduced)this.current.rotation.y+=Math.sin(this.time*.18)*.008;}
  this.old=this.old.filter(o=>{const t=Math.min(1,(now-o.start)/900);o.group.position.x=-12*t*t;o.group.rotation.y=.22*t;if(t===1){this.scene.remove(o.group);return false;}return true;});this.renderer.render(this.scene,this.camera);
  if(this.current&&FOCUS[this.sceneId]){document.querySelectorAll('.hotspot').forEach((el,i)=>{const v=new THREE.Vector3(...FOCUS[this.sceneId][i]);this.current.localToWorld(v);v.project(this.camera);el.style.setProperty('--x',Math.max(5,Math.min(95,(v.x*.5+.5)*100))+'%');el.style.setProperty('--y',Math.max(13,Math.min(85,(-v.y*.5+.5)*100))+'%');});}
 }
 stats(){let meshes=0,triangles=0,skinned=0;this.current?.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;if(o.isSkinnedMesh)skinned++;}});return {scene:this.sceneId,meshes,triangles,skinned,drawCalls:this.renderer.info.render.calls,assetErrors:!!this.host?.querySelector('button.model-loading')};}
}
let instance;
export function mountMiniature(...args){try{instance ||= new MiniatureStage();window.miniature=instance;return instance.mount(...args);}catch(e){const host=args[0];if(host)host.innerHTML='<p class="model-loading">此浏览器未能启动 WebGL，请换用支持三维加速的浏览器。</p>';console.error(e);}}
export function setMiniatureView(view){instance?.viewpoint(view);}

export function setMiniatureActor(index){instance?.portrait(index);}
