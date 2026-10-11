import T from '../design/tokens.json';
import * as THREE from 'three';

// 幕布：在顶点着色器中生成褶皱与缓慢摆动，并解析计算法线。
export function curtainMaterial(color = 0x8a0a0e, { sheen = 0.6, time } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.62, sheen, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).multiplyScalar(1.6), side: THREE.DoubleSide,
  });
  mat.userData.uTime = time ?? { value: 0 };
  mat.userData.uSway = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.uniforms.uSway = mat.userData.uSway;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uSway;
        float foldZ(vec3 p) {
          float sway = uSway * 0.03 * sin(uTime * 0.6 + p.x * 1.7) * (1.0 - uv.y);
          return 0.09 * sin(p.x * 11.0 + sin(p.x * 2.3) * 1.2) + 0.035 * sin(p.x * 27.0 + 1.3) + sway;
        }
        float foldD(vec3 p) {
          return 0.09 * 11.0 * cos(p.x * 11.0 + sin(p.x * 2.3) * 1.2) * (1.0 + cos(p.x * 2.3) * 2.3 * 1.2 / 11.0)
               + 0.035 * 27.0 * cos(p.x * 27.0 + 1.3)
               + uSway * 0.03 * 1.7 * cos(uTime * 0.6 + p.x * 1.7) * (1.0 - uv.y);
        }`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(vec3(-foldD(position), 0.0, 1.0));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.z += foldZ(position);`);
  };
  mat.customProgramCacheKey = () => 'curtain';
  return mat;
}

export function curtainWall(width, height, mat, segs = 160) {
  const g = new THREE.PlaneGeometry(width, height, Math.round(segs * width / 6), 2);
  g.translate(0, height / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// 黑白 Z 字地板纹理
export function chevronTexture(size = 512, bands = T.pattern.chevron.bands) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const period = size / 4;
  const palette=[T.pattern.chevron.dark,T.pattern.chevron.light].map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tri = Math.abs((x % period) - period / 2);
      const v = Math.floor(((y + tri) / size) * bands * 2) % 2;
      const i = (y * size + x) * 4;
      const col = palette[v];
      img.data[i] = col[0];img.data[i+1]=col[1];img.data[i+2]=col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 文字贴图（标牌、黑板字）
export function textTexture(lines, { w = 512, h = 256, bg = '#0c0c0c', fg = '#e8e2d0', font = '36px serif', align = 'center' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lh = h / (lines.length + 1);
  lines.forEach((l, i) => ctx.fillText(l, align === 'center' ? w / 2 : 24, lh * (i + 1)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 聚焦标记（浮在可交互物件上方的菱形光点）
export function focusMarker() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.3, 'rgba(255,220,150,0.6)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.lineTo(62, 32);
  ctx.lineTo(32, 62);
  ctx.lineTo(2, 32);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.12);
  s.renderOrder = 999;
  return s;
}

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
