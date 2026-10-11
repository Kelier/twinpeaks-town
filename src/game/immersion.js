// Shared stage treatment: contact, material depth and restrained environmental motion.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
let environment;
// Fine uncoloured height/roughness texture; material colour remains the authored palette.
let microTexture;
function microSurface(){
  if(microTexture)return microTexture;
  const size=128,data=new Uint8Array(size*size*4);let seed=1217;
  for(let i=0;i<size*size;i++){seed=(seed*1664525+1013904223)>>>0;const v=180+(seed>>>25);data.set([v,v,v,255],i*4);}
  microTexture=new THREE.DataTexture(data,size,size);microTexture.wrapS=microTexture.wrapT=THREE.RepeatWrapping;microTexture.repeat.set(8,8);microTexture.magFilter=THREE.LinearFilter;microTexture.minFilter=THREE.LinearMipmapLinearFilter;microTexture.generateMipmaps=true;microTexture.anisotropy=4;microTexture.needsUpdate=true;return microTexture;
}
const outdoor = new Set(['shore', 'forest']);
const contactGeometry = new THREE.PlaneGeometry(1, 1);
function contactMaterial() {
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1,
    uniforms:{strength:{value:.5}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float strength;void main(){float d=length((vUv-.5)*2.);float a=exp(-d*d*5.)*(1.-smoothstep(.7,1.,d));gl_FragColor=vec4(.015,.012,.018,a*strength);}` });
}
export function dressStage(ctx, renderer) {
  const {scene,world,player}=ctx, id=ctx.models && ctx.scene.userData.chapter;
  if(!environment){const room=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.06).texture;room.dispose();pmrem.dispose();}
  scene.environment=environment;scene.environmentIntensity=outdoor.has(id)?.045:.18;
  if(id==='shore')scene.fog=new THREE.Fog('#18212b',16,85);
  if(id==='forest')scene.fog.density=.023;
  const time={value:0}; const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  scene.traverse(o=>{
    if(o.isLight&&o.shadow){o.shadow.bias=-.00008;o.shadow.normalBias=.008; o.shadow.camera.near=.2;}
    if(!o.isMesh)return;
    // Extend the lake behind the far bank; the old finite rectangle ended in open sky.
    if(id==='shore' && o.name==='Lake'){o.scale.z*=3;o.position.z-=46.6;}
    // GLB materials are cloned at instantiation; scripted material references stay intact.
    const materials=Array.isArray(o.material)?o.material:[o.material];
    const next=materials.map(source=>{
      const m=source;
      if(m.isMeshStandardMaterial){
        if(/Water|Lake/i.test(m.name+' '+o.name)){
          m.roughness=.35; m.metalness=.05; m.envMapIntensity=.06;
          m.onBeforeCompile=shader=>{shader.uniforms.stageTime=time;
            shader.fragmentShader='uniform float stageTime;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n normal=normalize(normal+vec3(sin(vViewPosition.x*3.+stageTime*.55)*.055,cos(vViewPosition.z*4.+stageTime*.4)*.025,0.));`);};
          m.customProgramCacheKey=()=> 'lake-ripples-v1';
        }
        if(m.map&&!m.bumpMap){m.bumpMap=m.map;m.bumpScale=.008;}
        if(!m.map && /leather|velvet|wool|linen|cotton|stone|rock|wood|bark/i.test(m.name)){
          m.bumpMap=microSurface();m.bumpScale=/stone|rock|bark/i.test(m.name)?.025:.007;
          m.roughnessMap=microSurface();
          if(/leather/i.test(m.name))m.roughness=Math.max(.62,m.roughness);
          if(/velvet|wool|linen|cotton/i.test(m.name))m.roughness=.98;
        }
        if(/curtain|velvet/i.test(m.name+' '+o.name)){
          m.roughness=.94;
          m.onBeforeCompile=shader=>{shader.uniforms.stageTime=time;shader.vertexShader='uniform float stageTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n transformed.z+=sin(position.x*1.8+stageTime*.38)*.018*(1.-clamp(position.y/9.,0.,1.));`);};
          m.customProgramCacheKey=()=> 'velvet-breath-v1';
        }
      }
      return m;
    });o.material=Array.isArray(o.material)?next:next[0];
  });
  const subjects=[{root:player.root,width:.72,depth:.55,feet:()=>player.pos.y},...(world.contactSubjects||[]),
    ...world.movables.map(m=>({root:m.mesh,width:m.size.x*1.25,depth:m.size.z*1.25,feet:()=>m.min[1]}))];
  const shadows=subjects.map(s=>{const mesh=new THREE.Mesh(contactGeometry.clone(),contactMaterial());mesh.name='Contact shadow';mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;scene.add(mesh);return {s,mesh};});
  world.updaters.push((dt,t)=>{
    time.value=reducedMotion.matches?0:t;
    for(const {s,mesh} of shadows){
      const p=s.root.position,feet=s.feet?.()??p.y;let floor=-Infinity;
      for(const c of world.solids())if(!c.ghost&&c.mesh!==s.root&&c.max[1]<=feet+.025&&p.x>=c.min[0]&&p.x<=c.max[0]&&p.z>=c.min[2]&&p.z<=c.max[2])floor=Math.max(floor,c.max[1]);
      const height=feet-floor;mesh.visible=s.root.visible&&Number.isFinite(floor)&&height<3;
      if(!mesh.visible)continue;
      mesh.position.set(p.x,floor+.008,p.z);const spread=1+Math.max(0,height)*.45;
      mesh.scale.set(s.width*spread,s.depth*spread,1);mesh.material.uniforms.strength.value=.62*Math.exp(-Math.max(0,height)*1.3);
    }
  });
  scene.userData.immersion={contacts:shadows.length,environment:true};
}
