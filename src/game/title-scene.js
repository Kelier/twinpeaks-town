import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export function createTitleScene(canvas, options, notify) {
  const T=(zh,en)=>options.language==='zh'?zh:en;
  let viewport={...options},renderer,model,env,frameId,disposed=false,ready=false,present=false,failed=false;
  let yaw=.78,pitch=.58,targetYaw=.6,targetPitch=.48,lit=true,lightLevel=.12,drag=false,last=0,dirty=true,arrival=0,enterTime=0,zoom=1;
  const metrics={started:performance.now()},requests=new Set(),textures=[],fitPoints=[];
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.2,90),center=new THREE.Vector3(0,1.55,0);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),targets={},bakedMaterials=[];
  let reduced=options.reduced;
  const fetchBytes=async(url,ms=20000)=>{const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),ms);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error(`${url}: ${r.status}`);return await r.arrayBuffer();}finally{clearTimeout(timer);requests.delete(controller);}};
  const texture=async(url,colorSpace=THREE.NoColorSpace)=>{const bytes=await fetchBytes(url);const bitmap=await createImageBitmap(new Blob([bytes]),{imageOrientation:'none',colorSpaceConversion:'none'});const t=new THREE.Texture(bitmap);t.flipY=false;t.colorSpace=colorSpace;t.needsUpdate=true;textures.push(t);return t;};
  const releaseModel=m=>m?.traverse(o=>{o.geometry?.dispose();for(const mat of (o.material?Array.isArray(o.material)?o.material:[o.material]:[]))mat.dispose();});
  const fail=()=>{if(disposed||failed)return;failed=true;notify({failed:true});};
  try {
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');const software=debug&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));let pixelBudget=software?420000:2400000;metrics.softwareRenderer=Boolean(software);
    renderer.setClearColor(0x10090b,0);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=.95;
    // The UV bake owns contact shadows. No low-resolution realtime shadow map.
    const fill=new THREE.HemisphereLight(0xafbccb,0x331016,.32),key=new THREE.DirectionalLight(0xffdbb8,1.4),rim=new THREE.DirectionalLight(0xaabbd0,.4);
    key.position.set(1,7,5);rim.position.set(-4,4,-3);scene.add(fill,key,rim);
    const lamp=new THREE.PointLight(0xffc38b,8,7,2);lamp.position.set(1.75,3.35,-1.85);scene.add(lamp);
    const cv=new OffscreenCanvas(128,128),ctx=cv.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,230,178,.55)');gradient.addColorStop(.12,'rgba(255,191,120,.22)');gradient.addColorStop(1,'rgba(255,130,75,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const glowMap=new THREE.CanvasTexture(cv);textures.push(glowMap);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0xffc08b,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));glow.position.copy(lamp.position);glow.scale.set(1.5,1.5,1);scene.add(glow);
    const resize=()=>{if(disposed)return;dirty=true;renderer.setPixelRatio(Math.min(viewport.pixelRatio,options.compact?1.5:1.75,Math.sqrt(pixelBudget/(viewport.width*viewport.height))));renderer.setSize(viewport.width,viewport.height,false);camera.aspect=viewport.width/viewport.height;camera.updateProjectionMatrix();};resize();
    function install(g,baked){
      const old=model;model=g.scene;scene.add(model);for(const k of Object.keys(targets))delete targets[k];bakedMaterials.length=0;
      model.traverse(o=>{if(!o.isMesh)return;const n=o.name.toLowerCase();
        let role=n.includes('chair')?'entry':n.includes('archive')?'archive':n.includes('saturn')?'music':n.includes('programme')?'help':n.includes('lamp')?'light':null;
        if(role){o.userData.roomAction=role;(targets[role]??=[]).push(o);}
        for(const m of (Array.isArray(o.material)?o.material:[o.material])){
          m.envMapIntensity=.25;
          if(n.includes('velvet')){m.roughness=.98;m.metalness=0;m.color.setRGB(.22,.004,.009);}
          if(baked){m.lightMap=baked.light;m.lightMapIntensity=.15;m.aoMap=baked.ao;m.aoMapIntensity=.72;bakedMaterials.push(m);if(n.includes('velvet')||n.includes('chair')){m.normalMap=baked.normal;m.normalScale=new THREE.Vector2(.55,.55);}}
          if(n.includes('shade')){m.emissive=new THREE.Color(0xffd8a5);m.emissiveIntensity=.4;}
        }
      });model.updateMatrixWorld(true);fitPoints.length=0;const box=new THREE.Box3().setFromObject(model);
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])fitPoints.push(new THREE.Vector3(x,y,z).sub(center));
      if(old){scene.remove(old);releaseModel(old);}dirty=true;
    }
    const point=new THREE.Vector3(),box=new THREE.Box3();
    function anchors(){const result={};for(const [role,meshes] of Object.entries(targets)){box.makeEmpty();for(const m of meshes)box.expandByObject(m);box.getCenter(point);
      if(role==='entry'){point.y=.3;point.z+=1.5;}if(role==='archive'){point.x-=.5;point.y-=.12;}if(role==='help')point.x-=.28;if(role==='music')point.y+=.65;if(role==='light'){point.y=2.6;point.x+=.55;}
      point.project(camera);result[role]={x:(point.x+1)*50,y:(1-point.y)*50};}return result;}
    function pose(now,dt){
      const intro=ready&&arrival?Math.min(1,(now-arrival)/1700):0;
      yaw=reduced?targetYaw:THREE.MathUtils.damp(yaw,targetYaw+(reduced||drag?0:Math.sin(now*.00025)*.014),6,dt);pitch=reduced?targetPitch:THREE.MathUtils.damp(pitch,targetPitch,6,dt);
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),up=new THREE.Vector3(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)),toward=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));let distance=10;
      for(const p of fitPoints)distance=Math.max(distance,p.dot(toward)+Math.abs(p.dot(right))/(tan*camera.aspect*.84),p.dot(toward)+Math.abs(p.dot(up))/(tan*.8));
      const enter=enterTime?(reduced?1:Math.min(1,(now-enterTime)/850)):0;
      distance*=(1-.34*enter*enter)/zoom;camera.position.copy(toward.multiplyScalar(distance)).add(center);camera.lookAt(center);
      lightLevel=reduced?(lit?1:0):THREE.MathUtils.damp(lightLevel,lit?(reduced?1:.15+.85*intro):0,5,dt);
      const baked=bakedMaterials.length>0;key.intensity=(baked?.18:1.4)*lightLevel+.05;fill.intensity=.12+lightLevel*(baked?.15:.32);rim.intensity=.15+lightLevel*.2;lamp.intensity=8*lightLevel;glow.material.opacity=.5*lightLevel;
      for(const m of bakedMaterials)m.lightMapIntensity=.035+lightLevel*.9;
    }
    function geometryBounds(){let bottom=0;for(const v of fitPoints){point.copy(v).add(center).project(camera);bottom=Math.max(bottom,(1-point.y)*50);}return {bottom};}
    function hitPoints(){const result={};for(const [role,meshes] of Object.entries(targets)){box.makeEmpty();for(const m of meshes)box.expandByObject(m);box.getCenter(point).project(camera);result[role]={x:point.x,y:point.y};}return result;}
    function draw(now){if(disposed||failed)return;frameId=requestAnimationFrame(draw);if(!present||viewport.hidden||now-last<1000/30)return;const elapsed=(now-last)/1000,dt=Math.min(elapsed,.25);last=now;if(!reduced&&ready&&elapsed>.5&&pixelBudget>420000){pixelBudget=Math.max(420000,pixelBudget*.7);resize();metrics.pixelBudget=pixelBudget;}
      if(reduced&&!dirty&&!enterTime&&Math.abs(lightLevel-(lit?1:0))<.001&&Math.abs(yaw-targetYaw)<.001&&Math.abs(pitch-targetPitch)<.001)return;
      pose(now,dt);renderer.render(scene,camera);dirty=false;notify({yaw,lit,lightLevel,anchors:anchors(),geometryBounds:geometryBounds(),hitPoints:hitPoints(),render:renderer.info.render,pixelRatio:renderer.getPixelRatio(),lampPoint:targets.light?(()=>{const p=new THREE.Vector3(1.75,3.35,-1.85).project(camera);return{x:p.x,y:p.y};})():null});
    }
    frameId=requestAnimationFrame(draw);
    (async()=>{
      const g=await new GLTFLoader().parseAsync(await fetchBytes('/themes/red-room-opening.glb'),'/themes/');if(disposed)return;install(g);pose(performance.now(),.1);renderer.render(scene,camera);present=true;arrival=performance.now();metrics.firstGeometry=arrival;notify({present:true,hint:T('梦正在成形…','The dream is taking shape…'),metrics});
      const reflections=(async()=>{try{const hdr=new HDRLoader().parse(await fetchBytes('/themes/room-environment.hdr',4000));if(disposed)return;env=new THREE.DataTexture(hdr.data,hdr.width,hdr.height,THREE.RGBAFormat,hdr.type);env.colorSpace=THREE.LinearSRGBColorSpace;env.flipY=false;env.mapping=THREE.CubeUVReflectionMapping;env.minFilter=env.magFilter=THREE.LinearFilter;env.generateMipmaps=false;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.15;}catch{metrics.environmentFallback=true;}})();
      const results=await Promise.all([fetchBytes('/themes/red-room-baked.glb'),texture('/themes/room-baked-light.png',THREE.LinearSRGBColorSpace),texture('/themes/room-contact-ao.png'),texture('/themes/room-surface-normal.png'),reflections]);if(disposed)return;
      const full=await new GLTFLoader().parseAsync(results[0],'/themes/');
      // Compile offscreen while the same miniature remains visible.
      full.scene.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.lightMap=results[1];m.aoMap=results[2];if(o.name.toLowerCase().includes('velvet')||o.name.toLowerCase().includes('chair'))m.normalMap=results[3];}});
      const preparation=new THREE.Scene();preparation.add(full.scene);await renderer.compileAsync(preparation,camera,scene);if(disposed){releaseModel(full.scene);return;}
      install(full,{light:results[1],ao:results[2],normal:results[3]});arrival=performance.now();if(reduced){yaw=targetYaw;pitch=targetPitch;lightLevel=1;}ready=true;metrics.prepared=arrival;notify({ready:true,metrics,hint:T('椅子通向梦里 · 落地灯可以触碰','The chair leads into the dream · Touch the lamp')});

    })().catch(error=>{if(disposed)return;console.warn(error);if(present){ready=true;notify({ready:true,metrics,hint:T('柔光模式 · 仍可探索红房','Soft light mode · Explore the room')});}else fail();});
    function command(e){
      if(e.type==='resize'){viewport={...viewport,...e};resize();return;}if(e.type==='visibility'){viewport.hidden=e.hidden;dirty=true;return;}if(e.type==='reduced'){reduced=e.value;dirty=true;return;}if(e.type==='enter'){enterTime=performance.now();dirty=true;return;}if(!present)return;
      dirty=true;if(e.type==='zoom')zoom=THREE.MathUtils.clamp(zoom-e.delta*.0005,.92,1.14);if(e.type==='toggle'){lit=!lit;notify({lit});}if(e.type==='drag'){drag=true;targetYaw=THREE.MathUtils.clamp(targetYaw-e.dx*.006,.05,1.12);targetPitch=THREE.MathUtils.clamp(targetPitch+e.dy*.004,.28,.75);}if(e.type==='dragEnd')drag=false;
      if(e.type==='tap'){pointer.set(e.x,e.y);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(Object.values(targets).flat(),false)[0];if(hit){const action=hit.object.userData.roomAction;if(action==='light'){lit=!lit;notify({lit});}else notify({action});}}
      if(e.type==='key'){if(e.code==='KeyL'){lit=!lit;notify({lit});}if(e.code==='Home'){targetYaw=.6;targetPitch=.48;zoom=1;}if(e.code==='ArrowLeft')targetYaw=Math.max(.05,targetYaw-.12);if(e.code==='ArrowRight')targetYaw=Math.min(1.12,targetYaw+.12);if(e.code==='ArrowUp')targetPitch=Math.min(.75,targetPitch+.08);if(e.code==='ArrowDown')targetPitch=Math.max(.28,targetPitch-.08);}
    }
    return {command,dispose(){disposed=true;cancelAnimationFrame(frameId);for(const r of requests)r.abort();releaseModel(model);for(const t of textures){t.image?.close?.();t.dispose();}env?.dispose();glow.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
  }catch(e){console.warn(e);fail();return{dispose(){disposed=true;renderer?.dispose();}};}
}
