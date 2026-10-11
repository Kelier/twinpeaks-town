import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { T } from './i18n.js';

export function mountTitleRoom(host) {
  const poster=host.querySelector('img');
  const hint=document.createElement('p');hint.className='room-hint';hint.textContent=T('红房正在苏醒…','The room is waking…');host.append(hint);
  const button=document.createElement('button');button.className='room-light';button.disabled=true;button.setAttribute('aria-pressed','true');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/></svg><span></span>';host.append(button);
  let renderer,scene,camera,model,disposed=false,frameId,ready=false,lit=true,lightLevel=1;
  let yaw=.6,pitch=.48,targetYaw=.6,targetPitch=.48,drag=null,moved=false,hoverX=0,hoverY=0,last=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const center=new THREE.Vector3(0,1.55,0),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),lampMeshes=[],emissive=[];
  const updateLabel=()=>{button.setAttribute('aria-pressed',String(lit));button.querySelector('span').textContent=lit?T('关灯','Lights off'):T('开灯','Lights on');};updateLabel();
  const toggle=()=>{lit=!lit;updateLabel();};button.addEventListener('click',toggle);
  try {
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x090b0c,0);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=.85;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.className='room-canvas';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label',T('互动红房。拖动旋转，点击落地灯开关灯。方向键转动，L 开关灯，Home 复位。','Interactive Red Room. Drag to rotate; tap the floor lamp to toggle it. Arrow keys rotate, L toggles lights, Home resets.'));
    host.append(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,100);
    const pmrem=new THREE.PMREMGenerator(renderer),envScene=new RoomEnvironment();const env=pmrem.fromScene(envScene,.04);scene.environment=env.texture;scene.environmentIntensity=.28;pmrem.dispose();envScene.dispose();
    const fill=new THREE.HemisphereLight(0x899cb9,0x301013,1.0);scene.add(fill);
    const key=new THREE.DirectionalLight(0xffd5b0,3.2);key.position.set(3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-5,right:5,top:7,bottom:-5,near:.1,far:25});key.shadow.bias=-.001;key.shadow.normalBias=.025;scene.add(key);
    const rim=new THREE.DirectionalLight(0x96adcf,1.2);rim.position.set(-3,4,-2);scene.add(rim);
    const lamp=new THREE.PointLight(0xffcb8d,65,8,2);lamp.position.set(1.75,3.35,-1.85);scene.add(lamp);
    const warm=new THREE.PointLight(0xff794a,16,7,2);warm.position.set(-1.28,2.1,-.22);scene.add(warm);
    const resize=()=>{if(disposed)return;const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const reset=()=>{targetYaw=.6;targetPitch=.48;};
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{if(!ready)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};moved=false;canvas.classList.add('dragging');});
    canvas.addEventListener('pointermove',e=>{const box=canvas.getBoundingClientRect();hoverX=((e.clientX-box.left)/box.width-.5);hoverY=((e.clientY-box.top)/box.height-.5);
      if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;targetYaw=THREE.MathUtils.clamp(targetYaw-dx*.006,-.05,1.18);targetPitch=THREE.MathUtils.clamp(targetPitch+dy*.004,.22,.85);drag.x=e.clientX;drag.y=e.clientY;});
    canvas.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;if(!moved){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);if(ray.intersectObjects(lampMeshes,false).length)toggle();}drag=null;canvas.classList.remove('dragging');});
    const cancel=()=>{drag=null;canvas.classList.remove('dragging');hoverX=hoverY=0;};canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointerleave',()=>{if(!drag)hoverX=hoverY=0;});
    canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyL','Home'].includes(e.code))return;e.preventDefault();e.stopPropagation();if(e.code==='KeyL')toggle();if(e.code==='Home')reset();if(e.code==='ArrowLeft')targetYaw-=.12;if(e.code==='ArrowRight')targetYaw+=.12;if(e.code==='ArrowUp')targetPitch+=.08;if(e.code==='ArrowDown')targetPitch-=.08;targetYaw=THREE.MathUtils.clamp(targetYaw,-.05,1.18);targetPitch=THREE.MathUtils.clamp(targetPitch,.22,.85);});
    const fail=()=>{if(disposed)return;ready=false;host.classList.remove('room-ready');button.hidden=true;hint.textContent=T('互动场景未能加载 · 点击重试','Interactive scene unavailable · tap to retry');hint.style.pointerEvents='auto';hint.onclick=()=>location.reload();};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});
    new GLTFLoader().load('/themes/red-room-interactive.glb',g=>{
      if(disposed){g.scene.traverse(o=>{o.geometry?.dispose();});return;}
      model=g.scene;model.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;
        const name=o.name.toLowerCase();if(name.includes('lamp')&& !name.includes('saturn'))lampMeshes.push(o);
        const m=o.material;if(m){m.envMapIntensity=.35;if(name.includes('velvet')){m.roughness=.98;m.metalness=0;m.sheen=.22;m.color.setRGB(.16,.003,.006);}if(name.includes('shade')){m.emissive=new THREE.Color(0xffd2a0);m.emissiveIntensity=.6;emissive.push(m);}}
      });scene.add(model);ready=true;host.classList.add('room-ready');button.disabled=false;hint.textContent=T('拖动查看 · 点灯入梦','Drag to explore · touch the lamp');
    },undefined,fail);
    function animate(now){if(disposed)return;frameId=requestAnimationFrame(animate);if(document.hidden||now-last<1000/30)return;const dt=Math.min((now-last)/1000,.1);last=now;
      const t=now/1000;const drift=reduced.matches||drag?0:Math.sin(t*.35)*.025;
      yaw=THREE.MathUtils.damp(yaw,targetYaw+drift+(reduced.matches?0:hoverX*.08),7,dt);pitch=THREE.MathUtils.damp(pitch,targetPitch+(reduced.matches?0:hoverY*.025),7,dt);
      // Fit the complete miniature even when the viewport is unusually narrow.
      const distance=Math.max(16.8,8.8/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
      camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,center.y+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(center);
      lightLevel=THREE.MathUtils.damp(lightLevel,lit?1:0,7,dt);key.intensity=.12+lightLevel*2.08;lamp.intensity=23*lightLevel;warm.intensity=6*lightLevel;fill.intensity=.24+lightLevel*.76;rim.intensity=.35+lightLevel*.85;scene.environmentIntensity=.06+lightLevel*.22;for(const m of emissive)m.emissiveIntensity=.65*lightLevel;
      renderer.render(scene,camera);
    }frameId=requestAnimationFrame(animate);
    return {get ready(){return ready;},get lit(){return lit;},get lightLevel(){return lightLevel;},get yaw(){return yaw;},get model(){return model;},camera,renderer,lampMeshes,
      dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});env.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
  }catch(error){console.warn('Title room unavailable',error);button.hidden=true;hint.textContent=T('互动场景暂不可用','Interactive scene unavailable');return{dispose(){disposed=true;renderer?.dispose();}};}
}
