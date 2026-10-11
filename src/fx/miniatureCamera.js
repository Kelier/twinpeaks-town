import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import T from '../design/tokens.json';
const C=T.camera;
export class MiniatureCamera{
 constructor(camera,input,settings){this.cam=camera;this.input=input;this.settings=settings;this.controls=new OrbitControls(camera,input.canvas);Object.assign(this.controls,{enableDamping:true,dampingFactor:C.dampingFactor,minDistance:C.minDistance,maxDistance:C.maxDistance,minPolarAngle:C.minPolarAngle,maxPolarAngle:C.maxPolarAngle,enablePan:true,screenSpacePanning:false,maxTargetRadius:25});this.cam.fov=C.fov;this.cam.near=.1;this.cam.far=1600;this.cam.updateProjectionMatrix();this.vel=new THREE.Vector3();this.eyeY=1.62;this.controls.addEventListener('start',()=>{if(this.tween)return;this.flight=null;this.framing=null;});this.overview(true);window.addEventListener('resize',()=>{if(this.framing)this.frameBox(this.framing.box,this.framing.direction,this.framing.title);});}
 get pos(){return this.cam.position;}
 set locked(value){this._locked=value;}
 get locked(){return this._locked;}
 move(target,position){this.flight={target,position};if(!this.initialized||this.settings.reducedMotion){this.initialized=true;this.controls.target.copy(target);this.cam.position.copy(position);this.flight=null;this.controls.update();}}
 direction(){const d=this.cam.position.clone().sub(this.controls.target).normalize();d.y=Math.max(.45,d.y);return d.normalize();}
 focus(point,distance=7){if(this.room){const d=point.clone().sub(this.cam.position);this.yaw=Math.atan2(-d.x,-d.z);this.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));this.roomLook();return;}this.framing=null;const target=point.clone();this.move(target,target.clone().addScaledVector(this.direction(),distance));}
 // Fit all eight bounds corners in the camera plane, including depth foreshortening.
 // The mobile width is usually the limiting dimension; reserve vertical space for HUD/controls.
 frameBox(box,direction=this.direction(),title=false){this.framing={box:box.clone(),direction:direction.clone(),title};const mobile=innerWidth<700,center=box.getCenter(new THREE.Vector3());const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();const tan=Math.tan(THREE.MathUtils.degToRad(this.cam.fov/2)),aspect=innerWidth/innerHeight;let distance=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const delta=new THREE.Vector3(x,y,z).sub(center),depth=delta.dot(direction);distance=Math.max(distance,Math.abs(delta.dot(right))/(tan*aspect*(mobile?C.fitPadding.mobileWidth:C.fitPadding.desktopWidth))+depth,Math.abs(delta.dot(up))/(tan*(mobile?C.fitPadding.mobileHeight:C.fitPadding.desktopHeight))+depth);}distance=Math.max(C.minDistance,Math.min(C.maxDistance,distance));if(mobile)center.addScaledVector(up,(title?.26:-.17)*distance*tan);else if(title)center.addScaledVector(right,-2.4);this.move(center,center.clone().addScaledVector(direction,distance));}
 overview(title=false){this.room=null;this.cam.fov=C.fov;this.cam.updateProjectionMatrix();this.controls.enabled=true;this.frameBox(new THREE.Box3(new THREE.Vector3(-11.5,-.4,-14.8),new THREE.Vector3(11.5,5.6,13.2)),new THREE.Vector3(.55,.85,1).normalize(),title);}
 update(dt){if(this.room){const look=this.input.consumeLook(),a=this.input.axis();this.yaw-=look.dx*.003+a.turn*dt*1.3;this.pitch=THREE.MathUtils.clamp(this.pitch-look.dy*.0025+a.pitch*dt,-1.05,1.05);const speed=T.immersive.walkSpeed*Math.min(dt,.05),len=Math.max(1,Math.hypot(a.x,a.z));this.cam.position.x+=(Math.cos(this.yaw)*a.x+Math.sin(this.yaw)*a.z)*speed/len;this.cam.position.z+=(-Math.sin(this.yaw)*a.x+Math.cos(this.yaw)*a.z)*speed/len;this.room.collide(this.cam.position);const b=this.room.bounds;this.cam.position.x=THREE.MathUtils.clamp(this.cam.position.x,b.minX+.2,b.maxX-.2);this.cam.position.z=THREE.MathUtils.clamp(this.cam.position.z,b.minZ+.2,b.maxZ-.2);this.roomLook();return;}this.input.consumeLook();if(this.tween)return this.stepTween(dt);if(this.flight){const k=1-Math.exp(-dt*C.focusRate);this.cam.position.lerp(this.flight.position,k);this.controls.target.lerp(this.flight.target,k);if(this.cam.position.distanceTo(this.flight.position)<.02)this.flight=null;}this.controls.update();}
 enterRoom(room){this.room=room;this.flight=null;this.framing=null;this.controls.enabled=false;this.cam.fov=T.immersive.fov;this.cam.updateProjectionMatrix();this.cam.position.set(...room.spawn);this.yaw=0;this.pitch=-.04;this.roomLook();}
 roomLook(){this.cam.rotation.order="YXZ";this.cam.rotation.set(this.pitch,this.yaw,0);}
 apply(){this.controls.update();}
 // Eased, awaitable flight used by the nested miniature dives; optional FOV change rides along.
 fly(target,position,seconds=1.6,fov=null){this.room=null;this.flight=null;this.framing=null;this.controls.enabled=false;this.tween?.resolve();
  if(this.settings.reducedMotion)seconds=.01;
  return new Promise(resolve=>{this.tween={t:0,seconds,fromP:this.cam.position.clone(),fromT:this.controls.target.clone(),toP:position.clone(),toT:target.clone(),fromFov:this.cam.fov,toFov:fov??this.cam.fov,resolve};});}
 stepTween(dt){const w=this.tween;w.t=Math.min(1,w.t+dt/w.seconds);const k=w.t<.5?4*w.t**3:1-(-2*w.t+2)**3/2;
  this.cam.position.lerpVectors(w.fromP,w.toP,k);this.controls.target.lerpVectors(w.fromT,w.toT,k);
  // Arc the path upward a little so dives read as a swoop, not a slide.
  this.cam.position.y+=Math.sin(Math.PI*k)*w.fromP.distanceTo(w.toP)*.08;
  this.cam.fov=THREE.MathUtils.lerp(w.fromFov,w.toFov,k);this.cam.updateProjectionMatrix();this.cam.lookAt(this.controls.target);
  if(w.t>=1){this.tween=null;this.controls.enabled=true;this.controls.update();w.resolve();}}
 place(p,yaw=0,pitch=0){this.flight=null;this.framing=null;this.cam.position.copy(p);const d=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));this.controls.target.copy(p).addScaledVector(d,5);this.controls.update();}
 _anglesTo(from,to){const d=to.clone().sub(from);return{yaw:Math.atan2(-d.x,-d.z),pitch:Math.atan2(d.y,Math.hypot(d.x,d.z))};}
}
