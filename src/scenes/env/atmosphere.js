// Atmospheric layers: light shafts, drifting fog, dust motes, embers, steam, flame and rain-on-glass.
// All are cheap shader materials (no extra render passes). `time` is the world's shared {value}
// uniform, so reduced-motion (which freezes world time) freezes every effect as well.
import * as THREE from 'three';

const NOISE = /* glsl */`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// Volumetric-looking shaft: open cone/cylinder or plane. Bright at uv.y=1 (source), fades along length,
// softens at grazing angles and near the camera so walking through it never flashes the screen.
export function shaftMaterial(time, { color = '#ffd9a0', intensity = .35, power = 1.6, plane = 0, dust = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uInt: { value: intensity }, uPow: { value: power }, uPlane: { value: plane }, uDust: { value: dust } },
    vertexShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uInt,uPow,uPlane,uDust;uniform vec3 uColor;varying vec2 vUv;varying vec3 vN;varying vec3 vW;${NOISE}
    void main(){vec3 V=normalize(cameraPosition-vW);float facing=abs(dot(normalize(vN),V));float edge=mix(pow(facing,1.6),facing*.6+.4,uPlane);
     float fall=pow(clamp(vUv.y,0.,1.),uPow);float side=mix(1.,smoothstep(0.,.3,vUv.x)*smoothstep(1.,.7,vUv.x),uPlane);
     float d=mix(1.,.65+.7*fbm(vec2(vUv.x*7.+vW.y*.3,vUv.y*3.-uTime*.05)),uDust);
     float near=smoothstep(.3,2.2,length(cameraPosition-vW));
     float a=edge*fall*side*d*near*uInt;gl_FragColor=vec4(uColor*a,1.);}`,
    side: THREE.DoubleSide, ...additive,
  });
}

// Open cone from (x,yTop,z) down to the floor.
export function shaftCone(time, { top = .3, bottom = 1.5, height = 2.8, color, intensity, power, segments = 32 } = {}) {
  const g = new THREE.CylinderGeometry(top, bottom, height, segments, 1, true);
  const m = new THREE.Mesh(g, shaftMaterial(time, { color, intensity, power }));
  m.renderOrder = 5; m.frustumCulled = true; m.userData.atmosphere = true;
  return m;
}

// Horizontal drifting fog sheet (woods). World-space noise so stacked sheets parallax against each other.
export function fogSheetMaterial(time, { color = '#8fa9ab', opacity = .35, scale = .16, speed = 1, fadeFar = 26 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uScale: { value: scale }, uSpeed: { value: speed }, uFar: { value: fadeFar } },
    vertexShader: `varying vec3 vW;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uOp,uScale,uSpeed,uFar;uniform vec3 uColor;varying vec3 vW;varying vec2 vUv;${NOISE}
    void main(){vec2 p=vW.xz*uScale;float t=uTime*uSpeed;float n=fbm(p+vec2(t*.035,t*.018));float m=fbm(p*2.3-vec2(t*.05,-t*.03)+n);
     float a=smoothstep(.32,.85,n*.65+m*.45);vec2 e=abs(vUv-.5)*2.;a*=smoothstep(1.,.6,max(e.x,e.y));
     float dist=length(cameraPosition.xz-vW.xz);a*=smoothstep(.8,4.,dist)*(1.-smoothstep(uFar*.6,uFar,dist));
     gl_FragColor=vec4(uColor,a*uOp);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Vertical mist curtain between distant trunks; yaw-billboarded by the owner each frame.
export function mistCardMaterial(time, { color = '#7f9a9c', opacity = .3 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: `varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uOp;uniform vec3 uColor;varying vec2 vUv;varying vec3 vW;${NOISE}
    void main(){float n=fbm(vec2(vUv.x*3.+vW.x*.05+uTime*.02,vUv.y*1.5-uTime*.01));float a=smoothstep(.25,.8,n);
     a*=smoothstep(0.,.2,vUv.x)*smoothstep(1.,.8,vUv.x)*pow(1.-vUv.y,1.6)*smoothstep(0.,.08,vUv.y);
     a*=smoothstep(2.,6.,length(cameraPosition-vW));gl_FragColor=vec4(uColor,a*uOp);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Dust motes that brighten where they pass through up to four light pools.
export function dustMotes(time, { count = 300, min = [-6, .2, -8], max = [6, 3.8, 7], color = '#ffe2b8', size = .012, lights = [], rise = 0 } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  let s = 77;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) { for (let k = 0; k < 3; k++) pos[i * 3 + k] = min[k] + r() * (max[k] - min[k]); seed[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const L = Array.from({ length: 4 }, (_, i) => lights[i] ? new THREE.Vector4(...lights[i]) : new THREE.Vector4(0, -99, 0, .01));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uScale: { value: 500 }, uMin: { value: new THREE.Vector3(...min) }, uBox: { value: new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]) }, uLights: { value: L }, uRise: { value: rise } },
    vertexShader: `attribute float aSeed;uniform float uTime,uSize,uScale,uRise;uniform vec3 uMin,uBox;uniform vec4 uLights[4];varying float vA;
    void main(){float t=uTime;vec3 p=position+vec3(sin(t*.06+aSeed*40.)*.5+t*.012,(uRise>0.?t*uRise*(.5+aSeed):sin(t*.05+aSeed*17.)*.35-t*.004),cos(t*.045+aSeed*23.)*.5);
     p=uMin+mod(p-uMin,uBox);float lit=.12;for(int i=0;i<4;i++){vec3 d=p-uLights[i].xyz;lit+=exp(-dot(d,d)/(uLights[i].w*uLights[i].w));}
     vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=max(1.5,uSize*(.5+aSeed)*uScale/max(.1,-mv.z));
     vA=min(lit,1.6)*smoothstep(.15,.9,-mv.z)*(.6+.4*sin(t*(.8+aSeed)+aSeed*50.));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d);gl_FragColor=vec4(uColor*a*vA*.55,1.);}`,
    ...additive,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.userData.atmosphere = true;
  return pts;
}

// Rising embers above a hearth.
export function embers(time, { count = 40, origin = [0, 0, 0], spread = [.9, .3], height = 2.2, color = '#ff8a3a' } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { seed[i] = (i * 0.6180339) % 1; pos[i * 3] = origin[0] + (((i * 7.31) % 1) - .5) * spread[0]; pos[i * 3 + 1] = origin[1]; pos[i * 3 + 2] = origin[2] + (((i * 3.77) % 1) - .5) * spread[1]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uH: { value: height }, uScale: { value: 500 } },
    vertexShader: `attribute float aSeed;uniform float uTime,uH,uScale;varying float vA;
    void main(){float life=1.6+aSeed*1.8;float age=mod(uTime+aSeed*7.,life)/life;vec3 p=position;p.y+=age*uH;p.x+=sin(age*6.+aSeed*30.)*.12*age;p.z+=cos(age*5.+aSeed*20.)*.08*age;
     vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=max(1.5,(.012+aSeed*.018)*uScale/max(.1,-mv.z));vA=(1.-age)*smoothstep(0.,.08,age)*(.6+.4*sin(uTime*13.+aSeed*90.));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(uColor*smoothstep(.5,0.,d)*vA*2.2,1.);}`,
    ...additive,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.userData.atmosphere = true;
  return p;
}

// Wisp of steam rising from a cup: small yaw-billboarded plane.
export function steamMaterial(time, { color = '#e8e2d6', opacity = .32, seed = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uSeed: { value: seed } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime,uOp,uSeed;uniform vec3 uColor;varying vec2 vUv;${NOISE}
    void main(){vec2 uv=vUv;float t=uTime+uSeed*10.;float w=fbm(vec2(uv.x*2.+uSeed,uv.y*2.2-t*.45));
     float x=uv.x-.5+(w-.5)*.75*uv.y+sin(uv.y*6.-t*1.3)*.06*uv.y;float width=.035+.16*uv.y;float core=exp(-x*x/(width*width));
     float breakup=smoothstep(.25,.7,fbm(vec2(uv.x*5.,uv.y*4.-t*.9)+uSeed));
     float a=core*breakup*smoothstep(0.,.12,uv.y)*pow(1.-uv.y,1.4)*uOp;gl_FragColor=vec4(uColor,a);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Stylised flame tongue, additive; three crossed/billboarded planes make a hearth fire.
export function flameMaterial(time, { seed = 0, intensity = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSeed: { value: seed }, uInt: { value: intensity } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime,uSeed,uInt;varying vec2 vUv;${NOISE}
    void main(){vec2 uv=vUv;float t=uTime*1.6+uSeed*13.;float n=fbm(vec2(uv.x*3.+uSeed,uv.y*2.5-t));float n2=fbm(vec2(uv.x*6.-uSeed,uv.y*5.-t*1.7));
     float x=(uv.x-.5)*2.+(n-.5)*.9*uv.y;float shape=1.-smoothstep(0.,1.,abs(x)/(1.05-uv.y*.95+.0001));shape*=smoothstep(0.,.08,uv.y);
     float body=clamp(shape*(.55+n2*.8)-uv.y*.35,0.,1.);
     vec3 c=mix(vec3(1.,.25,.04),vec3(1.,.62,.18),smoothstep(.15,.6,body));c=mix(c,vec3(1.,.9,.6),smoothstep(.65,.95,body));
     gl_FragColor=vec4(c*body*uInt,1.);}`,
    side: THREE.DoubleSide, ...additive,
  });
}

// Night window with rain: outside gradient, blurred far lights, static beads, running streaks
// and an occasional passing headlight. World-space so adjacent panes read as one view.
export function rainWindowMaterial(time, sweep) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSweep: sweep },
    vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime;uniform vec2 uSweep;varying vec3 vW;${NOISE}
    vec3 outside(vec2 p){vec3 c=mix(vec3(.012,.022,.026),vec3(.035,.06,.07),smoothstep(1.,3.2,p.y));
     float trees=smoothstep(.45,.55,fbm(vec2(p.x*.7,0.)) + (p.y-2.4)*.35);c=mix(c*.35,c,trees);
     // blurred far lights: warm street lamp, the motel's red sign, a cold sodium spill
     c+=vec3(1.,.65,.3)*.55*exp(-pow(length(p-vec2(2.6,2.1)),2.)*9.);c+=vec3(1.,.15,.18)*.35*exp(-pow(length(p-vec2(-4.3,1.7)),2.)*14.);
     c+=vec3(.7,.75,.6)*.18*exp(-pow(length(p-vec2(-1.,2.4)),2.)*6.);
     c+=vec3(1.,.92,.75)*uSweep.y*1.6*exp(-pow(length((p-vec2(uSweep.x,1.45))*vec2(.55,1.4)),2.)*2.2);
     return c;}
    vec2 beads(vec2 uv,float t){vec2 g=uv*vec2(14.,10.);vec2 id=floor(g),f=fract(g)-.5;float r=h21(id);vec2 o=(vec2(h21(id+3.1),h21(id+7.7))-.5)*.6;float d=length((f-o)*vec2(1.,.8));
     float size=.08+r*.12;float m=smoothstep(size,size*.55,d)*step(.35,r);return vec2(m,d/size);}
    float streak(vec2 uv,float t){float cols=24.;float cx=floor(uv.x*cols);float r=h21(vec2(cx,4.));float x=fract(uv.x*cols)-.5+sin(uv.y*9.+r*20.)*.06;
     float speed=.25+r*.5;float head=fract(-t*speed*.3+r*3.)*2.4+.3;float dy=uv.y-head;
     float trail=smoothstep(.0,.04,dy)*smoothstep(1.1,0.,dy)*smoothstep(.07,.02,abs(x))*step(.45,r);
     float drop=smoothstep(.12,.05,length(vec2(x,dy*1.2)))*step(.45,r);return max(trail*.5,drop);}
    void main(){vec2 p=vec2(-vW.z,vW.y);vec2 b=beads(p,uTime);float s=streak(p,uTime);float wet=max(b.x,s);
     vec2 refr=p+(vec2(fbm(p*4.),fbm(p*4.+5.))-.5)*.25*wet+vec2(0.,.12*wet);
     vec3 c=outside(refr);c*=1.+wet*.6;
     float rim=b.x*smoothstep(.55,1.,b.y);c+=vec3(.55,.6,.6)*(rim*.18+s*.05)*(.3+uSweep.y*2.);
     c+=vec3(.6,.7,.7)*.02*fbm(p*30.);
     gl_FragColor=vec4(c,1.);}`,
  });
}
