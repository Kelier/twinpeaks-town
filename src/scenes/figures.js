import * as THREE from 'three';
// Volumetric NPC figures. The charcoal character art is inflated into a closed relief solid:
// a distance field of each silhouette gives depth (thick torso, thinner limbs), the front surface
// carries the drawing, the back carries a blurred, hair-capped pass of the same figure. The solid
// is lit by the scene, casts real shadows, breathes, and turns body and head toward the player.
const ATLAS='/art/npc-figures.png';
const BOXES={cooper:[74,0,391,785],laura:[510,12,773,784],audrey:[910,9,1156,784],margaret:[1233,52,1508,783],truman:[1602,10,1924,786]};
// Head pivot as fraction of figure height from top, and how far the head can turn.
const RIG={cooper:{neck:.16,turn:.45},laura:{neck:.17,turn:.3},audrey:{neck:.165,turn:.4},margaret:{neck:.2,turn:.35},truman:{neck:.155,turn:.4}};
const MPP=1.82/786,STEP=3,ROUND=62,PAD=4;
let atlas;const cache={};
const loadAtlas=()=>atlas??=new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=ATLAS;});

function distanceField(mask,w,h){
 // Two-pass chamfer distance (3-4 metric) inside the silhouette, in pixels.
 const d=new Float32Array(w*h);for(let i=0;i<w*h;i++)d[i]=mask[i]?1e6:0;
 const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:d[y*w+x];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!d[i])continue;d[i]=Math.min(d[i],at(x-1,y)+1,at(x,y-1)+1,at(x-1,y-1)+1.4142,at(x+1,y-1)+1.4142);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!d[i])continue;d[i]=Math.min(d[i],at(x+1,y)+1,at(x,y+1)+1,at(x+1,y+1)+1.4142,at(x-1,y+1)+1.4142);}
 return d;
}
function blur(src,w,h,r){const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=src[y*w+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){tmp[y*w+x]=s/(2*r+1);s+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/(2*r+1);s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}}
 return out;}

function buildFigure(img,id){
 const [x0,y0,x1,y1]=BOXES[id],w=x1-x0+1+PAD*2,h=y1-y0+1+PAD*2;
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,x0-PAD,y0-PAD,w,h,0,0,w,h);
 const px=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h),lum=new Float32Array(w*h);
 for(let i=0;i<w*h;i++){mask[i]=px[i*4+3]>110?1:0;lum[i]=(px[i*4]*.3+px[i*4+1]*.59+px[i*4+2]*.11)/255;}
 const field=blur(distanceField(mask,w,h),w,h,3),detail=blur(lum,w,h,2);
 const depth=(x,y)=>{const i=Math.min(h-1,y)*w+Math.min(w-1,x);const d=Math.min(field[i],ROUND)/ROUND;const z=Math.sqrt(Math.max(0,1-(1-d)*(1-d)))*ROUND;
  // Light drawing tones bulge slightly; ink folds sink. Only inside, so the rim stays clean.
  return (z+(detail[i]-.45)*5*d)*MPP;};
 // Bottom-centre origin: feet on the floor.
 let minY=h;for(let y=0;y<h&&minY===h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){minY=y;break;}
 let maxY=0;for(let y=h-1;y>=0&&!maxY;y--)for(let x=0;x<w;x++)if(mask[y*w+x]){maxY=y;break;}
 let feetX=0,n=0;for(let y=maxY-30;y<=maxY;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){feetX+=x;n++;}feetX/=n||1;
 const headTop=minY,headRows=Math.round((maxY-minY)*.1);let headX=0,hn=0;for(let y=headTop;y<headTop+headRows;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){headX+=x;hn++;}headX/=hn||1;
 const cols=Math.ceil(w/STEP)+1,rows=Math.ceil(h/STEP)+1,pos=[],uv=[],index=[],grid=new Int32Array(cols*rows).fill(-1),back=new Int32Array(cols*rows).fill(-1);
 const inside=(x,y)=>{x=Math.min(w-1,x);y=Math.min(h-1,y);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h&&px[(yy*w+xx)*4+3]>8)return true;}return false;};
 const W=img.width,H=img.height;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=Math.min(w-1,i*STEP),y=Math.min(h-1,j*STEP);if(!inside(x,y))continue;const z=depth(x,y),X=(x-feetX)*MPP,Y=(maxY-y)*MPP,u=(x0-PAD+x+.5)/W,v=1-(y0-PAD+y+.5)/H;
  grid[j*cols+i]=pos.length/3;pos.push(X,Y,z);uv.push(u,v);back[j*cols+i]=pos.length/3;pos.push(X,Y,-z*.78);uv.push(u,v);}
 const front=[],rear=[];
 for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){const a=grid[j*cols+i],b=grid[j*cols+i+1],cc=grid[(j+1)*cols+i],d=grid[(j+1)*cols+i+1];const A=back[j*cols+i],B=back[j*cols+i+1],C=back[(j+1)*cols+i],D=back[(j+1)*cols+i+1];
  if(a>=0&&cc>=0&&b>=0){front.push(a,cc,b);rear.push(A,B,C);}if(b>=0&&cc>=0&&d>=0){front.push(b,cc,d);rear.push(B,D,C);}
  else if(a>=0&&cc>=0&&d>=0&&b<0){front.push(a,cc,d);rear.push(A,D,C);}else if(a>=0&&b>=0&&d>=0&&cc<0){front.push(a,d,b);rear.push(A,B,D);}}
 index.push(...front);const frontCount=front.length;index.push(...rear);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.addGroup(0,frontCount,0);geo.addGroup(frontCount,index.length-frontCount,1);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
 // Back texture: the same figure blurred and darkened, with the head capped in its hair tone.
 const bc=document.createElement('canvas');bc.width=W;bc.height=H;const bx=bc.getContext('2d');bx.filter='blur(7px) brightness(.62) saturate(.8)';bx.drawImage(img,0,0);bx.filter='none';
 let hr=0,hg=0,hb=0,hcount=0;for(let y=minY;y<minY+12;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(px[i+3]>200){hr+=px[i];hg+=px[i+1];hb+=px[i+2];hcount++;}}
 if(hcount){bx.globalCompositeOperation='source-atop';bx.fillStyle=`rgb(${hr/hcount*.7|0},${hg/hcount*.7|0},${hb/hcount*.7|0})`;const top=y0-PAD+minY,neck=(maxY-minY)*RIG[id].neck;bx.beginPath();bx.ellipse(x0-PAD+headX,top+neck*.52,neck*.62,neck*.62,0,0,Math.PI*2);bx.fill();bx.globalCompositeOperation='source-over';}
 return {geo,backCanvas:bc,height:(maxY-minY)*MPP,neckY:(maxY-minY)*(1-RIG[id].neck)*MPP,headX:(headX-feetX)*MPP};
}

function animated(material,uniforms){
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float uTime,uPhase,uHeadYaw,uNeckY,uHeadX,uBreath;
vec3 figureBend(vec3 p,float isNormal){
 float chest=smoothstep(uNeckY-.62,uNeckY-.25,p.y)*(1.-smoothstep(uNeckY-.12,uNeckY+.02,p.y));
 float br=sin(uTime*1.55+uPhase)*uBreath;
 if(isNormal<.5){p.z*=1.+chest*.07*br;p.x+=chest*.004*br*sign(p.x);p.y+=smoothstep(uNeckY-.4,uNeckY+.2,p.y)*.004*br;}
 float head=smoothstep(uNeckY-.05,uNeckY+.07,p.y);float a=uHeadYaw*head+sin(uTime*.37+uPhase)*.03*head;
 vec2 q=vec2(p.x-uHeadX*(1.-isNormal),p.z);float cs=cos(a),sn=sin(a);
 p.x=q.x*cs+q.y*sn+uHeadX*(1.-isNormal);p.z=-q.x*sn+q.y*cs;
 if(isNormal<.5)p.x+=sin(uTime*.6+uPhase)*.007*(p.y/1.8);
 return p;}`)
  .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n objectNormal=figureBend(objectNormal,1.);')
  .replace('#include <begin_vertex>','#include <begin_vertex>\n transformed=figureBend(transformed,0.);');
 };
 material.customProgramCacheKey=()=>'tp-figure';
 return material;
}

export class Figure{
 constructor(game,id,{scale=1}={}){
  this.game=game;this.id=id;this.root=new THREE.Group();this.root.name='Figure_'+id;this.yaw=0;this.restYaw=0;this.headYaw=0;this.scale=scale;
  this.uniforms={uTime:{value:0},uPhase:{value:Object.keys(BOXES).indexOf(id)*1.7},uHeadYaw:{value:0},uNeckY:{value:1.5},uHeadX:{value:0},uBreath:{value:game.settings?.reducedMotion?0:1}};
  // An invisible capsule keeps picking and focus framing stable before the art finishes loading.
  this.hit=new THREE.Mesh(new THREE.CylinderGeometry(.32,.3,1.8,10),new THREE.MeshBasicMaterial({visible:false}));this.hit.position.y=.9;this.root.add(this.hit);
  this.ready=loadAtlas().then(img=>this.populate(img)).catch(e=>console.warn('figure art unavailable',e));
 }
 populate(img){
  const data=cache[this.id]??=buildFigure(img,this.id);
  const tex=cache.tex??=Object.assign(new THREE.Texture(img),{colorSpace:THREE.SRGBColorSpace,anisotropy:8,needsUpdate:true});
  cache['back:'+this.id]??=Object.assign(new THREE.CanvasTexture(data.backCanvas),{colorSpace:THREE.SRGBColorSpace});
  const front=animated(new THREE.MeshStandardMaterial({map:tex,alphaTest:.5,roughness:.86,metalness:0,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.07}),this.uniforms);
  const rear=animated(new THREE.MeshStandardMaterial({map:cache['back:'+this.id],alphaTest:.5,roughness:.92}),this.uniforms);
  this.uniforms.uNeckY.value=data.neckY;this.uniforms.uHeadX.value=data.headX;
  this.mesh=new THREE.Mesh(data.geo,[front,rear]);this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.mesh.name='FigureBody_'+this.id;
  this.mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:tex,alphaTest:.5});
  Object.assign(this.mesh.userData,this.root.userData);this.root.add(this.mesh);
  this.hit.scale.y=data.height/1.8;this.hit.position.y=data.height/2;
 }
 setRest(yaw){this.restYaw=this.yaw=yaw;this.root.rotation.y=yaw;}
 // Body turns toward the viewer within a comfortable arc; the head follows further when close.
 update(dt,t,camera){
  this.uniforms.uTime.value=t;this.uniforms.uBreath.value=this.game.settings?.reducedMotion?0:1;
  if(!camera)return;const p=this.root.getWorldPosition(_v),c=camera.getWorldPosition(_c);const dx=c.x-p.x,dz=c.z-p.z,dist=Math.hypot(dx,dz)/this.worldScale();
  const want=Math.atan2(dx,dz)-(this.root.parent?_parentYaw(this.root.parent):0);
  let rel=wrap(want-this.restYaw);const body=THREE.MathUtils.clamp(rel,-1.15,1.15);const k=1-Math.exp(-dt*(dist<6?2.2:.8));
  this.yaw+=wrap(this.restYaw+body-this.yaw)*k;this.root.rotation.y=this.yaw;
  const head=dist<5.5?THREE.MathUtils.clamp(wrap(want-this.yaw),-RIG[this.id].turn,RIG[this.id].turn):0;this.headYaw+=(head-this.headYaw)*(1-Math.exp(-dt*3));this.uniforms.uHeadYaw.value=this.headYaw;
 }
 worldScale(){this.root.getWorldScale(_s);return _s.x||1;}
}
const _v=new THREE.Vector3(),_c=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler();
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const _parentYaw=o=>{o.getWorldQuaternion(_q);return _e.setFromQuaternion(_q,'YXZ').y;};
export const preloadFigures=()=>loadAtlas();
