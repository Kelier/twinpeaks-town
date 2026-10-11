// Per-place image-based lighting. Each place gets a tiny "light box" scene — dark shell plus
// emissive cards standing in for its real light sources — prefiltered once through PMREM.
// Chrome, glass, brass, ceramic, lacquer and wet surfaces then reflect plausible light shapes.
import * as THREE from 'three';

// Cards: [x, y, z, w, h, d, color, strength]. The shell is a 20 m cube around the origin.
const SPECS = {
  diner: { shell: '#120f0c', floor: '#2a2018', cards: [
    [0, 9.5, 4, 2.5, .2, 2.5, '#ffd3a0', 14], [0, 9.5, -2, 2.5, .2, 2.5, '#ffc98c', 12], [0, 9.5, -8, 2.5, .2, 2.5, '#f4b66e', 10],
    [-9.8, 3, 3, .2, 3, 4, '#6f97a0', 3.5], [-9.8, 3, -5, .2, 3, 4, '#6f97a0', 3],
    [6, 5, -9.8, 4, 1, .2, '#ff3a46', 4], [9.8, 2, 0, .2, 1.4, 12, '#5a3a24', 1.2] ] },
  lodge: { shell: '#140c08', floor: '#2b1a12', cards: [
    [-7, 1, -7, 2.5, 1.5, .2, '#ff7a2e', 18], [0, 9.6, 0, 5, .2, 5, '#e7c48c', 5],
    [-4, 4, -9.8, .8, 1, .2, '#efd4a2', 8], [4, 4, -9.8, .8, 1, .2, '#efd4a2', 8], [9.8, 3, 0, .2, 2, 10, '#5b3a22', 1.5] ] },
  woods: { shell: '#060c0f', floor: '#0d1410', cards: [
    [6, 9.6, -4, 3, .2, 3, '#b8d4d8', 6], [0, 6, -9.8, 16, 4, .2, '#1b3036', 1.2], [0, 4, 9.8, 16, 3, .2, '#132226', .9],
    [0, 1, -9.7, 1, 1.6, .2, '#a53740', 3] ] },
  redroom: { shell: '#2a0508', floor: '#151012', cards: [
    [0, 4, -9.8, 18, 8, .2, '#7a0d14', 1.4], [-9.8, 4, 0, .2, 8, 18, '#7a0d14', 1.2], [9.8, 4, 0, .2, 8, 18, '#7a0d14', 1.2], [0, 4, 9.8, 18, 8, .2, '#6a0a10', 1],
    [0, 9.6, 0, 3, .2, 3, '#ffd2aa', 10], [-7, 3, -6, .8, 1, .8, '#f5cb93', 8], [7, 3, -6, .8, 1, .8, '#f5cb93', 8] ] },
};

const cache = new WeakMap();

export function placeEnvironment(renderer, id) {
  let byId = cache.get(renderer);
  if (!byId) { byId = {}; cache.set(renderer, byId); }
  if (byId[id]) return byId[id];
  const spec = SPECS[id] ?? SPECS.diner;
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const shellMat = new THREE.MeshBasicMaterial({ color: spec.shell, side: THREE.BackSide });
  const shell = new THREE.Mesh(box, shellMat); shell.scale.set(20, 20, 20); scene.add(shell);
  const floor = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: spec.floor })); floor.scale.set(19.8, .2, 19.8); floor.position.y = -9.8; scene.add(floor);
  for (const [x, y, z, w, h, d, color, k] of spec.cards) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
    const c = new THREE.Mesh(box, m); c.position.set(x, y, z); c.scale.set(w, h, d); scene.add(c);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, .035);
  pmrem.dispose();
  scene.traverse((o) => o.material?.dispose());
  box.dispose();
  byId[id] = rt.texture;
  return rt.texture;
}
