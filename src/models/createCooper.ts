import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

type ProudRingStack = { rings: [number, number, number, number][] };

// Signed distance to a stack of ellipse rings. Negative inside, positive outside.
//
// The sign is exact; the magnitude is the first-order estimate f / |grad f|, which UNDERSTATES how
// clear an outside point is and OVERSTATES how deep an inside point is. Both errors make the march
// below push slightly further than strictly necessary, which is the safe direction: the failure
// being prevented is a component sinking into the one beneath it and rendering as a bare patch.
function ringStackDistance(stack: ProudRingStack, x: number, y: number, z: number): number {
  const rings = stack.rings;
  const yMin = rings[0][0];
  const yMax = rings[rings.length - 1][0];
  let rx = rings[0][1];
  let rz = rings[0][2];
  let zc = rings[0][3];
  if (y >= yMax) {
    const last = rings[rings.length - 1];
    rx = last[1]; rz = last[2]; zc = last[3];
  } else if (y > yMin) {
    for (let i = 0; i + 1 < rings.length; i += 1) {
      const lo = rings[i];
      const hi = rings[i + 1];
      if (y >= lo[0] && y <= hi[0]) {
        const span = hi[0] - lo[0];
        const t = span > 1e-9 ? (y - lo[0]) / span : 0;
        rx = lo[1] + (hi[1] - lo[1]) * t;
        rz = lo[2] + (hi[2] - lo[2]) * t;
        zc = lo[3] + (hi[3] - lo[3]) * t;
        break;
      }
    }
  }
  const dx = x / rx;
  const dz = (z - zc) / rz;
  const f = dx * dx + dz * dz - 1;
  const gx = (2 * x) / (rx * rx);
  const gz = (2 * (z - zc)) / (rz * rz);
  const grad = Math.hypot(gx, gz);
  const radial = grad < 1e-12 ? -Math.min(rx, rz) : f / grad;
  const axial = Math.max(yMin - y, y - yMax);
  return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
}

// Push every vertex outward until it stands `clearance` clear of the target's surface.
//
// WHY THE AUTHORED NUMBERS ARE ONLY A LOWER BOUND. A ring is an ELLIPSE, and the surface it has to
// clear generally is not. Any single ellipse that clears the widest point is loose at the narrowest
// and vice versa, so hand-widening moves the error rather than shrinking it -- measured on hair,
// where widening the side masses took closure from 42.2% to 40.9%, worse on all six views, with
// dark coverage DOWN because the widened mass had slid off the skull. Here the authored width is a
// floor and the real radius is MEASURED per vertex.
//
// Each vertex travels along its OWN radial spoke rather than along the field's gradient, so the
// ring keeps its vertex order and its seam positions and only its radius changes. `maxPush` is
// required, not a safeguard: an uncapped march walks inner vertices straight through the target and
// out the far side, closing the very gap the component exists to leave.
function applyStandProud(
  geometry: THREE.BufferGeometry,
  marcher: THREE.Object3D,
  target: THREE.Object3D,
  stack: ProudRingStack,
  clearance: number,
  maxPush: number,
): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  marcher.updateWorldMatrix(true, false);
  target.updateWorldMatrix(true, false);
  const toTarget = new THREE.Matrix4().copy(target.matrixWorld).invert().multiply(marcher.matrixWorld);
  const fromTarget = new THREE.Matrix4().copy(toTarget).invert();
  const p = new THREE.Vector3();
  // A vertex can exhaust `maxPush` and still be inside the target. That is the cap doing its job --
  // an uncapped march walks vertices out the far side -- but it means the clearance this function
  // promises was NOT achieved, and saying nothing there hides exactly the defect the caller asked
  // to be protected from. Measured on the shipped fixture: 2 of 8 sampled hair vertices sat 0.059
  // inside a skull against a 0.04 cap and could never have reached clear.
  let unresolved = 0;

  for (let i = 0; i < position.count; i += 1) {
    p.fromBufferAttribute(position, i).applyMatrix4(toTarget);
    // The spoke is the vertex's own radial direction in the target's frame; marching along it keeps
    // each ring a ring, since every vertex holds its own angle and only its radius changes.
    //
    // A vertex on the axis has no radial direction at all -- and that is precisely the crown, the
    // one place a bald patch is most visible. Skipping it leaves the exact failure this function
    // exists to prevent. So a degenerate spoke marches axially instead, out through whichever cap
    // it is nearer, which is the direction the field itself measures there.
    const spokeLength = Math.hypot(p.x, p.z);
    const onAxis = spokeLength < 1e-9;
    const midHeight = (stack.rings[0][0] + stack.rings[stack.rings.length - 1][0]) / 2;
    const sx = onAxis ? 0 : p.x / spokeLength;
    const sz = onAxis ? 0 : p.z / spokeLength;
    const sy = onAxis ? (p.y >= midHeight ? 1 : -1) : 0;

    let travelled = 0;
    for (let step = 0; step < 24; step += 1) {
      const gap = ringStackDistance(stack, p.x, p.y, p.z);
      if (gap >= clearance) break;
      const move = Math.min(Math.max(0.002, clearance - gap), maxPush - travelled);
      if (move <= 0) break;
      p.x += sx * move;
      p.y += sy * move;
      p.z += sz * move;
      travelled += move;
    }

    if (ringStackDistance(stack, p.x, p.y, p.z) < clearance) unresolved += 1;

    p.applyMatrix4(fromTarget);
    position.setXYZ(i, p.x, p.y, p.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  geometry.userData.standProud = { clearance, maxPush, unresolved, total: position.count };
  if (unresolved > 0) {
    console.warn(
      `standProud: ${unresolved}/${position.count} vertices could not reach ${clearance} within ` +
      `maxPush ${maxPush}. They are still inside the target and will render as bare patches. ` +
      `Raise maxPush, or move the component out so it does not start that deep.`,
    );
  }
}

type SdfVector = readonly [number, number, number];
type SdfTransform = { position?: SdfVector; translation?: SdfVector; rotation?: SdfVector; scale?: SdfVector };
type SdfPrimitive = {
  readonly id: string;
  readonly type: 'sphere' | 'capsule' | 'box' | 'cone' | 'ellipsoid';
  readonly center?: SdfVector;
  readonly radius?: number | SdfVector;
  readonly height?: number;
  readonly size?: SdfVector;
  readonly dimensions?: SdfVector;
  readonly radii?: SdfVector;
  readonly transform?: SdfTransform;
};
type SdfOperation = {
  readonly id?: string;
  readonly output?: string;
  readonly type: 'smooth-union' | 'subtract' | 'intersect';
  readonly left: string;
  readonly right: string;
  readonly radius?: number;
};
type SdfDescriptor = {
  readonly primitives: readonly SdfPrimitive[];
  readonly operations?: readonly SdfOperation[];
  readonly resolution: number;
  readonly bounds?: { readonly min: SdfVector; readonly max: SdfVector };
};
type SdfFunction = (point: THREE.Vector3) => number;

function sdfSphere(point: THREE.Vector3, radius: number): number {
  return point.length() - radius;
}

function sdfCapsule(point: THREE.Vector3, radius: number, height: number): number {
  const halfHeight = height * 0.5;
  const y = Math.max(-halfHeight, Math.min(halfHeight, point.y));
  return point.distanceTo(new THREE.Vector3(0, y, 0)) - radius;
}

function sdfBox(point: THREE.Vector3, size: SdfVector): number {
  const q = new THREE.Vector3(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z))
    .sub(new THREE.Vector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
  return q.clone().max(new THREE.Vector3()).length() + Math.min(Math.max(q.x, q.y, q.z), 0);
}

function sdfCone(point: THREE.Vector3, radius: number, height: number): number {
  const halfHeight = height * 0.5;
  const taper = radius * (1 - (point.y + halfHeight) / height);
  return Math.max(Math.hypot(point.x, point.z) - Math.max(0, taper), Math.abs(point.y) - halfHeight);
}

function sdfEllipsoid(point: THREE.Vector3, radii: SdfVector): number {
  const scaled = new THREE.Vector3(point.x / radii[0], point.y / radii[1], point.z / radii[2]);
  return (scaled.length() - 1) * Math.min(radii[0], radii[1], radii[2]);
}

function sdfRadii(primitive: SdfPrimitive): SdfVector {
  const radius = primitive.radius;
  if (primitive.radii) return primitive.radii;
  if (typeof radius === 'number') return [radius, radius, radius];
  return radius ?? [0.5, 0.5, 0.5];
}

function smin(left: number, right: number, radius: number): number {
  const blend = Math.max(radius - Math.abs(left - right), 0) / radius;
  return Math.min(left, right) - blend * blend * radius * 0.25;
}

function sdfLocalPoint(point: THREE.Vector3, primitive: SdfPrimitive): { point: THREE.Vector3; scale: number } {
  const transform = primitive.transform;
  const translation = transform?.position ?? transform?.translation ?? primitive.center ?? [0, 0, 0];
  const rotation = transform?.rotation ?? [0, 0, 0];
  const scale = transform?.scale ?? [1, 1, 1];
  const local = point.clone().sub(new THREE.Vector3(translation[0], translation[1], translation[2]));
  const inverseRotation = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]))
    .invert();
  local.applyQuaternion(inverseRotation);
  local.set(local.x / scale[0], local.y / scale[1], local.z / scale[2]);
  return { point: local, scale: Math.min(scale[0], scale[1], scale[2]) };
}

function sdfPrimitive(point: THREE.Vector3, primitive: SdfPrimitive): number {
  const local = sdfLocalPoint(point, primitive);
  let distance: number;
  switch (primitive.type) {
    case 'sphere':
      distance = sdfSphere(local.point, typeof primitive.radius === 'number' ? primitive.radius : 0.5);
      break;
    case 'capsule':
      distance = sdfCapsule(local.point, typeof primitive.radius === 'number' ? primitive.radius : 0.25, primitive.height ?? 1);
      break;
    case 'box':
      distance = sdfBox(local.point, primitive.size ?? primitive.dimensions ?? [1, 1, 1]);
      break;
    case 'cone':
      distance = sdfCone(local.point, typeof primitive.radius === 'number' ? primitive.radius : 0.5, primitive.height ?? 1);
      break;
    case 'ellipsoid':
      distance = sdfEllipsoid(local.point, sdfRadii(primitive));
      break;
  }
  return distance * local.scale;
}

function sdfSample(descriptor: SdfDescriptor): SdfFunction {
  const nodes = new Map<string, SdfFunction>();
  for (const primitive of descriptor.primitives) nodes.set(primitive.id, (point) => sdfPrimitive(point, primitive));
  let result = descriptor.primitives.length > 0 ? nodes.get(descriptor.primitives[0].id) : undefined;
  for (let index = 0; index < (descriptor.operations?.length ?? 0); index += 1) {
    const operation = descriptor.operations?.[index];
    if (!operation) continue;
    const left = nodes.get(operation.left);
    const right = nodes.get(operation.right);
    if (!left || !right) continue;
    let combined: SdfFunction;
    switch (operation.type) {
      case 'smooth-union':
        combined = (point) => smin(left(point), right(point), operation.radius ?? 0.1);
        break;
      case 'subtract':
        combined = (point) => Math.max(left(point), -right(point));
        break;
      case 'intersect':
        combined = (point) => Math.max(left(point), right(point));
        break;
    }
    nodes.set(operation.id ?? operation.output ?? `operation-${index}`, combined);
    result = combined;
  }
  return result ?? (() => Infinity);
}

function polygonizeSdf(descriptor: SdfDescriptor): THREE.BufferGeometry {
  // SURFACE NETS, not a voxel shell.
  //
  // This used to emit one axis-aligned quad per exposed voxel face, which is a Minecraft surface:
  // every face is axis-aligned, every edge is a 90-degree step, and the result is stair-stepped at
  // exactly the scale of the sampling grid. For a subject whose whole identity is smooth blended
  // organic form -- which is the only kind of subject anyone reaches for an implicit surface to
  // build -- that is worse than the assembled primitives it was meant to replace.
  //
  // Naive surface nets places ONE vertex per sign-changing cell, at the average of the linearly
  // interpolated crossings on that cell's edges, and joins the four cells around each crossing
  // edge into a quad. It is compact, manifold, and smooth, and it is a natural fit for a field
  // that can be sampled anywhere rather than only at corners.
  //
  // Normals come from the field GRADIENT, not from face averaging: the gradient is the exact
  // surface normal of the implicit surface, so shading no longer carries the grid's imprint.
  const resolution = Math.max(4, Math.min(64, Math.floor(descriptor.resolution)));
  const defaultBounds: { readonly min: SdfVector; readonly max: SdfVector } = { min: [-2, -2, -2], max: [2, 2, 2] };
  const bounds = descriptor.bounds ?? defaultBounds;
  const min = new THREE.Vector3(bounds.min[0], bounds.min[1], bounds.min[2]);
  const step = new THREE.Vector3(
    (bounds.max[0] - bounds.min[0]) / resolution,
    (bounds.max[1] - bounds.min[1]) / resolution,
    (bounds.max[2] - bounds.min[2]) / resolution,
  );
  const sample = sdfSample(descriptor);
  const scratch = new THREE.Vector3();

  // Corner grid: one more corner than cells on each axis.
  const side = resolution + 1;
  const field = new Float32Array(side * side * side);
  const cornerAt = (x: number, y: number, z: number): number => (z * side + y) * side + x;
  for (let z = 0; z < side; z += 1) {
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        scratch.set(min.x + x * step.x, min.y + y * step.y, min.z + z * step.z);
        field[cornerAt(x, y, z)] = sample(scratch);
      }
    }
  }

  // The 12 cell edges as corner-offset pairs.
  const CUBE_EDGES: readonly (readonly [number, number, number, number, number, number])[] = [
    [0, 0, 0, 1, 0, 0], [1, 0, 0, 1, 1, 0], [0, 1, 0, 1, 1, 0], [0, 0, 0, 0, 1, 0],
    [0, 0, 1, 1, 0, 1], [1, 0, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1], [0, 0, 1, 0, 1, 1],
    [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [1, 1, 0, 1, 1, 1], [0, 1, 0, 0, 1, 1],
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const cellVertex = new Int32Array(resolution * resolution * resolution).fill(-1);
  const cellAt = (x: number, y: number, z: number): number => (z * resolution + y) * resolution + x;

  // Central-difference gradient, stepped at a fraction of a cell so it follows the field rather
  // than the grid.
  const epsilon = Math.min(step.x, step.y, step.z) * 0.25;
  const gradient = (point: THREE.Vector3): THREE.Vector3 => {
    const gx = sample(scratch.set(point.x + epsilon, point.y, point.z))
      - sample(scratch.set(point.x - epsilon, point.y, point.z));
    const gy = sample(scratch.set(point.x, point.y + epsilon, point.z))
      - sample(scratch.set(point.x, point.y - epsilon, point.z));
    const gz = sample(scratch.set(point.x, point.y, point.z + epsilon))
      - sample(scratch.set(point.x, point.y, point.z - epsilon));
    const normal = new THREE.Vector3(gx, gy, gz);
    // A point where the field is flat has no defined normal; +Y is arbitrary but finite, and
    // leaving a zero vector would poison every lighting calculation downstream.
    return normal.lengthSq() < 1e-20 ? new THREE.Vector3(0, 1, 0) : normal.normalize();
  };

  for (let z = 0; z < resolution; z += 1) {
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        let crossings = 0;
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        for (const [ax, ay, az, bx, by, bz] of CUBE_EDGES) {
          const a = field[cornerAt(x + ax, y + ay, z + az)];
          const b = field[cornerAt(x + bx, y + by, z + bz)];
          if ((a <= 0) === (b <= 0)) continue;
          const t = a / (a - b);
          sumX += (ax + (bx - ax) * t);
          sumY += (ay + (by - ay) * t);
          sumZ += (az + (bz - az) * t);
          crossings += 1;
        }
        if (crossings === 0) continue;
        const px = min.x + (x + sumX / crossings) * step.x;
        const py = min.y + (y + sumY / crossings) * step.y;
        const pz = min.z + (z + sumZ / crossings) * step.z;
        cellVertex[cellAt(x, y, z)] = positions.length / 3;
        positions.push(px, py, pz);
        const normal = gradient(new THREE.Vector3(px, py, pz));
        normals.push(normal.x, normal.y, normal.z);
      }
    }
  }

  // One quad per sign-changing grid edge, joining the four cells that share it.
  //
  // Winding, worked out rather than guessed. For the +x edge from corner (x,y,z), the four cells
  // around it are (x, y-1, z-1), (x, y, z-1), (x, y, z), (x, y-1, z); in the (y,z) plane that
  // traversal is +y, +z, -y, whose cross product is +x. So when the corner is INSIDE and its
  // neighbour is outside, the unflipped order already faces out, and the flip belongs on the
  // opposite case. Getting this backwards is invisible in the normals -- those come from the
  // gradient and stay correct -- and shows only as back-face culling removing the front surface,
  // i.e. the model rendering as a hollow shell with its interior visible.
  const quad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  // Each quad joins the FOUR cells sharing one grid edge, so every one of those cells must exist.
  // Bounding only the edge axis and the lower end of the other two let y/z reach `resolution`, which
  // is a corner index, not a cell index: `cellAt` then strides into an unrelated slot (with
  // resolution 8, `cellAt(3, 8, 1)` is 131 -- the slot for cell (3, 0, 2)) or past the end of the
  // array, where a typed-array read yields `undefined`. `undefined < 0` is false, so the guard in
  // `quad` passed it through to `setIndex`, which coerces it to 0. Measured on a sphere reaching its
  // own bounds at resolution 8: 60 out-of-range reads and 108 aliased reads. A surface that touches
  // the sampling box is therefore left OPEN at that face rather than closed with wrong triangles --
  // pad `bounds` past the surface to get a closed mesh.
  for (let z = 0; z < side; z += 1) {
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const here = field[cornerAt(x, y, z)] <= 0;
        if (x + 1 < side && y > 0 && z > 0 && y < side - 1 && z < side - 1
          && here !== (field[cornerAt(x + 1, y, z)] <= 0)) {
          quad(
            cellVertex[cellAt(x, y - 1, z - 1)], cellVertex[cellAt(x, y, z - 1)],
            cellVertex[cellAt(x, y, z)], cellVertex[cellAt(x, y - 1, z)], !here,
          );
        }
        if (y + 1 < side && x > 0 && z > 0 && x < side - 1 && z < side - 1
          && here !== (field[cornerAt(x, y + 1, z)] <= 0)) {
          quad(
            cellVertex[cellAt(x - 1, y, z - 1)], cellVertex[cellAt(x - 1, y, z)],
            cellVertex[cellAt(x, y, z)], cellVertex[cellAt(x, y, z - 1)], !here,
          );
        }
        if (z + 1 < side && x > 0 && y > 0 && x < side - 1 && y < side - 1
          && here !== (field[cornerAt(x, y, z + 1)] <= 0)) {
          quad(
            cellVertex[cellAt(x - 1, y - 1, z)], cellVertex[cellAt(x, y - 1, z)],
            cellVertex[cellAt(x, y, z)], cellVertex[cellAt(x - 1, y, z)], !here,
          );
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

type TaperedStation = { position: [number, number, number]; rx: number; rz: number; twist?: number };

// Frames come from PARALLEL TRANSPORT, not from a Frenet frame. A Frenet frame is defined by
// the curve's normal, which flips sign wherever the path has an inflection or straightens out,
// and every flip twists the surface 180 degrees within one segment. Carrying the previous frame
// forward and removing only its along-path component keeps the twist continuous. THREE's own
// extrudePath and TubeGeometry do not expose this, which is why this is hand-built.
function buildTaperedSweepGeometry(
  sweep: { stations: TaperedStation[]; radialSegments?: number; capEnds?: boolean },
): THREE.BufferGeometry {
  const stations = sweep.stations;
  if (stations.length < 2) throw new Error('tapered-sweep needs at least two stations');
  const radial = Math.max(3, sweep.radialSegments ?? 10);
  const centres = stations.map((s) => new THREE.Vector3(...s.position));

  const tangents = centres.map((_, i) => {
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    const t = next.clone().sub(prev);
    // Coincident neighbours would normalise to NaN and poison every downstream vertex.
    return t.lengthSq() < 1e-12 ? new THREE.Vector3(0, 1, 0) : t.normalize();
  });

  // Seed a reference axis that is not parallel to the first tangent, or the first cross
  // product is degenerate and the whole sweep collapses to a line.
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(tangents[0].dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);

  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let carried = ref.clone().sub(tangents[0].clone().multiplyScalar(ref.dot(tangents[0]))).normalize();
  for (let i = 0; i < tangents.length; i += 1) {
    const t = tangents[i];
    // Project the carried frame back onto the plane perpendicular to this tangent.
    const n = carried.clone().sub(t.clone().multiplyScalar(carried.dot(t)));
    if (n.lengthSq() < 1e-12) {
      const fallback = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      n.copy(fallback.sub(t.clone().multiplyScalar(fallback.dot(t))));
    }
    n.normalize();
    normals.push(n);
    binormals.push(new THREE.Vector3().crossVectors(t, n).normalize());
    carried = n;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringStart: number[] = [];
  const isPoint: boolean[] = [];

  for (let i = 0; i < stations.length; i += 1) {
    const st = stations[i];
    const v = i / (stations.length - 1);
    ringStart.push(positions.length / 3);
    // A station whose section has collapsed emits ONE vertex, not a ring of radius zero.
    // A degenerate ring still carries `radial` coincident vertices and `radial` zero-area
    // triangles, so the lock ends in a blunt cap the width of the floating-point noise
    // rather than at a point -- and a hair lock, a horn or a blade tip has to reach a point.
    if (st.rx <= 1e-6 && st.rz <= 1e-6) {
      isPoint.push(true);
      positions.push(centres[i].x, centres[i].y, centres[i].z);
      uvs.push(0.5, v);
      continue;
    }
    isPoint.push(false);
    const twist = ((st.twist ?? 0) * Math.PI) / 180;
    for (let j = 0; j <= radial; j += 1) {
      const theta = (j / radial) * Math.PI * 2 + twist;
      const offset = normals[i].clone().multiplyScalar(Math.cos(theta) * st.rx)
        .add(binormals[i].clone().multiplyScalar(Math.sin(theta) * st.rz));
      const p = centres[i].clone().add(offset);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, v);
    }
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    if (isPoint[i] && isPoint[i + 1]) continue;   // two collapsed stations bound nothing
    for (let j = 0; j < radial; j += 1) {
      // Wound so the face normal points radially OUTWARD.
      //
      // Ring vertices advance from `normal` toward `binormal`, and binormal is
      // tangent x normal, so increasing theta runs counter-clockwise seen from the
      // far end of the segment. Taking the ring-to-ring edge first therefore puts
      // the cross product on the inside. Measured as signed volume on the built
      // mesh: every tapered-sweep came out negative -- a torso at -0.0674 and a
      // tail at -0.0044 against a positive ellipsoid head -- so every sweep this
      // generator has ever emitted rendered its back faces, with normals pointing
      // into the solid and every lighting judgement made on the wrong surface.
      if (isPoint[i]) indices.push(a0, b0 + j + 1, b0 + j);
      else if (isPoint[i + 1]) indices.push(a0 + j, a0 + j + 1, b0);
      else indices.push(a0 + j, a0 + j + 1, b0 + j, a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }

  if (sweep.capEnds ?? true) {
    for (const end of [0, stations.length - 1]) {
      if (isPoint[end]) continue;   // a point end is already closed
      const centreIndex = positions.length / 3;
      positions.push(centres[end].x, centres[end].y, centres[end].z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      const base = ringStart[end];
      for (let j = 0; j < radial; j += 1) {
        if (end === 0) indices.push(centreIndex, base + j + 1, base + j);
        else indices.push(centreIndex, base + j, base + j + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Cooper — static painted miniature
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createCooperStaticPaintedMiniatureModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Cooper \u2014 static painted miniature";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {"id": "hidden", "name": "hidden", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"]}, "colorVariation": {"palette": ["#000000"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 1, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "hidden-edge", "region": "edges and folds", "color": "#000000", "roughness": 0.92, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "plastic", "opacity": {"base": 0}, "qualityTier": "utility"},
    options
  );
  materialMap["jacket"] = createSculptMaterial(
    "jacket",
    {"id": "jacket", "name": "jacket", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#292824", "color": "#292824", "albedo": {"dominant": "#292824", "secondary": ["#292824"]}, "colorVariation": {"palette": ["#292824"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.88, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "jacket-edge", "region": "edges and folds", "color": "#292824", "roughness": 0.8, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "fabric"},
    options
  );
  materialMap["hair"] = createSculptMaterial(
    "hair",
    {"id": "hair", "name": "hair", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#25241f", "color": "#25241f", "albedo": {"dominant": "#25241f", "secondary": ["#25241f"]}, "colorVariation": {"palette": ["#25241f"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.72, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "hair-edge", "region": "edges and folds", "color": "#25241f", "roughness": 0.64, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "plastic"},
    options
  );
  materialMap["skin"] = createSculptMaterial(
    "skin",
    {"id": "skin", "name": "skin", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#d5c8b0", "color": "#d5c8b0", "albedo": {"dominant": "#d5c8b0", "secondary": ["#d5c8b0"]}, "colorVariation": {"palette": ["#d5c8b0"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.74, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "skin-edge", "region": "edges and folds", "color": "#d5c8b0", "roughness": 0.66, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "skin"},
    options
  );
  materialMap["ivory"] = createSculptMaterial(
    "ivory",
    {"id": "ivory", "name": "ivory", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e1d8bf", "color": "#e1d8bf", "albedo": {"dominant": "#e1d8bf", "secondary": ["#e1d8bf"]}, "colorVariation": {"palette": ["#e1d8bf"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.64, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "ivory-edge", "region": "edges and folds", "color": "#e1d8bf", "roughness": 0.56, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "fabric"},
    options
  );
  materialMap["shoes"] = createSculptMaterial(
    "shoes",
    {"id": "shoes", "name": "shoes", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#222522", "color": "#222522", "albedo": {"dominant": "#222522", "secondary": ["#222522"]}, "colorVariation": {"palette": ["#222522"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.38, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "shoes-edge", "region": "edges and folds", "color": "#222522", "roughness": 0.3, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "rubber"},
    options
  );
  materialMap["coffee"] = createSculptMaterial(
    "coffee",
    {"id": "coffee", "name": "coffee", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#26190f", "color": "#26190f", "albedo": {"dominant": "#26190f", "secondary": ["#26190f"]}, "colorVariation": {"palette": ["#26190f"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.28, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "coffee-edge", "region": "edges and folds", "color": "#26190f", "roughness": 0.25, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "ceramic"},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "root__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1)", "secondaryAlbedo": "rgba(0, 0, 0, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [0.001, 0.001, 0.001]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 1)", "secondaryAlbedo": "rgba(0, 0, 0, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_pelvis_1 = makeAttachmentEndpoint(null);
  const node_pelvis_1 = new THREE.Group();
  node_pelvis_1.name = "pelvis__pivot";
  node_pelvis_1.scale.set(1, 1, 1);
  if (endpoint_pelvis_1) {
    node_pelvis_1.position.copy(endpoint_pelvis_1.start);
    node_pelvis_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pelvis_1.position.set(0.0, 0.91, 0.0);
    node_pelvis_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "pelvis", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "pelvis-contact", "localStart": [0, 0.91, 0], "localEnd": [0, 0.93, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.44, "height": 0.34, "depth": 0.3, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.91, 0], "rotation": [0, 0, 0], "scale": [0.44, 0.34, 0.3]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_pelvis_1.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_pelvis_1);
  nodes["pelvis"] = node_pelvis_1;
  const mesh_pelvis_1Geometry = endpoint_pelvis_1
    ? new THREE.CylinderGeometry(endpoint_pelvis_1.endRadius, endpoint_pelvis_1.baseRadius, endpoint_pelvis_1.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pelvis_1) {
    mesh_pelvis_1Geometry.scale(0.44, 0.34, 0.3);
  }
  const mesh_pelvis_1 = new THREE.Mesh(
    mesh_pelvis_1Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pelvis_1.name = "pelvis";
  if (endpoint_pelvis_1) {
    mesh_pelvis_1.position.copy(endpoint_pelvis_1.midpoint);
    mesh_pelvis_1.quaternion.copy(endpoint_pelvis_1.quaternion);
  }
  mesh_pelvis_1.castShadow = options.castShadow ?? true;
  mesh_pelvis_1.receiveShadow = options.receiveShadow ?? true;
  mesh_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "pelvis", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "pelvis-contact", "localStart": [0, 0.91, 0], "localEnd": [0, 0.93, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.44, "height": 0.34, "depth": 0.3, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.91, 0], "rotation": [0, 0, 0], "scale": [0.44, 0.34, 0.3]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_pelvis_1.add(mesh_pelvis_1);
  meshes["pelvis"] = mesh_pelvis_1;
  colliders["pelvis"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pelvis"] ??= [];
  destructionGroups["pelvis"].push(node_pelvis_1);

  const endpoint_jacket_2 = makeAttachmentEndpoint(null);
  const node_jacket_2 = new THREE.Group();
  node_jacket_2.name = "jacket__pivot";
  node_jacket_2.scale.set(1, 1, 1);
  if (endpoint_jacket_2) {
    node_jacket_2.position.copy(endpoint_jacket_2.start);
    node_jacket_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_jacket_2.position.set(0.0, 1.05, 0.0);
    node_jacket_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_jacket_2.userData.sculptComponent = {"id": "jacket", "name": "jacket", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, -0.12], [0.245, -0.12], [0.24, -0.03], [0.215, 0.12], [0.24, 0.34], [0.3, 0.5], [0.27, 0.55], [0.13, 0.6], [0, 0.6]], "segments": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-contact", "localStart": [0, 0.98, 0], "localEnd": [0, 1.07, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.66, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.05, 0], "rotation": [0, 0, 0], "scale": [1, 1, 0.66]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_2.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_jacket_2);
  nodes["jacket"] = node_jacket_2;
  const mesh_jacket_2Geometry = endpoint_jacket_2
    ? new THREE.CylinderGeometry(endpoint_jacket_2.endRadius, endpoint_jacket_2.baseRadius, endpoint_jacket_2.length, 16, 6)
    : buildLatheGeometry({"points": [[0, -0.12], [0.245, -0.12], [0.24, -0.03], [0.215, 0.12], [0.24, 0.34], [0.3, 0.5], [0.27, 0.55], [0.13, 0.6], [0, 0.6]], "segments": 48});
  if (!endpoint_jacket_2) {
    mesh_jacket_2Geometry.scale(1.0, 1.0, 0.66);
  }
  const mesh_jacket_2 = new THREE.Mesh(
    mesh_jacket_2Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_jacket_2.name = "jacket";
  if (endpoint_jacket_2) {
    mesh_jacket_2.position.copy(endpoint_jacket_2.midpoint);
    mesh_jacket_2.quaternion.copy(endpoint_jacket_2.quaternion);
  }
  mesh_jacket_2.castShadow = options.castShadow ?? true;
  mesh_jacket_2.receiveShadow = options.receiveShadow ?? true;
  mesh_jacket_2.userData.sculptComponent = {"id": "jacket", "name": "jacket", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, -0.12], [0.245, -0.12], [0.24, -0.03], [0.215, 0.12], [0.24, 0.34], [0.3, 0.5], [0.27, 0.55], [0.13, 0.6], [0, 0.6]], "segments": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-contact", "localStart": [0, 0.98, 0], "localEnd": [0, 1.07, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.66, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.05, 0], "rotation": [0, 0, 0], "scale": [1, 1, 0.66]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_2.add(mesh_jacket_2);
  meshes["jacket"] = mesh_jacket_2;
  colliders["jacket"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["jacket"] ??= [];
  destructionGroups["jacket"].push(node_jacket_2);

  const endpoint_neck_3 = makeAttachmentEndpoint(null);
  const node_neck_3 = new THREE.Group();
  node_neck_3.name = "neck__pivot";
  node_neck_3.scale.set(1, 1, 1);
  if (endpoint_neck_3) {
    node_neck_3.position.copy(endpoint_neck_3.start);
    node_neck_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_neck_3.position.set(0.0, 1.64, 0.0);
    node_neck_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_neck_3.userData.sculptComponent = {"id": "neck", "name": "neck", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "neck-contact", "localStart": [0, 1.59, 0], "localEnd": [0, 1.66, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.15, "height": 0.19, "depth": 0.17, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.64, 0], "rotation": [0, 0, 0], "scale": [0.15, 0.19, 0.17]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_neck_3.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_neck_3);
  nodes["neck"] = node_neck_3;
  const mesh_neck_3Geometry = endpoint_neck_3
    ? new THREE.CylinderGeometry(endpoint_neck_3.endRadius, endpoint_neck_3.baseRadius, endpoint_neck_3.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_neck_3) {
    mesh_neck_3Geometry.scale(0.15, 0.19, 0.17);
  }
  const mesh_neck_3 = new THREE.Mesh(
    mesh_neck_3Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_neck_3.name = "neck";
  if (endpoint_neck_3) {
    mesh_neck_3.position.copy(endpoint_neck_3.midpoint);
    mesh_neck_3.quaternion.copy(endpoint_neck_3.quaternion);
  }
  mesh_neck_3.castShadow = options.castShadow ?? true;
  mesh_neck_3.receiveShadow = options.receiveShadow ?? true;
  mesh_neck_3.userData.sculptComponent = {"id": "neck", "name": "neck", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "neck-contact", "localStart": [0, 1.59, 0], "localEnd": [0, 1.66, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.15, "height": 0.19, "depth": 0.17, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.64, 0], "rotation": [0, 0, 0], "scale": [0.15, 0.19, 0.17]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_neck_3.add(mesh_neck_3);
  meshes["neck"] = mesh_neck_3;
  colliders["neck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["neck"] ??= [];
  destructionGroups["neck"].push(node_neck_3);

  const endpoint_head_4 = makeAttachmentEndpoint(null);
  const node_head_4 = new THREE.Group();
  node_head_4.name = "head__pivot";
  node_head_4.scale.set(1, 1, 1);
  if (endpoint_head_4) {
    node_head_4.position.copy(endpoint_head_4.start);
    node_head_4.rotation.set(0.0, -0.25, 0.0);
  } else {
    node_head_4.position.set(0.0, 1.82, 0.0);
    node_head_4.rotation.set(0.0, -0.25, 0.0);
  }
  node_head_4.userData.sculptComponent = {"id": "head", "name": "head", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "implicit", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "sdf": {"primitives": [{"id": "cranium", "type": "ellipsoid", "center": [0, 0.04, -0.015], "radii": [0.137, 0.145, 0.126]}, {"id": "jaw", "type": "ellipsoid", "center": [0, -0.075, 0.017], "radii": [0.103, 0.085, 0.095]}, {"id": "nose", "type": "ellipsoid", "center": [0, -0.015, 0.125], "radii": [0.025, 0.061, 0.04]}, {"id": "chin", "type": "ellipsoid", "center": [0, -0.118, 0.054], "radii": [0.062, 0.031, 0.057]}, {"id": "eyeLeft", "type": "ellipsoid", "center": [0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}, {"id": "eyeRight", "type": "ellipsoid", "center": [-0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}], "operations": [{"id": "a", "type": "smooth-union", "left": "cranium", "right": "jaw", "radius": 0.045}, {"id": "b", "type": "smooth-union", "left": "a", "right": "nose", "radius": 0.022}, {"id": "c", "type": "smooth-union", "left": "b", "right": "chin", "radius": 0.025}, {"id": "d", "type": "subtract", "left": "c", "right": "eyeLeft"}, {"id": "e", "type": "subtract", "left": "d", "right": "eyeRight"}], "bounds": {"min": [-0.18, -0.18, -0.17], "max": [0.18, 0.21, 0.2]}, "resolution": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "head-contact", "localStart": [0, 1.66, 0], "localEnd": [0, 1.84, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.82, 0], "rotation": [0, -0.25, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["jaw-contour"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_head_4.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_head_4);
  nodes["head"] = node_head_4;
  const mesh_head_4Geometry = polygonizeSdf({"primitives": [{"id": "cranium", "type": "ellipsoid", "center": [0, 0.04, -0.015], "radii": [0.137, 0.145, 0.126]}, {"id": "jaw", "type": "ellipsoid", "center": [0, -0.075, 0.017], "radii": [0.103, 0.085, 0.095]}, {"id": "nose", "type": "ellipsoid", "center": [0, -0.015, 0.125], "radii": [0.025, 0.061, 0.04]}, {"id": "chin", "type": "ellipsoid", "center": [0, -0.118, 0.054], "radii": [0.062, 0.031, 0.057]}, {"id": "eyeLeft", "type": "ellipsoid", "center": [0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}, {"id": "eyeRight", "type": "ellipsoid", "center": [-0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}], "operations": [{"id": "a", "type": "smooth-union", "left": "cranium", "right": "jaw", "radius": 0.045}, {"id": "b", "type": "smooth-union", "left": "a", "right": "nose", "radius": 0.022}, {"id": "c", "type": "smooth-union", "left": "b", "right": "chin", "radius": 0.025}, {"id": "d", "type": "subtract", "left": "c", "right": "eyeLeft"}, {"id": "e", "type": "subtract", "left": "d", "right": "eyeRight"}], "bounds": {"min": [-0.18, -0.18, -0.17], "max": [0.18, 0.21, 0.2]}, "resolution": 40});
  if (!endpoint_head_4) {
    mesh_head_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_head_4 = new THREE.Mesh(
    mesh_head_4Geometry,
    createSculptMaterial("skin", {"id": "skin", "name": "skin", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#d5c8b0", "color": "#d5c8b0", "albedo": {"dominant": "#d5c8b0", "secondary": ["#d5c8b0"]}, "colorVariation": {"palette": ["#d5c8b0"], "pattern": "fine stipple", "amplitude": 0.025}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.01, "role": "paint tone"}, {"id": "meso", "frequency": 12, "amplitude": 0.01, "role": "paint stipple"}, {"id": "micro", "frequency": 56, "amplitude": 0.003, "role": "restrained roughness"}], "roughness": {"base": 0.74, "variation": 0.035, "map": "independent fine stipple"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.025, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "skin-edge", "region": "edges and folds", "color": "#d5c8b0", "roughness": 0.66, "evidenceRefs": ["full-object"]}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Authored painted sculpture response, source illustration cannot establish physical PBR.", "materialClass": "skin"}, options, true)
  );
  mesh_head_4.name = "head";
  if (endpoint_head_4) {
    mesh_head_4.position.copy(endpoint_head_4.midpoint);
    mesh_head_4.quaternion.copy(endpoint_head_4.quaternion);
  }
  mesh_head_4.castShadow = options.castShadow ?? true;
  mesh_head_4.receiveShadow = options.receiveShadow ?? true;
  mesh_head_4.userData.sculptComponent = {"id": "head", "name": "head", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "implicit", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "sdf": {"primitives": [{"id": "cranium", "type": "ellipsoid", "center": [0, 0.04, -0.015], "radii": [0.137, 0.145, 0.126]}, {"id": "jaw", "type": "ellipsoid", "center": [0, -0.075, 0.017], "radii": [0.103, 0.085, 0.095]}, {"id": "nose", "type": "ellipsoid", "center": [0, -0.015, 0.125], "radii": [0.025, 0.061, 0.04]}, {"id": "chin", "type": "ellipsoid", "center": [0, -0.118, 0.054], "radii": [0.062, 0.031, 0.057]}, {"id": "eyeLeft", "type": "ellipsoid", "center": [0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}, {"id": "eyeRight", "type": "ellipsoid", "center": [-0.059, 0.012, 0.118], "radii": [0.034, 0.023, 0.031]}], "operations": [{"id": "a", "type": "smooth-union", "left": "cranium", "right": "jaw", "radius": 0.045}, {"id": "b", "type": "smooth-union", "left": "a", "right": "nose", "radius": 0.022}, {"id": "c", "type": "smooth-union", "left": "b", "right": "chin", "radius": 0.025}, {"id": "d", "type": "subtract", "left": "c", "right": "eyeLeft"}, {"id": "e", "type": "subtract", "left": "d", "right": "eyeRight"}], "bounds": {"min": [-0.18, -0.18, -0.17], "max": [0.18, 0.21, 0.2]}, "resolution": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "head-contact", "localStart": [0, 1.66, 0], "localEnd": [0, 1.84, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 1.82, 0], "rotation": [0, -0.25, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["jaw-contour"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_head_4.add(mesh_head_4);
  meshes["head"] = mesh_head_4;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_4);

  const endpoint_hair_5 = makeAttachmentEndpoint(null);
  const node_hair_5 = new THREE.Group();
  node_hair_5.name = "hair__pivot";
  node_hair_5.scale.set(1, 1, 1);
  if (endpoint_hair_5) {
    node_hair_5.position.copy(endpoint_hair_5.start);
    node_hair_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hair_5.position.set(0.0, 0.083, -0.031);
    node_hair_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_hair_5.userData.sculptComponent = {"id": "hair", "name": "hair", "level": "macro", "role": "hair", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "hair-contact", "localStart": [0, 0.083, -0.031], "localEnd": [0, 0.10300000000000001, -0.031], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.3, "height": 0.234, "depth": 0.28, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.083, -0.031], "rotation": [0, 0, 0], "scale": [0.3, 0.234, 0.28]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hair", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["side-part sweep", "posterior cap coverage", "part-line"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}, "standProud": {"againstComponentId": "head", "clearance": 0.005, "maxPush": 0.016}};
  node_hair_5.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hair", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_hair_5);
  nodes["hair"] = node_hair_5;
  const mesh_hair_5Geometry = endpoint_hair_5
    ? new THREE.CylinderGeometry(endpoint_hair_5.endRadius, endpoint_hair_5.baseRadius, endpoint_hair_5.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_hair_5) {
    mesh_hair_5Geometry.scale(0.3, 0.234, 0.28);
  }
  const mesh_hair_5 = new THREE.Mesh(
    mesh_hair_5Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hair_5.name = "hair";
  if (endpoint_hair_5) {
    mesh_hair_5.position.copy(endpoint_hair_5.midpoint);
    mesh_hair_5.quaternion.copy(endpoint_hair_5.quaternion);
  }
  mesh_hair_5.castShadow = options.castShadow ?? true;
  mesh_hair_5.receiveShadow = options.receiveShadow ?? true;
  mesh_hair_5.userData.sculptComponent = {"id": "hair", "name": "hair", "level": "macro", "role": "hair", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "hair-contact", "localStart": [0, 0.083, -0.031], "localEnd": [0, 0.10300000000000001, -0.031], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.3, "height": 0.234, "depth": 0.28, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.083, -0.031], "rotation": [0, 0, 0], "scale": [0.3, 0.234, 0.28]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hair", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["side-part sweep", "posterior cap coverage", "part-line"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}, "standProud": {"againstComponentId": "head", "clearance": 0.005, "maxPush": 0.016}};
  node_hair_5.add(mesh_hair_5);
  meshes["hair"] = mesh_hair_5;
  colliders["hair"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hair"] ??= [];
  destructionGroups["hair"].push(node_hair_5);

  const endpoint_swept_forelock_6 = makeAttachmentEndpoint(null);
  const node_swept_forelock_6 = new THREE.Group();
  node_swept_forelock_6.name = "swept-forelock__pivot";
  node_swept_forelock_6.scale.set(1, 1, 1);
  if (endpoint_swept_forelock_6) {
    node_swept_forelock_6.position.copy(endpoint_swept_forelock_6.start);
    node_swept_forelock_6.rotation.set(0.0, 0.18, 0.22);
  } else {
    node_swept_forelock_6.position.set(-0.035, 0.12, 0.065);
    node_swept_forelock_6.rotation.set(0.0, 0.18, 0.22);
  }
  node_swept_forelock_6.userData.sculptComponent = {"id": "swept-forelock", "name": "swept-forelock", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "swept-forelock-contact", "localStart": [-0.035, 0.12, 0.065], "localEnd": [-0.035, 0.13999999999999999, 0.065], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.26, "height": 0.105, "depth": 0.12, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.035, 0.12, 0.065], "rotation": [0, 0.18, 0.22], "scale": [0.26, 0.105, 0.12]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "swept-forelock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_swept_forelock_6.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "swept-forelock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_swept_forelock_6);
  nodes["swept-forelock"] = node_swept_forelock_6;
  const mesh_swept_forelock_6Geometry = endpoint_swept_forelock_6
    ? new THREE.CylinderGeometry(endpoint_swept_forelock_6.endRadius, endpoint_swept_forelock_6.baseRadius, endpoint_swept_forelock_6.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_swept_forelock_6) {
    mesh_swept_forelock_6Geometry.scale(0.26, 0.105, 0.12);
  }
  const mesh_swept_forelock_6 = new THREE.Mesh(
    mesh_swept_forelock_6Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_swept_forelock_6.name = "swept-forelock";
  if (endpoint_swept_forelock_6) {
    mesh_swept_forelock_6.position.copy(endpoint_swept_forelock_6.midpoint);
    mesh_swept_forelock_6.quaternion.copy(endpoint_swept_forelock_6.quaternion);
  }
  mesh_swept_forelock_6.castShadow = options.castShadow ?? true;
  mesh_swept_forelock_6.receiveShadow = options.receiveShadow ?? true;
  mesh_swept_forelock_6.userData.sculptComponent = {"id": "swept-forelock", "name": "swept-forelock", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "swept-forelock-contact", "localStart": [-0.035, 0.12, 0.065], "localEnd": [-0.035, 0.13999999999999999, 0.065], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.26, "height": 0.105, "depth": 0.12, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.035, 0.12, 0.065], "rotation": [0, 0.18, 0.22], "scale": [0.26, 0.105, 0.12]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "swept-forelock", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_swept_forelock_6.add(mesh_swept_forelock_6);
  meshes["swept-forelock"] = mesh_swept_forelock_6;
  colliders["swept-forelock"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["swept-forelock"] ??= [];
  destructionGroups["swept-forelock"].push(node_swept_forelock_6);

  const endpoint_ear_right_7 = makeAttachmentEndpoint(null);
  const node_ear_right_7 = new THREE.Group();
  node_ear_right_7.name = "ear-right__pivot";
  node_ear_right_7.scale.set(1, 1, 1);
  if (endpoint_ear_right_7) {
    node_ear_right_7.position.copy(endpoint_ear_right_7.start);
    node_ear_right_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_right_7.position.set(-0.135, -0.012, -0.005);
    node_ear_right_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_right_7.userData.sculptComponent = {"id": "ear-right", "name": "ear-right", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "ear-right-contact", "localStart": [-0.135, -0.012, -0.005], "localEnd": [-0.135, 0.008, -0.005], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.046, "height": 0.085, "depth": 0.047, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.135, -0.012, -0.005], "rotation": [0, 0, 0], "scale": [0.046, 0.085, 0.047]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_ear_right_7.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["head"] ?? root).add(node_ear_right_7);
  nodes["ear-right"] = node_ear_right_7;
  const mesh_ear_right_7Geometry = endpoint_ear_right_7
    ? new THREE.CylinderGeometry(endpoint_ear_right_7.endRadius, endpoint_ear_right_7.baseRadius, endpoint_ear_right_7.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_ear_right_7) {
    mesh_ear_right_7Geometry.scale(0.046, 0.085, 0.047);
  }
  const mesh_ear_right_7 = new THREE.Mesh(
    mesh_ear_right_7Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_right_7.name = "ear-right";
  if (endpoint_ear_right_7) {
    mesh_ear_right_7.position.copy(endpoint_ear_right_7.midpoint);
    mesh_ear_right_7.quaternion.copy(endpoint_ear_right_7.quaternion);
  }
  mesh_ear_right_7.castShadow = options.castShadow ?? true;
  mesh_ear_right_7.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_right_7.userData.sculptComponent = {"id": "ear-right", "name": "ear-right", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "ear-right-contact", "localStart": [-0.135, -0.012, -0.005], "localEnd": [-0.135, 0.008, -0.005], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.046, "height": 0.085, "depth": 0.047, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.135, -0.012, -0.005], "rotation": [0, 0, 0], "scale": [0.046, 0.085, 0.047]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_ear_right_7.add(mesh_ear_right_7);
  meshes["ear-right"] = mesh_ear_right_7;
  colliders["ear-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-right"] ??= [];
  destructionGroups["ear-right"].push(node_ear_right_7);

  const endpoint_eye_right_8 = makeAttachmentEndpoint(null);
  const node_eye_right_8 = new THREE.Group();
  node_eye_right_8.name = "eye-right__pivot";
  node_eye_right_8.scale.set(1, 1, 1);
  if (endpoint_eye_right_8) {
    node_eye_right_8.position.copy(endpoint_eye_right_8.start);
    node_eye_right_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_right_8.position.set(-0.059, 0.011, 0.112);
    node_eye_right_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_right_8.userData.sculptComponent = {"id": "eye-right", "name": "eye-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "eye-right-contact", "localStart": [-0.059, 0.011, 0.112], "localEnd": [-0.059, 0.031, 0.112], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.043, "height": 0.019, "depth": 0.025, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.059, 0.011, 0.112], "rotation": [0, 0, 0], "scale": [0.043, 0.019, 0.025]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_eye_right_8.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["head"] ?? root).add(node_eye_right_8);
  nodes["eye-right"] = node_eye_right_8;
  const mesh_eye_right_8Geometry = endpoint_eye_right_8
    ? new THREE.CylinderGeometry(endpoint_eye_right_8.endRadius, endpoint_eye_right_8.baseRadius, endpoint_eye_right_8.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_right_8) {
    mesh_eye_right_8Geometry.scale(0.043, 0.019, 0.025);
  }
  const mesh_eye_right_8 = new THREE.Mesh(
    mesh_eye_right_8Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_right_8.name = "eye-right";
  if (endpoint_eye_right_8) {
    mesh_eye_right_8.position.copy(endpoint_eye_right_8.midpoint);
    mesh_eye_right_8.quaternion.copy(endpoint_eye_right_8.quaternion);
  }
  mesh_eye_right_8.castShadow = options.castShadow ?? true;
  mesh_eye_right_8.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_right_8.userData.sculptComponent = {"id": "eye-right", "name": "eye-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "eye-right-contact", "localStart": [-0.059, 0.011, 0.112], "localEnd": [-0.059, 0.031, 0.112], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.043, "height": 0.019, "depth": 0.025, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.059, 0.011, 0.112], "rotation": [0, 0, 0], "scale": [0.043, 0.019, 0.025]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_eye_right_8.add(mesh_eye_right_8);
  meshes["eye-right"] = mesh_eye_right_8;
  colliders["eye-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-right"] ??= [];
  destructionGroups["eye-right"].push(node_eye_right_8);

  const endpoint_iris_right_9 = makeAttachmentEndpoint(null);
  const node_iris_right_9 = new THREE.Group();
  node_iris_right_9.name = "iris-right__pivot";
  node_iris_right_9.scale.set(1, 1, 1);
  if (endpoint_iris_right_9) {
    node_iris_right_9.position.copy(endpoint_iris_right_9.start);
    node_iris_right_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_right_9.position.set(-0.058, 0.011, 0.126);
    node_iris_right_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_right_9.userData.sculptComponent = {"id": "iris-right", "name": "iris-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "iris-right-contact", "localStart": [-0.058, 0.011, 0.126], "localEnd": [-0.058, 0.031, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.011, "height": 0.013, "depth": 0.006, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.058, 0.011, 0.126], "rotation": [0, 0, 0], "scale": [0.011, 0.013, 0.006]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_iris_right_9.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_iris_right_9);
  nodes["iris-right"] = node_iris_right_9;
  const mesh_iris_right_9Geometry = endpoint_iris_right_9
    ? new THREE.CylinderGeometry(endpoint_iris_right_9.endRadius, endpoint_iris_right_9.baseRadius, endpoint_iris_right_9.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_right_9) {
    mesh_iris_right_9Geometry.scale(0.011, 0.013, 0.006);
  }
  const mesh_iris_right_9 = new THREE.Mesh(
    mesh_iris_right_9Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_right_9.name = "iris-right";
  if (endpoint_iris_right_9) {
    mesh_iris_right_9.position.copy(endpoint_iris_right_9.midpoint);
    mesh_iris_right_9.quaternion.copy(endpoint_iris_right_9.quaternion);
  }
  mesh_iris_right_9.castShadow = options.castShadow ?? true;
  mesh_iris_right_9.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_right_9.userData.sculptComponent = {"id": "iris-right", "name": "iris-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "iris-right-contact", "localStart": [-0.058, 0.011, 0.126], "localEnd": [-0.058, 0.031, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.011, "height": 0.013, "depth": 0.006, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.058, 0.011, 0.126], "rotation": [0, 0, 0], "scale": [0.011, 0.013, 0.006]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_iris_right_9.add(mesh_iris_right_9);
  meshes["iris-right"] = mesh_iris_right_9;
  colliders["iris-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-right"] ??= [];
  destructionGroups["iris-right"].push(node_iris_right_9);

  const endpoint_brow_right_10 = makeAttachmentEndpoint(null);
  const node_brow_right_10 = new THREE.Group();
  node_brow_right_10.name = "brow-right__pivot";
  node_brow_right_10.scale.set(1, 1, 1);
  if (endpoint_brow_right_10) {
    node_brow_right_10.position.copy(endpoint_brow_right_10.start);
    node_brow_right_10.rotation.set(0.0, 0.0, 0.08);
  } else {
    node_brow_right_10.position.set(-0.059, 0.038, 0.126);
    node_brow_right_10.rotation.set(0.0, 0.0, 0.08);
  }
  node_brow_right_10.userData.sculptComponent = {"id": "brow-right", "name": "brow-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "brow-right-contact", "localStart": [-0.059, 0.038, 0.126], "localEnd": [-0.059, 0.057999999999999996, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.061, "height": 0.011, "depth": 0.014, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.059, 0.038, 0.126], "rotation": [0, 0, 0.08], "scale": [0.061, 0.011, 0.014]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_brow_right_10.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_brow_right_10);
  nodes["brow-right"] = node_brow_right_10;
  const mesh_brow_right_10Geometry = endpoint_brow_right_10
    ? new THREE.CylinderGeometry(endpoint_brow_right_10.endRadius, endpoint_brow_right_10.baseRadius, endpoint_brow_right_10.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_brow_right_10) {
    mesh_brow_right_10Geometry.scale(0.061, 0.011, 0.014);
  }
  const mesh_brow_right_10 = new THREE.Mesh(
    mesh_brow_right_10Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_right_10.name = "brow-right";
  if (endpoint_brow_right_10) {
    mesh_brow_right_10.position.copy(endpoint_brow_right_10.midpoint);
    mesh_brow_right_10.quaternion.copy(endpoint_brow_right_10.quaternion);
  }
  mesh_brow_right_10.castShadow = options.castShadow ?? true;
  mesh_brow_right_10.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_right_10.userData.sculptComponent = {"id": "brow-right", "name": "brow-right", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "brow-right-contact", "localStart": [-0.059, 0.038, 0.126], "localEnd": [-0.059, 0.057999999999999996, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.061, "height": 0.011, "depth": 0.014, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.059, 0.038, 0.126], "rotation": [0, 0, 0.08], "scale": [0.061, 0.011, 0.014]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_brow_right_10.add(mesh_brow_right_10);
  meshes["brow-right"] = mesh_brow_right_10;
  colliders["brow-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["brow-right"] ??= [];
  destructionGroups["brow-right"].push(node_brow_right_10);

  const endpoint_shoe_right_11 = makeAttachmentEndpoint(null);
  const node_shoe_right_11 = new THREE.Group();
  node_shoe_right_11.name = "shoe-right__pivot";
  node_shoe_right_11.scale.set(1, 1, 1);
  if (endpoint_shoe_right_11) {
    node_shoe_right_11.position.copy(endpoint_shoe_right_11.start);
    node_shoe_right_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shoe_right_11.position.set(-0.17, 0.045, 0.046);
    node_shoe_right_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_shoe_right_11.userData.sculptComponent = {"id": "shoe-right", "name": "shoe-right", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shoe-right-contact", "localStart": [-0.17, 0.045, 0.046], "localEnd": [-0.17, 0.065, 0.046], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.195, "height": 0.095, "depth": 0.35, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.17, 0.045, 0.046], "rotation": [0, 0, 0], "scale": [0.195, 0.095, 0.35]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shoe_right_11.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["root"] ?? root).add(node_shoe_right_11);
  nodes["shoe-right"] = node_shoe_right_11;
  const mesh_shoe_right_11Geometry = endpoint_shoe_right_11
    ? new THREE.CylinderGeometry(endpoint_shoe_right_11.endRadius, endpoint_shoe_right_11.baseRadius, endpoint_shoe_right_11.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_shoe_right_11) {
    mesh_shoe_right_11Geometry.scale(0.195, 0.095, 0.35);
  }
  const mesh_shoe_right_11 = new THREE.Mesh(
    mesh_shoe_right_11Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_right_11.name = "shoe-right";
  if (endpoint_shoe_right_11) {
    mesh_shoe_right_11.position.copy(endpoint_shoe_right_11.midpoint);
    mesh_shoe_right_11.quaternion.copy(endpoint_shoe_right_11.quaternion);
  }
  mesh_shoe_right_11.castShadow = options.castShadow ?? true;
  mesh_shoe_right_11.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_right_11.userData.sculptComponent = {"id": "shoe-right", "name": "shoe-right", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shoe-right-contact", "localStart": [-0.17, 0.045, 0.046], "localEnd": [-0.17, 0.065, 0.046], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.195, "height": 0.095, "depth": 0.35, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.17, 0.045, 0.046], "rotation": [0, 0, 0], "scale": [0.195, 0.095, 0.35]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shoe_right_11.add(mesh_shoe_right_11);
  meshes["shoe-right"] = mesh_shoe_right_11;
  colliders["shoe-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shoe-right"] ??= [];
  destructionGroups["shoe-right"].push(node_shoe_right_11);

  const endpoint_trouser_right_12 = makeAttachmentEndpoint(null);
  const node_trouser_right_12 = new THREE.Group();
  node_trouser_right_12.name = "trouser-right__pivot";
  node_trouser_right_12.scale.set(1, 1, 1);
  if (endpoint_trouser_right_12) {
    node_trouser_right_12.position.copy(endpoint_trouser_right_12.start);
    node_trouser_right_12.rotation.set(0.0, 0.0, 0.025);
  } else {
    node_trouser_right_12.position.set(-0.14, 0.12, 0.0);
    node_trouser_right_12.rotation.set(0.0, 0.0, 0.025);
  }
  node_trouser_right_12.userData.sculptComponent = {"id": "trouser-right", "name": "trouser-right", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "trouser-right-contact", "localStart": [-0.14, 0.12, 0], "localEnd": [-0.14, 0.13999999999999999, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.91, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.14, 0.12, 0], "rotation": [0, 0, 0.025], "scale": [1, 1, 0.91]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["trouser-crease"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_trouser_right_12.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_trouser_right_12);
  nodes["trouser-right"] = node_trouser_right_12;
  const mesh_trouser_right_12Geometry = endpoint_trouser_right_12
    ? new THREE.CylinderGeometry(endpoint_trouser_right_12.endRadius, endpoint_trouser_right_12.baseRadius, endpoint_trouser_right_12.length, 16, 6)
    : buildLatheGeometry({"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32});
  if (!endpoint_trouser_right_12) {
    mesh_trouser_right_12Geometry.scale(1.0, 1.0, 0.91);
  }
  const mesh_trouser_right_12 = new THREE.Mesh(
    mesh_trouser_right_12Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_trouser_right_12.name = "trouser-right";
  if (endpoint_trouser_right_12) {
    mesh_trouser_right_12.position.copy(endpoint_trouser_right_12.midpoint);
    mesh_trouser_right_12.quaternion.copy(endpoint_trouser_right_12.quaternion);
  }
  mesh_trouser_right_12.castShadow = options.castShadow ?? true;
  mesh_trouser_right_12.receiveShadow = options.receiveShadow ?? true;
  mesh_trouser_right_12.userData.sculptComponent = {"id": "trouser-right", "name": "trouser-right", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "trouser-right-contact", "localStart": [-0.14, 0.12, 0], "localEnd": [-0.14, 0.13999999999999999, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.91, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.14, 0.12, 0], "rotation": [0, 0, 0.025], "scale": [1, 1, 0.91]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["trouser-crease"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_trouser_right_12.add(mesh_trouser_right_12);
  meshes["trouser-right"] = mesh_trouser_right_12;
  colliders["trouser-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["trouser-right"] ??= [];
  destructionGroups["trouser-right"].push(node_trouser_right_12);

  const endpoint_ear_left_13 = makeAttachmentEndpoint(null);
  const node_ear_left_13 = new THREE.Group();
  node_ear_left_13.name = "ear-left__pivot";
  node_ear_left_13.scale.set(1, 1, 1);
  if (endpoint_ear_left_13) {
    node_ear_left_13.position.copy(endpoint_ear_left_13.start);
    node_ear_left_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_left_13.position.set(0.135, -0.012, -0.005);
    node_ear_left_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_left_13.userData.sculptComponent = {"id": "ear-left", "name": "ear-left", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "ear-left-contact", "localStart": [0.135, -0.012, -0.005], "localEnd": [0.135, 0.008, -0.005], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.046, "height": 0.085, "depth": 0.047, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.135, -0.012, -0.005], "rotation": [0, 0, 0], "scale": [0.046, 0.085, 0.047]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_ear_left_13.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["head"] ?? root).add(node_ear_left_13);
  nodes["ear-left"] = node_ear_left_13;
  const mesh_ear_left_13Geometry = endpoint_ear_left_13
    ? new THREE.CylinderGeometry(endpoint_ear_left_13.endRadius, endpoint_ear_left_13.baseRadius, endpoint_ear_left_13.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_ear_left_13) {
    mesh_ear_left_13Geometry.scale(0.046, 0.085, 0.047);
  }
  const mesh_ear_left_13 = new THREE.Mesh(
    mesh_ear_left_13Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_left_13.name = "ear-left";
  if (endpoint_ear_left_13) {
    mesh_ear_left_13.position.copy(endpoint_ear_left_13.midpoint);
    mesh_ear_left_13.quaternion.copy(endpoint_ear_left_13.quaternion);
  }
  mesh_ear_left_13.castShadow = options.castShadow ?? true;
  mesh_ear_left_13.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_left_13.userData.sculptComponent = {"id": "ear-left", "name": "ear-left", "level": "meso", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "ear-left-contact", "localStart": [0.135, -0.012, -0.005], "localEnd": [0.135, 0.008, -0.005], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.046, "height": 0.085, "depth": 0.047, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.135, -0.012, -0.005], "rotation": [0, 0, 0], "scale": [0.046, 0.085, 0.047]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_ear_left_13.add(mesh_ear_left_13);
  meshes["ear-left"] = mesh_ear_left_13;
  colliders["ear-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-left"] ??= [];
  destructionGroups["ear-left"].push(node_ear_left_13);

  const endpoint_eye_left_14 = makeAttachmentEndpoint(null);
  const node_eye_left_14 = new THREE.Group();
  node_eye_left_14.name = "eye-left__pivot";
  node_eye_left_14.scale.set(1, 1, 1);
  if (endpoint_eye_left_14) {
    node_eye_left_14.position.copy(endpoint_eye_left_14.start);
    node_eye_left_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_left_14.position.set(0.059, 0.011, 0.112);
    node_eye_left_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_left_14.userData.sculptComponent = {"id": "eye-left", "name": "eye-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "eye-left-contact", "localStart": [0.059, 0.011, 0.112], "localEnd": [0.059, 0.031, 0.112], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.043, "height": 0.019, "depth": 0.025, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.059, 0.011, 0.112], "rotation": [0, 0, 0], "scale": [0.043, 0.019, 0.025]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["eyelid"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_eye_left_14.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["head"] ?? root).add(node_eye_left_14);
  nodes["eye-left"] = node_eye_left_14;
  const mesh_eye_left_14Geometry = endpoint_eye_left_14
    ? new THREE.CylinderGeometry(endpoint_eye_left_14.endRadius, endpoint_eye_left_14.baseRadius, endpoint_eye_left_14.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_left_14) {
    mesh_eye_left_14Geometry.scale(0.043, 0.019, 0.025);
  }
  const mesh_eye_left_14 = new THREE.Mesh(
    mesh_eye_left_14Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_left_14.name = "eye-left";
  if (endpoint_eye_left_14) {
    mesh_eye_left_14.position.copy(endpoint_eye_left_14.midpoint);
    mesh_eye_left_14.quaternion.copy(endpoint_eye_left_14.quaternion);
  }
  mesh_eye_left_14.castShadow = options.castShadow ?? true;
  mesh_eye_left_14.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_left_14.userData.sculptComponent = {"id": "eye-left", "name": "eye-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "eye-left-contact", "localStart": [0.059, 0.011, 0.112], "localEnd": [0.059, 0.031, 0.112], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.043, "height": 0.019, "depth": 0.025, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.059, 0.011, 0.112], "rotation": [0, 0, 0], "scale": [0.043, 0.019, 0.025]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["eyelid"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_eye_left_14.add(mesh_eye_left_14);
  meshes["eye-left"] = mesh_eye_left_14;
  colliders["eye-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-left"] ??= [];
  destructionGroups["eye-left"].push(node_eye_left_14);

  const endpoint_iris_left_15 = makeAttachmentEndpoint(null);
  const node_iris_left_15 = new THREE.Group();
  node_iris_left_15.name = "iris-left__pivot";
  node_iris_left_15.scale.set(1, 1, 1);
  if (endpoint_iris_left_15) {
    node_iris_left_15.position.copy(endpoint_iris_left_15.start);
    node_iris_left_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_left_15.position.set(0.058, 0.011, 0.126);
    node_iris_left_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_left_15.userData.sculptComponent = {"id": "iris-left", "name": "iris-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "iris-left-contact", "localStart": [0.058, 0.011, 0.126], "localEnd": [0.058, 0.031, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.011, "height": 0.013, "depth": 0.006, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.058, 0.011, 0.126], "rotation": [0, 0, 0], "scale": [0.011, 0.013, 0.006]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_iris_left_15.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_iris_left_15);
  nodes["iris-left"] = node_iris_left_15;
  const mesh_iris_left_15Geometry = endpoint_iris_left_15
    ? new THREE.CylinderGeometry(endpoint_iris_left_15.endRadius, endpoint_iris_left_15.baseRadius, endpoint_iris_left_15.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_left_15) {
    mesh_iris_left_15Geometry.scale(0.011, 0.013, 0.006);
  }
  const mesh_iris_left_15 = new THREE.Mesh(
    mesh_iris_left_15Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_left_15.name = "iris-left";
  if (endpoint_iris_left_15) {
    mesh_iris_left_15.position.copy(endpoint_iris_left_15.midpoint);
    mesh_iris_left_15.quaternion.copy(endpoint_iris_left_15.quaternion);
  }
  mesh_iris_left_15.castShadow = options.castShadow ?? true;
  mesh_iris_left_15.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_left_15.userData.sculptComponent = {"id": "iris-left", "name": "iris-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "iris-left-contact", "localStart": [0.058, 0.011, 0.126], "localEnd": [0.058, 0.031, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.011, "height": 0.013, "depth": 0.006, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.058, 0.011, 0.126], "rotation": [0, 0, 0], "scale": [0.011, 0.013, 0.006]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "iris-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_iris_left_15.add(mesh_iris_left_15);
  meshes["iris-left"] = mesh_iris_left_15;
  colliders["iris-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-left"] ??= [];
  destructionGroups["iris-left"].push(node_iris_left_15);

  const endpoint_brow_left_16 = makeAttachmentEndpoint(null);
  const node_brow_left_16 = new THREE.Group();
  node_brow_left_16.name = "brow-left__pivot";
  node_brow_left_16.scale.set(1, 1, 1);
  if (endpoint_brow_left_16) {
    node_brow_left_16.position.copy(endpoint_brow_left_16.start);
    node_brow_left_16.rotation.set(0.0, 0.0, -0.08);
  } else {
    node_brow_left_16.position.set(0.059, 0.038, 0.126);
    node_brow_left_16.rotation.set(0.0, 0.0, -0.08);
  }
  node_brow_left_16.userData.sculptComponent = {"id": "brow-left", "name": "brow-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "brow-left-contact", "localStart": [0.059, 0.038, 0.126], "localEnd": [0.059, 0.057999999999999996, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.061, "height": 0.011, "depth": 0.014, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.059, 0.038, 0.126], "rotation": [0, 0, -0.08], "scale": [0.061, 0.011, 0.014]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["brow-arch"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_brow_left_16.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}};
  (nodes["head"] ?? root).add(node_brow_left_16);
  nodes["brow-left"] = node_brow_left_16;
  const mesh_brow_left_16Geometry = endpoint_brow_left_16
    ? new THREE.CylinderGeometry(endpoint_brow_left_16.endRadius, endpoint_brow_left_16.baseRadius, endpoint_brow_left_16.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_brow_left_16) {
    mesh_brow_left_16Geometry.scale(0.061, 0.011, 0.014);
  }
  const mesh_brow_left_16 = new THREE.Mesh(
    mesh_brow_left_16Geometry,
    materialMap["hair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_left_16.name = "brow-left";
  if (endpoint_brow_left_16) {
    mesh_brow_left_16.position.copy(endpoint_brow_left_16.midpoint);
    mesh_brow_left_16.quaternion.copy(endpoint_brow_left_16.quaternion);
  }
  mesh_brow_left_16.castShadow = options.castShadow ?? true;
  mesh_brow_left_16.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_left_16.userData.sculptComponent = {"id": "brow-left", "name": "brow-left", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "brow-left-contact", "localStart": [0.059, 0.038, 0.126], "localEnd": [0.059, 0.057999999999999996, 0.126], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.061, "height": 0.011, "depth": 0.014, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.059, 0.038, 0.126], "rotation": [0, 0, -0.08], "scale": [0.061, 0.011, 0.014]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "brow-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hair"}}, "material": "hair", "materialLayers": ["hair"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["brow-arch"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(37, 36, 31, 1)", "secondaryAlbedo": "rgba(37, 36, 31, 1)", "materialClass": "plastic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_brow_left_16.add(mesh_brow_left_16);
  meshes["brow-left"] = mesh_brow_left_16;
  colliders["brow-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["brow-left"] ??= [];
  destructionGroups["brow-left"].push(node_brow_left_16);

  const endpoint_shoe_left_17 = makeAttachmentEndpoint(null);
  const node_shoe_left_17 = new THREE.Group();
  node_shoe_left_17.name = "shoe-left__pivot";
  node_shoe_left_17.scale.set(1, 1, 1);
  if (endpoint_shoe_left_17) {
    node_shoe_left_17.position.copy(endpoint_shoe_left_17.start);
    node_shoe_left_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shoe_left_17.position.set(0.17, 0.045, 0.046);
    node_shoe_left_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_shoe_left_17.userData.sculptComponent = {"id": "shoe-left", "name": "shoe-left", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shoe-left-contact", "localStart": [0.17, 0.045, 0.046], "localEnd": [0.17, 0.065, 0.046], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.195, "height": 0.095, "depth": 0.35, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.17, 0.045, 0.046], "rotation": [0, 0, 0], "scale": [0.195, 0.095, 0.35]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["toe-polish"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shoe_left_17.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["root"] ?? root).add(node_shoe_left_17);
  nodes["shoe-left"] = node_shoe_left_17;
  const mesh_shoe_left_17Geometry = endpoint_shoe_left_17
    ? new THREE.CylinderGeometry(endpoint_shoe_left_17.endRadius, endpoint_shoe_left_17.baseRadius, endpoint_shoe_left_17.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_shoe_left_17) {
    mesh_shoe_left_17Geometry.scale(0.195, 0.095, 0.35);
  }
  const mesh_shoe_left_17 = new THREE.Mesh(
    mesh_shoe_left_17Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shoe_left_17.name = "shoe-left";
  if (endpoint_shoe_left_17) {
    mesh_shoe_left_17.position.copy(endpoint_shoe_left_17.midpoint);
    mesh_shoe_left_17.quaternion.copy(endpoint_shoe_left_17.quaternion);
  }
  mesh_shoe_left_17.castShadow = options.castShadow ?? true;
  mesh_shoe_left_17.receiveShadow = options.receiveShadow ?? true;
  mesh_shoe_left_17.userData.sculptComponent = {"id": "shoe-left", "name": "shoe-left", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shoe-left-contact", "localStart": [0.17, 0.045, 0.046], "localEnd": [0.17, 0.065, 0.046], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.195, "height": 0.095, "depth": 0.35, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.17, 0.045, 0.046], "rotation": [0, 0, 0], "scale": [0.195, 0.095, 0.35]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shoe-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["toe-polish"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shoe_left_17.add(mesh_shoe_left_17);
  meshes["shoe-left"] = mesh_shoe_left_17;
  colliders["shoe-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shoe-left"] ??= [];
  destructionGroups["shoe-left"].push(node_shoe_left_17);

  const endpoint_trouser_left_18 = makeAttachmentEndpoint(null);
  const node_trouser_left_18 = new THREE.Group();
  node_trouser_left_18.name = "trouser-left__pivot";
  node_trouser_left_18.scale.set(1, 1, 1);
  if (endpoint_trouser_left_18) {
    node_trouser_left_18.position.copy(endpoint_trouser_left_18.start);
    node_trouser_left_18.rotation.set(0.0, 0.0, -0.025);
  } else {
    node_trouser_left_18.position.set(0.14, 0.12, 0.0);
    node_trouser_left_18.rotation.set(0.0, 0.0, -0.025);
  }
  node_trouser_left_18.userData.sculptComponent = {"id": "trouser-left", "name": "trouser-left", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "trouser-left-contact", "localStart": [0.14, 0.12, 0], "localEnd": [0.14, 0.13999999999999999, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.91, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.14, 0.12, 0], "rotation": [0, 0, -0.025], "scale": [1, 1, 0.91]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_trouser_left_18.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_trouser_left_18);
  nodes["trouser-left"] = node_trouser_left_18;
  const mesh_trouser_left_18Geometry = endpoint_trouser_left_18
    ? new THREE.CylinderGeometry(endpoint_trouser_left_18.endRadius, endpoint_trouser_left_18.baseRadius, endpoint_trouser_left_18.length, 16, 6)
    : buildLatheGeometry({"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32});
  if (!endpoint_trouser_left_18) {
    mesh_trouser_left_18Geometry.scale(1.0, 1.0, 0.91);
  }
  const mesh_trouser_left_18 = new THREE.Mesh(
    mesh_trouser_left_18Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_trouser_left_18.name = "trouser-left";
  if (endpoint_trouser_left_18) {
    mesh_trouser_left_18.position.copy(endpoint_trouser_left_18.midpoint);
    mesh_trouser_left_18.quaternion.copy(endpoint_trouser_left_18.quaternion);
  }
  mesh_trouser_left_18.castShadow = options.castShadow ?? true;
  mesh_trouser_left_18.receiveShadow = options.receiveShadow ?? true;
  mesh_trouser_left_18.userData.sculptComponent = {"id": "trouser-left", "name": "trouser-left", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.085, 0], [0.1, 0.04], [0.085, 0.2], [0.095, 0.37], [0.108, 0.53], [0.117, 0.79], [0, 0.82]], "segments": 32}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "trouser-left-contact", "localStart": [0.14, 0.12, 0], "localEnd": [0.14, 0.13999999999999999, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 0.91, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.14, 0.12, 0], "rotation": [0, 0, -0.025], "scale": [1, 1, 0.91]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "trouser-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_trouser_left_18.add(mesh_trouser_left_18);
  meshes["trouser-left"] = mesh_trouser_left_18;
  colliders["trouser-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["trouser-left"] ??= [];
  destructionGroups["trouser-left"].push(node_trouser_left_18);

  const endpoint_lip_line_19 = makeAttachmentEndpoint(null);
  const node_lip_line_19 = new THREE.Group();
  node_lip_line_19.name = "lip-line__pivot";
  node_lip_line_19.scale.set(1, 1, 1);
  if (endpoint_lip_line_19) {
    node_lip_line_19.position.copy(endpoint_lip_line_19.start);
    node_lip_line_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lip_line_19.position.set(0.0, -0.085, 0.107);
    node_lip_line_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_lip_line_19.userData.sculptComponent = {"id": "lip-line", "name": "lip-line", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "lip-line-contact", "localStart": [0, -0.085, 0.107], "localEnd": [0, -0.065, 0.107], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.064, "height": 0.008, "depth": 0.011, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, -0.085, 0.107], "rotation": [0, 0, 0], "scale": [0.064, 0.008, 0.011]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lip-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["mouth-mark"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lip_line_19.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lip-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["head"] ?? root).add(node_lip_line_19);
  nodes["lip-line"] = node_lip_line_19;
  const mesh_lip_line_19Geometry = endpoint_lip_line_19
    ? new THREE.CylinderGeometry(endpoint_lip_line_19.endRadius, endpoint_lip_line_19.baseRadius, endpoint_lip_line_19.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_lip_line_19) {
    mesh_lip_line_19Geometry.scale(0.064, 0.008, 0.011);
  }
  const mesh_lip_line_19 = new THREE.Mesh(
    mesh_lip_line_19Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lip_line_19.name = "lip-line";
  if (endpoint_lip_line_19) {
    mesh_lip_line_19.position.copy(endpoint_lip_line_19.midpoint);
    mesh_lip_line_19.quaternion.copy(endpoint_lip_line_19.quaternion);
  }
  mesh_lip_line_19.castShadow = options.castShadow ?? true;
  mesh_lip_line_19.receiveShadow = options.receiveShadow ?? true;
  mesh_lip_line_19.userData.sculptComponent = {"id": "lip-line", "name": "lip-line", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": {"parentId": "head", "parentSocket": "lip-line-contact", "localStart": [0, -0.085, 0.107], "localEnd": [0, -0.065, 0.107], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.064, "height": 0.008, "depth": 0.011, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, -0.085, 0.107], "rotation": [0, 0, 0], "scale": [0.064, 0.008, 0.011]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lip-line", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["mouth-mark"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lip_line_19.add(mesh_lip_line_19);
  meshes["lip-line"] = mesh_lip_line_19;
  colliders["lip-line"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["lip-line"] ??= [];
  destructionGroups["lip-line"].push(node_lip_line_19);

  const endpoint_sleeve_holding_20 = makeAttachmentEndpoint(null);
  const node_sleeve_holding_20 = new THREE.Group();
  node_sleeve_holding_20.name = "sleeve-holding__pivot";
  node_sleeve_holding_20.scale.set(1, 1, 1);
  if (endpoint_sleeve_holding_20) {
    node_sleeve_holding_20.position.copy(endpoint_sleeve_holding_20.start);
    node_sleeve_holding_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_holding_20.position.set(0.0, 0.0, 0.0);
    node_sleeve_holding_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_holding_20.userData.sculptComponent = {"id": "sleeve-holding", "name": "sleeve-holding", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.75, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "taperedSweep": {"stations": [{"position": [-0.255, 1.52, 0], "rx": 0.091, "rz": 0.091, "twist": 0}, {"position": [-0.32, 1.31, 0.015], "rx": 0.08372, "rz": 0.08372, "twist": 0}, {"position": [-0.29, 1.19, 0.1], "rx": 0.0819, "rz": 0.0819, "twist": 0}, {"position": [-0.17, 1.22, 0.23], "rx": 0.047, "rz": 0.047, "twist": 0}], "radialSegments": 16, "capEnds": true}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "sleeve-holding-contact", "localStart": [-0.255, 1.52, 0], "localEnd": [-0.17, 1.22, 0.23], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-holding", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["elbow fold and sleeve cuff"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_sleeve_holding_20.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-holding", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_sleeve_holding_20);
  nodes["sleeve-holding"] = node_sleeve_holding_20;
  const mesh_sleeve_holding_20Geometry = endpoint_sleeve_holding_20
    ? new THREE.CylinderGeometry(endpoint_sleeve_holding_20.endRadius, endpoint_sleeve_holding_20.baseRadius, endpoint_sleeve_holding_20.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.255, 1.52, 0], "rx": 0.091, "rz": 0.091, "twist": 0}, {"position": [-0.32, 1.31, 0.015], "rx": 0.08372, "rz": 0.08372, "twist": 0}, {"position": [-0.29, 1.19, 0.1], "rx": 0.0819, "rz": 0.0819, "twist": 0}, {"position": [-0.17, 1.22, 0.23], "rx": 0.047, "rz": 0.047, "twist": 0}], "radialSegments": 16, "capEnds": true});
  if (!endpoint_sleeve_holding_20) {
    mesh_sleeve_holding_20Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_holding_20 = new THREE.Mesh(
    mesh_sleeve_holding_20Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_holding_20.name = "sleeve-holding";
  if (endpoint_sleeve_holding_20) {
    mesh_sleeve_holding_20.position.copy(endpoint_sleeve_holding_20.midpoint);
    mesh_sleeve_holding_20.quaternion.copy(endpoint_sleeve_holding_20.quaternion);
  }
  mesh_sleeve_holding_20.castShadow = options.castShadow ?? true;
  mesh_sleeve_holding_20.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_holding_20.userData.sculptComponent = {"id": "sleeve-holding", "name": "sleeve-holding", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.75, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "taperedSweep": {"stations": [{"position": [-0.255, 1.52, 0], "rx": 0.091, "rz": 0.091, "twist": 0}, {"position": [-0.32, 1.31, 0.015], "rx": 0.08372, "rz": 0.08372, "twist": 0}, {"position": [-0.29, 1.19, 0.1], "rx": 0.0819, "rz": 0.0819, "twist": 0}, {"position": [-0.17, 1.22, 0.23], "rx": 0.047, "rz": 0.047, "twist": 0}], "radialSegments": 16, "capEnds": true}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "sleeve-holding-contact", "localStart": [-0.255, 1.52, 0], "localEnd": [-0.17, 1.22, 0.23], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-holding", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["elbow fold and sleeve cuff"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_sleeve_holding_20.add(mesh_sleeve_holding_20);
  meshes["sleeve-holding"] = mesh_sleeve_holding_20;
  colliders["sleeve-holding"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-holding"] ??= [];
  destructionGroups["sleeve-holding"].push(node_sleeve_holding_20);

  const endpoint_sleeve_pocket_21 = makeAttachmentEndpoint(null);
  const node_sleeve_pocket_21 = new THREE.Group();
  node_sleeve_pocket_21.name = "sleeve-pocket__pivot";
  node_sleeve_pocket_21.scale.set(1, 1, 1);
  if (endpoint_sleeve_pocket_21) {
    node_sleeve_pocket_21.position.copy(endpoint_sleeve_pocket_21.start);
    node_sleeve_pocket_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_pocket_21.position.set(0.0, 0.0, 0.0);
    node_sleeve_pocket_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_pocket_21.userData.sculptComponent = {"id": "sleeve-pocket", "name": "sleeve-pocket", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.75, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "taperedSweep": {"stations": [{"position": [0.25, 1.52, 0], "rx": 0.083, "rz": 0.083, "twist": 0}, {"position": [0.32, 1.29, 0.025], "rx": 0.07636000000000001, "rz": 0.07636000000000001, "twist": 0}, {"position": [0.29, 1.1, 0.09], "rx": 0.0747, "rz": 0.0747, "twist": 0}, {"position": [0.23, 1.04, 0.14], "rx": 0.042, "rz": 0.042, "twist": 0}], "radialSegments": 16, "capEnds": true}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "sleeve-pocket-contact", "localStart": [0.25, 1.52, 0], "localEnd": [0.23, 1.04, 0.14], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-pocket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["elbow fold and sleeve cuff"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_sleeve_pocket_21.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-pocket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_sleeve_pocket_21);
  nodes["sleeve-pocket"] = node_sleeve_pocket_21;
  const mesh_sleeve_pocket_21Geometry = endpoint_sleeve_pocket_21
    ? new THREE.CylinderGeometry(endpoint_sleeve_pocket_21.endRadius, endpoint_sleeve_pocket_21.baseRadius, endpoint_sleeve_pocket_21.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.25, 1.52, 0], "rx": 0.083, "rz": 0.083, "twist": 0}, {"position": [0.32, 1.29, 0.025], "rx": 0.07636000000000001, "rz": 0.07636000000000001, "twist": 0}, {"position": [0.29, 1.1, 0.09], "rx": 0.0747, "rz": 0.0747, "twist": 0}, {"position": [0.23, 1.04, 0.14], "rx": 0.042, "rz": 0.042, "twist": 0}], "radialSegments": 16, "capEnds": true});
  if (!endpoint_sleeve_pocket_21) {
    mesh_sleeve_pocket_21Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_pocket_21 = new THREE.Mesh(
    mesh_sleeve_pocket_21Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_pocket_21.name = "sleeve-pocket";
  if (endpoint_sleeve_pocket_21) {
    mesh_sleeve_pocket_21.position.copy(endpoint_sleeve_pocket_21.midpoint);
    mesh_sleeve_pocket_21.quaternion.copy(endpoint_sleeve_pocket_21.quaternion);
  }
  mesh_sleeve_pocket_21.castShadow = options.castShadow ?? true;
  mesh_sleeve_pocket_21.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_pocket_21.userData.sculptComponent = {"id": "sleeve-pocket", "name": "sleeve-pocket", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.75, "primitive": "tapered-sweep", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "taperedSweep": {"stations": [{"position": [0.25, 1.52, 0], "rx": 0.083, "rz": 0.083, "twist": 0}, {"position": [0.32, 1.29, 0.025], "rx": 0.07636000000000001, "rz": 0.07636000000000001, "twist": 0}, {"position": [0.29, 1.1, 0.09], "rx": 0.0747, "rz": 0.0747, "twist": 0}, {"position": [0.23, 1.04, 0.14], "rx": 0.042, "rz": 0.042, "twist": 0}], "radialSegments": 16, "capEnds": true}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "sleeve-pocket-contact", "localStart": [0.25, 1.52, 0], "localEnd": [0.23, 1.04, 0.14], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "sleeve-pocket", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["elbow fold and sleeve cuff"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_sleeve_pocket_21.add(mesh_sleeve_pocket_21);
  meshes["sleeve-pocket"] = mesh_sleeve_pocket_21;
  colliders["sleeve-pocket"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-pocket"] ??= [];
  destructionGroups["sleeve-pocket"].push(node_sleeve_pocket_21);

  const endpoint_holding_hand_22 = makeAttachmentEndpoint(null);
  const node_holding_hand_22 = new THREE.Group();
  node_holding_hand_22.name = "holding-hand__pivot";
  node_holding_hand_22.scale.set(1, 1, 1);
  if (endpoint_holding_hand_22) {
    node_holding_hand_22.position.copy(endpoint_holding_hand_22.start);
    node_holding_hand_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_holding_hand_22.position.set(-0.11, 1.24, 0.255);
    node_holding_hand_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_holding_hand_22.userData.sculptComponent = {"id": "holding-hand", "name": "holding-hand", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "holding-hand-contact", "localStart": [-0.11, 1.24, 0.255], "localEnd": [-0.11, 1.26, 0.255], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.17, "height": 0.1, "depth": 0.11, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.11, 1.24, 0.255], "rotation": [0, 0, 0], "scale": [0.17, 0.1, 0.11]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "holding-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_holding_hand_22.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "holding-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_holding_hand_22);
  nodes["holding-hand"] = node_holding_hand_22;
  const mesh_holding_hand_22Geometry = endpoint_holding_hand_22
    ? new THREE.CylinderGeometry(endpoint_holding_hand_22.endRadius, endpoint_holding_hand_22.baseRadius, endpoint_holding_hand_22.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_holding_hand_22) {
    mesh_holding_hand_22Geometry.scale(0.17, 0.1, 0.11);
  }
  const mesh_holding_hand_22 = new THREE.Mesh(
    mesh_holding_hand_22Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_holding_hand_22.name = "holding-hand";
  if (endpoint_holding_hand_22) {
    mesh_holding_hand_22.position.copy(endpoint_holding_hand_22.midpoint);
    mesh_holding_hand_22.quaternion.copy(endpoint_holding_hand_22.quaternion);
  }
  mesh_holding_hand_22.castShadow = options.castShadow ?? true;
  mesh_holding_hand_22.receiveShadow = options.receiveShadow ?? true;
  mesh_holding_hand_22.userData.sculptComponent = {"id": "holding-hand", "name": "holding-hand", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "holding-hand-contact", "localStart": [-0.11, 1.24, 0.255], "localEnd": [-0.11, 1.26, 0.255], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.17, "height": 0.1, "depth": 0.11, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.11, 1.24, 0.255], "rotation": [0, 0, 0], "scale": [0.17, 0.1, 0.11]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "holding-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_holding_hand_22.add(mesh_holding_hand_22);
  meshes["holding-hand"] = mesh_holding_hand_22;
  colliders["holding-hand"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["holding-hand"] ??= [];
  destructionGroups["holding-hand"].push(node_holding_hand_22);

  const endpoint_pocket_hand_23 = makeAttachmentEndpoint(null);
  const node_pocket_hand_23 = new THREE.Group();
  node_pocket_hand_23.name = "pocket-hand__pivot";
  node_pocket_hand_23.scale.set(1, 1, 1);
  if (endpoint_pocket_hand_23) {
    node_pocket_hand_23.position.copy(endpoint_pocket_hand_23.start);
    node_pocket_hand_23.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pocket_hand_23.position.set(0.215, 1.055, 0.16);
    node_pocket_hand_23.rotation.set(0.0, 0.0, 0.0);
  }
  node_pocket_hand_23.userData.sculptComponent = {"id": "pocket-hand", "name": "pocket-hand", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "pocket-hand-contact", "localStart": [0.215, 1.055, 0.16], "localEnd": [0.215, 1.075, 0.16], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.1, "height": 0.095, "depth": 0.065, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.215, 1.055, 0.16], "rotation": [0, 0, 0], "scale": [0.1, 0.095, 0.065]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pocket-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_pocket_hand_23.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pocket-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["root"] ?? root).add(node_pocket_hand_23);
  nodes["pocket-hand"] = node_pocket_hand_23;
  const mesh_pocket_hand_23Geometry = endpoint_pocket_hand_23
    ? new THREE.CylinderGeometry(endpoint_pocket_hand_23.endRadius, endpoint_pocket_hand_23.baseRadius, endpoint_pocket_hand_23.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pocket_hand_23) {
    mesh_pocket_hand_23Geometry.scale(0.1, 0.095, 0.065);
  }
  const mesh_pocket_hand_23 = new THREE.Mesh(
    mesh_pocket_hand_23Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pocket_hand_23.name = "pocket-hand";
  if (endpoint_pocket_hand_23) {
    mesh_pocket_hand_23.position.copy(endpoint_pocket_hand_23.midpoint);
    mesh_pocket_hand_23.quaternion.copy(endpoint_pocket_hand_23.quaternion);
  }
  mesh_pocket_hand_23.castShadow = options.castShadow ?? true;
  mesh_pocket_hand_23.receiveShadow = options.receiveShadow ?? true;
  mesh_pocket_hand_23.userData.sculptComponent = {"id": "pocket-hand", "name": "pocket-hand", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "pocket-hand-contact", "localStart": [0.215, 1.055, 0.16], "localEnd": [0.215, 1.075, 0.16], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.1, "height": 0.095, "depth": 0.065, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.215, 1.055, 0.16], "rotation": [0, 0, 0], "scale": [0.1, 0.095, 0.065]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pocket-hand", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(213, 200, 176, 1)", "secondaryAlbedo": "rgba(213, 200, 176, 1)", "materialClass": "skin", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_pocket_hand_23.add(mesh_pocket_hand_23);
  meshes["pocket-hand"] = mesh_pocket_hand_23;
  colliders["pocket-hand"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pocket-hand"] ??= [];
  destructionGroups["pocket-hand"].push(node_pocket_hand_23);

  const endpoint_shirt_inset_24 = makeAttachmentEndpoint(null);
  const node_shirt_inset_24 = new THREE.Group();
  node_shirt_inset_24.name = "shirt-inset__pivot";
  node_shirt_inset_24.scale.set(1, 1, 1);
  if (endpoint_shirt_inset_24) {
    node_shirt_inset_24.position.copy(endpoint_shirt_inset_24.start);
    node_shirt_inset_24.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shirt_inset_24.position.set(0.0, 0.0, 0.168);
    node_shirt_inset_24.rotation.set(0.0, 0.0, 0.0);
  }
  node_shirt_inset_24.userData.sculptComponent = {"id": "shirt-inset", "name": "shirt-inset", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.1, 1.61], [0.1, 1.61], [0.125, 1.04], [-0.09, 1.04]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shirt-inset-contact", "localStart": [0, 0, 0.168], "localEnd": [0, 0.02, 0.168], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.168], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shirt-inset", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shirt_inset_24.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shirt-inset", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["root"] ?? root).add(node_shirt_inset_24);
  nodes["shirt-inset"] = node_shirt_inset_24;
  const mesh_shirt_inset_24Geometry = endpoint_shirt_inset_24
    ? new THREE.CylinderGeometry(endpoint_shirt_inset_24.endRadius, endpoint_shirt_inset_24.baseRadius, endpoint_shirt_inset_24.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.1, 1.61], [0.1, 1.61], [0.125, 1.04], [-0.09, 1.04]], "depth": 0.012});
  if (!endpoint_shirt_inset_24) {
    mesh_shirt_inset_24Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_shirt_inset_24 = new THREE.Mesh(
    mesh_shirt_inset_24Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shirt_inset_24.name = "shirt-inset";
  if (endpoint_shirt_inset_24) {
    mesh_shirt_inset_24.position.copy(endpoint_shirt_inset_24.midpoint);
    mesh_shirt_inset_24.quaternion.copy(endpoint_shirt_inset_24.quaternion);
  }
  mesh_shirt_inset_24.castShadow = options.castShadow ?? true;
  mesh_shirt_inset_24.receiveShadow = options.receiveShadow ?? true;
  mesh_shirt_inset_24.userData.sculptComponent = {"id": "shirt-inset", "name": "shirt-inset", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.1, 1.61], [0.1, 1.61], [0.125, 1.04], [-0.09, 1.04]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "shirt-inset-contact", "localStart": [0, 0, 0.168], "localEnd": [0, 0.02, 0.168], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.168], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shirt-inset", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_shirt_inset_24.add(mesh_shirt_inset_24);
  meshes["shirt-inset"] = mesh_shirt_inset_24;
  colliders["shirt-inset"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shirt-inset"] ??= [];
  destructionGroups["shirt-inset"].push(node_shirt_inset_24);

  const endpoint_tie_25 = makeAttachmentEndpoint(null);
  const node_tie_25 = new THREE.Group();
  node_tie_25.name = "tie__pivot";
  node_tie_25.scale.set(1, 1, 1);
  if (endpoint_tie_25) {
    node_tie_25.position.copy(endpoint_tie_25.start);
    node_tie_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tie_25.position.set(0.0, 0.0, 0.19);
    node_tie_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_tie_25.userData.sculptComponent = {"id": "tie", "name": "tie", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.028, 1.53], [0.028, 1.53], [0.05, 1.1], [0, 1.04], [-0.04, 1.1]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "tie-contact", "localStart": [0, 0, 0.19], "localEnd": [0, 0.02, 0.19], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.19], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pointed-tie"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_tie_25.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_tie_25);
  nodes["tie"] = node_tie_25;
  const mesh_tie_25Geometry = endpoint_tie_25
    ? new THREE.CylinderGeometry(endpoint_tie_25.endRadius, endpoint_tie_25.baseRadius, endpoint_tie_25.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.028, 1.53], [0.028, 1.53], [0.05, 1.1], [0, 1.04], [-0.04, 1.1]], "depth": 0.012});
  if (!endpoint_tie_25) {
    mesh_tie_25Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tie_25 = new THREE.Mesh(
    mesh_tie_25Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tie_25.name = "tie";
  if (endpoint_tie_25) {
    mesh_tie_25.position.copy(endpoint_tie_25.midpoint);
    mesh_tie_25.quaternion.copy(endpoint_tie_25.quaternion);
  }
  mesh_tie_25.castShadow = options.castShadow ?? true;
  mesh_tie_25.receiveShadow = options.receiveShadow ?? true;
  mesh_tie_25.userData.sculptComponent = {"id": "tie", "name": "tie", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.028, 1.53], [0.028, 1.53], [0.05, 1.1], [0, 1.04], [-0.04, 1.1]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "tie-contact", "localStart": [0, 0, 0.19], "localEnd": [0, 0.02, 0.19], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.19], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tie", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["pointed-tie"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_tie_25.add(mesh_tie_25);
  meshes["tie"] = mesh_tie_25;
  colliders["tie"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tie"] ??= [];
  destructionGroups["tie"].push(node_tie_25);

  const endpoint_lapel__1_26 = makeAttachmentEndpoint(null);
  const node_lapel__1_26 = new THREE.Group();
  node_lapel__1_26.name = "lapel--1__pivot";
  node_lapel__1_26.scale.set(1, 1, 1);
  if (endpoint_lapel__1_26) {
    node_lapel__1_26.position.copy(endpoint_lapel__1_26.start);
    node_lapel__1_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lapel__1_26.position.set(0.0, 0.0, 0.198);
    node_lapel__1_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_lapel__1_26.userData.sculptComponent = {"id": "lapel--1", "name": "lapel--1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.085, 1.62], [-0.17, 1.54], [-0.22, 1.37], [-0.105, 1.43], [-0.14, 1.35], [-0.015, 1.15]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "lapel--1-contact", "localStart": [0, 0, 0.198], "localEnd": [0, 0.02, 0.198], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.198], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["lapel-edge"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lapel__1_26.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_lapel__1_26);
  nodes["lapel--1"] = node_lapel__1_26;
  const mesh_lapel__1_26Geometry = endpoint_lapel__1_26
    ? new THREE.CylinderGeometry(endpoint_lapel__1_26.endRadius, endpoint_lapel__1_26.baseRadius, endpoint_lapel__1_26.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.085, 1.62], [-0.17, 1.54], [-0.22, 1.37], [-0.105, 1.43], [-0.14, 1.35], [-0.015, 1.15]], "depth": 0.012});
  if (!endpoint_lapel__1_26) {
    mesh_lapel__1_26Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_lapel__1_26 = new THREE.Mesh(
    mesh_lapel__1_26Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lapel__1_26.name = "lapel--1";
  if (endpoint_lapel__1_26) {
    mesh_lapel__1_26.position.copy(endpoint_lapel__1_26.midpoint);
    mesh_lapel__1_26.quaternion.copy(endpoint_lapel__1_26.quaternion);
  }
  mesh_lapel__1_26.castShadow = options.castShadow ?? true;
  mesh_lapel__1_26.receiveShadow = options.receiveShadow ?? true;
  mesh_lapel__1_26.userData.sculptComponent = {"id": "lapel--1", "name": "lapel--1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[-0.085, 1.62], [-0.17, 1.54], [-0.22, 1.37], [-0.105, 1.43], [-0.14, 1.35], [-0.015, 1.15]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "lapel--1-contact", "localStart": [0, 0, 0.198], "localEnd": [0, 0.02, 0.198], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.198], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["lapel-edge"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lapel__1_26.add(mesh_lapel__1_26);
  meshes["lapel--1"] = mesh_lapel__1_26;
  colliders["lapel--1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["lapel--1"] ??= [];
  destructionGroups["lapel--1"].push(node_lapel__1_26);

  const endpoint_collar__1_27 = makeAttachmentEndpoint(null);
  const node_collar__1_27 = new THREE.Group();
  node_collar__1_27.name = "collar--1__pivot";
  node_collar__1_27.scale.set(1, 1, 1);
  if (endpoint_collar__1_27) {
    node_collar__1_27.position.copy(endpoint_collar__1_27.start);
    node_collar__1_27.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_collar__1_27.position.set(0.0, 0.0, 0.208);
    node_collar__1_27.rotation.set(0.0, 0.0, 0.0);
  }
  node_collar__1_27.userData.sculptComponent = {"id": "collar--1", "name": "collar--1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0, 1.56], [-0.09, 1.63], [-0.13, 1.51], [-0.05, 1.47]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "collar--1-contact", "localStart": [0, 0, 0.208], "localEnd": [0, 0.02, 0.208], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.208], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_collar__1_27.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["root"] ?? root).add(node_collar__1_27);
  nodes["collar--1"] = node_collar__1_27;
  const mesh_collar__1_27Geometry = endpoint_collar__1_27
    ? new THREE.CylinderGeometry(endpoint_collar__1_27.endRadius, endpoint_collar__1_27.baseRadius, endpoint_collar__1_27.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0, 1.56], [-0.09, 1.63], [-0.13, 1.51], [-0.05, 1.47]], "depth": 0.012});
  if (!endpoint_collar__1_27) {
    mesh_collar__1_27Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_collar__1_27 = new THREE.Mesh(
    mesh_collar__1_27Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_collar__1_27.name = "collar--1";
  if (endpoint_collar__1_27) {
    mesh_collar__1_27.position.copy(endpoint_collar__1_27.midpoint);
    mesh_collar__1_27.quaternion.copy(endpoint_collar__1_27.quaternion);
  }
  mesh_collar__1_27.castShadow = options.castShadow ?? true;
  mesh_collar__1_27.receiveShadow = options.receiveShadow ?? true;
  mesh_collar__1_27.userData.sculptComponent = {"id": "collar--1", "name": "collar--1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0, 1.56], [-0.09, 1.63], [-0.13, 1.51], [-0.05, 1.47]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "collar--1-contact", "localStart": [0, 0, 0.208], "localEnd": [0, 0.02, 0.208], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.208], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar--1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_collar__1_27.add(mesh_collar__1_27);
  meshes["collar--1"] = mesh_collar__1_27;
  colliders["collar--1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["collar--1"] ??= [];
  destructionGroups["collar--1"].push(node_collar__1_27);

  const endpoint_lapel_1_28 = makeAttachmentEndpoint(null);
  const node_lapel_1_28 = new THREE.Group();
  node_lapel_1_28.name = "lapel-1__pivot";
  node_lapel_1_28.scale.set(1, 1, 1);
  if (endpoint_lapel_1_28) {
    node_lapel_1_28.position.copy(endpoint_lapel_1_28.start);
    node_lapel_1_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lapel_1_28.position.set(0.0, 0.0, 0.198);
    node_lapel_1_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_lapel_1_28.userData.sculptComponent = {"id": "lapel-1", "name": "lapel-1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0.085, 1.62], [0.17, 1.54], [0.22, 1.37], [0.105, 1.43], [0.14, 1.35], [0.015, 1.15]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "lapel-1-contact", "localStart": [0, 0, 0.198], "localEnd": [0, 0.02, 0.198], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.198], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lapel_1_28.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}};
  (nodes["root"] ?? root).add(node_lapel_1_28);
  nodes["lapel-1"] = node_lapel_1_28;
  const mesh_lapel_1_28Geometry = endpoint_lapel_1_28
    ? new THREE.CylinderGeometry(endpoint_lapel_1_28.endRadius, endpoint_lapel_1_28.baseRadius, endpoint_lapel_1_28.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.085, 1.62], [0.17, 1.54], [0.22, 1.37], [0.105, 1.43], [0.14, 1.35], [0.015, 1.15]], "depth": 0.012});
  if (!endpoint_lapel_1_28) {
    mesh_lapel_1_28Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_lapel_1_28 = new THREE.Mesh(
    mesh_lapel_1_28Geometry,
    materialMap["jacket"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lapel_1_28.name = "lapel-1";
  if (endpoint_lapel_1_28) {
    mesh_lapel_1_28.position.copy(endpoint_lapel_1_28.midpoint);
    mesh_lapel_1_28.quaternion.copy(endpoint_lapel_1_28.quaternion);
  }
  mesh_lapel_1_28.castShadow = options.castShadow ?? true;
  mesh_lapel_1_28.receiveShadow = options.receiveShadow ?? true;
  mesh_lapel_1_28.userData.sculptComponent = {"id": "lapel-1", "name": "lapel-1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0.085, 1.62], [0.17, 1.54], [0.22, 1.37], [0.105, 1.43], [0.14, 1.35], [0.015, 1.15]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "lapel-1-contact", "localStart": [0, 0, 0.198], "localEnd": [0, 0.02, 0.198], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.198], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lapel-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "jacket"}}, "material": "jacket", "materialLayers": ["jacket"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(41, 40, 36, 1)", "secondaryAlbedo": "rgba(41, 40, 36, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_lapel_1_28.add(mesh_lapel_1_28);
  meshes["lapel-1"] = mesh_lapel_1_28;
  colliders["lapel-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["lapel-1"] ??= [];
  destructionGroups["lapel-1"].push(node_lapel_1_28);

  const endpoint_collar_1_29 = makeAttachmentEndpoint(null);
  const node_collar_1_29 = new THREE.Group();
  node_collar_1_29.name = "collar-1__pivot";
  node_collar_1_29.scale.set(1, 1, 1);
  if (endpoint_collar_1_29) {
    node_collar_1_29.position.copy(endpoint_collar_1_29.start);
    node_collar_1_29.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_collar_1_29.position.set(0.0, 0.0, 0.208);
    node_collar_1_29.rotation.set(0.0, 0.0, 0.0);
  }
  node_collar_1_29.userData.sculptComponent = {"id": "collar-1", "name": "collar-1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0, 1.56], [0.09, 1.63], [0.13, 1.51], [0.05, 1.47]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "collar-1-contact", "localStart": [0, 0, 0.208], "localEnd": [0, 0.02, 0.208], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.208], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["collar-point"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_collar_1_29.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["root"] ?? root).add(node_collar_1_29);
  nodes["collar-1"] = node_collar_1_29;
  const mesh_collar_1_29Geometry = endpoint_collar_1_29
    ? new THREE.CylinderGeometry(endpoint_collar_1_29.endRadius, endpoint_collar_1_29.baseRadius, endpoint_collar_1_29.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0, 1.56], [0.09, 1.63], [0.13, 1.51], [0.05, 1.47]], "depth": 0.012});
  if (!endpoint_collar_1_29) {
    mesh_collar_1_29Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_collar_1_29 = new THREE.Mesh(
    mesh_collar_1_29Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_collar_1_29.name = "collar-1";
  if (endpoint_collar_1_29) {
    mesh_collar_1_29.position.copy(endpoint_collar_1_29.midpoint);
    mesh_collar_1_29.quaternion.copy(endpoint_collar_1_29.quaternion);
  }
  mesh_collar_1_29.castShadow = options.castShadow ?? true;
  mesh_collar_1_29.receiveShadow = options.receiveShadow ?? true;
  mesh_collar_1_29.userData.sculptComponent = {"id": "collar-1", "name": "collar-1", "level": "meso", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "profile2D": {"points": [[0, 1.56], [0.09, 1.63], [0.13, 1.51], [0.05, 1.47]], "depth": 0.012}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "collar-1-contact", "localStart": [0, 0, 0.208], "localEnd": [0, 0.02, 0.208], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0, 0.208], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "collar-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["collar-point"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_collar_1_29.add(mesh_collar_1_29);
  meshes["collar-1"] = mesh_collar_1_29;
  colliders["collar-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["collar-1"] ??= [];
  destructionGroups["collar-1"].push(node_collar_1_29);

  const endpoint_coffee_cup_30 = makeAttachmentEndpoint(null);
  const node_coffee_cup_30 = new THREE.Group();
  node_coffee_cup_30.name = "coffee-cup__pivot";
  node_coffee_cup_30.scale.set(1, 1, 1);
  if (endpoint_coffee_cup_30) {
    node_coffee_cup_30.position.copy(endpoint_coffee_cup_30.start);
    node_coffee_cup_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_coffee_cup_30.position.set(-0.018, 1.2, 0.3);
    node_coffee_cup_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_coffee_cup_30.userData.sculptComponent = {"id": "coffee-cup", "name": "coffee-cup", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.058, 0], [0.072, 0.02], [0.08, 0.15], [0.068, 0.155], [0.06, 0.025], [0, 0.025]], "segments": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "coffee-cup-contact", "localStart": [-0.075, 1.25, 0.3], "localEnd": [-0.018, 1.22, 0.3], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.018, 1.2, 0.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["cup-rim"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_coffee_cup_30.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["root"] ?? root).add(node_coffee_cup_30);
  nodes["coffee-cup"] = node_coffee_cup_30;
  const mesh_coffee_cup_30Geometry = endpoint_coffee_cup_30
    ? new THREE.CylinderGeometry(endpoint_coffee_cup_30.endRadius, endpoint_coffee_cup_30.baseRadius, endpoint_coffee_cup_30.length, 16, 6)
    : buildLatheGeometry({"points": [[0, 0], [0.058, 0], [0.072, 0.02], [0.08, 0.15], [0.068, 0.155], [0.06, 0.025], [0, 0.025]], "segments": 48});
  if (!endpoint_coffee_cup_30) {
    mesh_coffee_cup_30Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_coffee_cup_30 = new THREE.Mesh(
    mesh_coffee_cup_30Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_coffee_cup_30.name = "coffee-cup";
  if (endpoint_coffee_cup_30) {
    mesh_coffee_cup_30.position.copy(endpoint_coffee_cup_30.midpoint);
    mesh_coffee_cup_30.quaternion.copy(endpoint_coffee_cup_30.quaternion);
  }
  mesh_coffee_cup_30.castShadow = options.castShadow ?? true;
  mesh_coffee_cup_30.receiveShadow = options.receiveShadow ?? true;
  mesh_coffee_cup_30.userData.sculptComponent = {"id": "coffee-cup", "name": "coffee-cup", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"points": [[0, 0], [0.058, 0], [0.072, 0.02], [0.08, 0.15], [0.068, 0.155], [0.06, 0.025], [0, 0.025]], "segments": 48}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "coffee-cup-contact", "localStart": [-0.075, 1.25, 0.3], "localEnd": [-0.018, 1.22, 0.3], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.018, 1.2, 0.3], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["cup-rim"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_coffee_cup_30.add(mesh_coffee_cup_30);
  meshes["coffee-cup"] = mesh_coffee_cup_30;
  colliders["coffee-cup"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["coffee-cup"] ??= [];
  destructionGroups["coffee-cup"].push(node_coffee_cup_30);

  const endpoint_cup_handle_31 = makeAttachmentEndpoint(null);
  const node_cup_handle_31 = new THREE.Group();
  node_cup_handle_31.name = "cup-handle__pivot";
  node_cup_handle_31.scale.set(1, 1, 1);
  if (endpoint_cup_handle_31) {
    node_cup_handle_31.position.copy(endpoint_cup_handle_31.start);
    node_cup_handle_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cup_handle_31.position.set(-0.081, 0.077, 0.0);
    node_cup_handle_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_cup_handle_31.userData.sculptComponent = {"id": "cup-handle", "name": "cup-handle", "level": "micro", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.25}, "parent": "coffee-cup", "attachment": {"parentId": "coffee-cup", "parentSocket": "cup-handle-contact", "localStart": [-0.081, 0.077, 0], "localEnd": [-0.081, 0.097, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.085, "height": 0.105, "depth": 0.085, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.081, 0.077, 0], "rotation": [0, 0, 0], "scale": [0.085, 0.105, 0.085]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cup-handle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["loop-handle"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_cup_handle_31.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cup-handle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}};
  (nodes["coffee-cup"] ?? root).add(node_cup_handle_31);
  nodes["cup-handle"] = node_cup_handle_31;
  const mesh_cup_handle_31Geometry = endpoint_cup_handle_31
    ? new THREE.CylinderGeometry(endpoint_cup_handle_31.endRadius, endpoint_cup_handle_31.baseRadius, endpoint_cup_handle_31.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.1125, 12, 48);
  if (!endpoint_cup_handle_31) {
    mesh_cup_handle_31Geometry.scale(0.085, 0.105, 0.085);
  }
  const mesh_cup_handle_31 = new THREE.Mesh(
    mesh_cup_handle_31Geometry,
    materialMap["ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cup_handle_31.name = "cup-handle";
  if (endpoint_cup_handle_31) {
    mesh_cup_handle_31.position.copy(endpoint_cup_handle_31.midpoint);
    mesh_cup_handle_31.quaternion.copy(endpoint_cup_handle_31.quaternion);
  }
  mesh_cup_handle_31.castShadow = options.castShadow ?? true;
  mesh_cup_handle_31.receiveShadow = options.receiveShadow ?? true;
  mesh_cup_handle_31.userData.sculptComponent = {"id": "cup-handle", "name": "cup-handle", "level": "micro", "role": "detail", "importance": 1.0, "confidence": 0.75, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.25}, "parent": "coffee-cup", "attachment": {"parentId": "coffee-cup", "parentSocket": "cup-handle-contact", "localStart": [-0.081, 0.077, 0], "localEnd": [-0.081, 0.097, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.085, "height": 0.105, "depth": 0.085, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.081, 0.077, 0], "rotation": [0, 0, 0], "scale": [0.085, 0.105, 0.085]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "cup-handle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "ivory"}}, "material": "ivory", "materialLayers": ["ivory"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["loop-handle"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(225, 216, 191, 1)", "secondaryAlbedo": "rgba(225, 216, 191, 1)", "materialClass": "fabric", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_cup_handle_31.add(mesh_cup_handle_31);
  meshes["cup-handle"] = mesh_cup_handle_31;
  colliders["cup-handle"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["cup-handle"] ??= [];
  destructionGroups["cup-handle"].push(node_cup_handle_31);

  const attachment_coffee_surface_32 = {"parentId": "coffee-cup", "parentSocket": "coffee-surface-contact", "localStart": [0, 0.132, 0], "localEnd": [0, 0.152, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."};
  const endpoint_coffee_surface_32 = makeAttachmentEndpoint(attachment_coffee_surface_32);
  const node_coffee_surface_32 = new THREE.Group();
  node_coffee_surface_32.name = "coffee-surface__pivot";
  node_coffee_surface_32.scale.set(1, 1, 1);
  if (endpoint_coffee_surface_32) {
    node_coffee_surface_32.position.copy(endpoint_coffee_surface_32.start);
    node_coffee_surface_32.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_coffee_surface_32.position.set(0.0, 0.132, 0.0);
    node_coffee_surface_32.rotation.set(0.0, 0.0, 0.0);
  }
  node_coffee_surface_32.userData.sculptComponent = {"id": "coffee-surface", "name": "coffee-surface", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "coffee-cup", "attachment": {"parentId": "coffee-cup", "parentSocket": "coffee-surface-contact", "localStart": [0, 0.132, 0], "localEnd": [0, 0.152, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.128, "height": 0.008, "depth": 0.128, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.132, 0], "rotation": [0, 0, 0], "scale": [0.128, 0.008, 0.128]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-surface", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "coffee"}}, "material": "coffee", "materialLayers": ["coffee"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 25, 15, 1)", "secondaryAlbedo": "rgba(38, 25, 15, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_coffee_surface_32.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-surface", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "coffee"}};
  (nodes["coffee-cup"] ?? root).add(node_coffee_surface_32);
  nodes["coffee-surface"] = node_coffee_surface_32;
  const mesh_coffee_surface_32Geometry = endpoint_coffee_surface_32
    ? new THREE.CylinderGeometry(endpoint_coffee_surface_32.endRadius, endpoint_coffee_surface_32.baseRadius, endpoint_coffee_surface_32.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_coffee_surface_32) {
    mesh_coffee_surface_32Geometry.scale(0.128, 0.008, 0.128);
  }
  const mesh_coffee_surface_32 = new THREE.Mesh(
    mesh_coffee_surface_32Geometry,
    materialMap["coffee"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_coffee_surface_32.name = "coffee-surface";
  if (endpoint_coffee_surface_32) {
    mesh_coffee_surface_32.position.copy(endpoint_coffee_surface_32.midpoint);
    mesh_coffee_surface_32.quaternion.copy(endpoint_coffee_surface_32.quaternion);
  }
  mesh_coffee_surface_32.castShadow = options.castShadow ?? true;
  mesh_coffee_surface_32.receiveShadow = options.receiveShadow ?? true;
  mesh_coffee_surface_32.userData.sculptComponent = {"id": "coffee-surface", "name": "coffee-surface", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "coffee-cup", "attachment": {"parentId": "coffee-cup", "parentSocket": "coffee-surface-contact", "localStart": [0, 0.132, 0], "localEnd": [0, 0.152, 0], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.128, "height": 0.008, "depth": 0.128, "units": "relative", "confidence": 0.75}, "transform": {"position": [0, 0.132, 0], "rotation": [0, 0, 0], "scale": [0.128, 0.008, 0.128]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "coffee-surface", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "coffee"}}, "material": "coffee", "materialLayers": ["coffee"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(38, 25, 15, 1)", "secondaryAlbedo": "rgba(38, 25, 15, 1)", "materialClass": "ceramic", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_coffee_surface_32.add(mesh_coffee_surface_32);
  meshes["coffee-surface"] = mesh_coffee_surface_32;
  colliders["coffee-surface"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["coffee-surface"] ??= [];
  destructionGroups["coffee-surface"].push(node_coffee_surface_32);

  const endpoint_jacket_button_0_33 = makeAttachmentEndpoint(null);
  const node_jacket_button_0_33 = new THREE.Group();
  node_jacket_button_0_33.name = "jacket-button-0__pivot";
  node_jacket_button_0_33.scale.set(1, 1, 1);
  if (endpoint_jacket_button_0_33) {
    node_jacket_button_0_33.position.copy(endpoint_jacket_button_0_33.start);
    node_jacket_button_0_33.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_jacket_button_0_33.position.set(0.087, 1.09, 0.216);
    node_jacket_button_0_33.rotation.set(0.0, 0.0, 0.0);
  }
  node_jacket_button_0_33.userData.sculptComponent = {"id": "jacket-button-0", "name": "jacket-button-0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-0-contact", "localStart": [0.087, 1.09, 0.216], "localEnd": [0.087, 1.11, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.09, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["button-row"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_0_33.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["root"] ?? root).add(node_jacket_button_0_33);
  nodes["jacket-button-0"] = node_jacket_button_0_33;
  const mesh_jacket_button_0_33Geometry = endpoint_jacket_button_0_33
    ? new THREE.CylinderGeometry(endpoint_jacket_button_0_33.endRadius, endpoint_jacket_button_0_33.baseRadius, endpoint_jacket_button_0_33.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_jacket_button_0_33) {
    mesh_jacket_button_0_33Geometry.scale(0.021, 0.021, 0.012);
  }
  const mesh_jacket_button_0_33 = new THREE.Mesh(
    mesh_jacket_button_0_33Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_jacket_button_0_33.name = "jacket-button-0";
  if (endpoint_jacket_button_0_33) {
    mesh_jacket_button_0_33.position.copy(endpoint_jacket_button_0_33.midpoint);
    mesh_jacket_button_0_33.quaternion.copy(endpoint_jacket_button_0_33.quaternion);
  }
  mesh_jacket_button_0_33.castShadow = options.castShadow ?? true;
  mesh_jacket_button_0_33.receiveShadow = options.receiveShadow ?? true;
  mesh_jacket_button_0_33.userData.sculptComponent = {"id": "jacket-button-0", "name": "jacket-button-0", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-0-contact", "localStart": [0.087, 1.09, 0.216], "localEnd": [0.087, 1.11, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.09, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-0", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["button-row"], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_0_33.add(mesh_jacket_button_0_33);
  meshes["jacket-button-0"] = mesh_jacket_button_0_33;
  colliders["jacket-button-0"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["jacket-button-0"] ??= [];
  destructionGroups["jacket-button-0"].push(node_jacket_button_0_33);

  const endpoint_jacket_button_1_34 = makeAttachmentEndpoint(null);
  const node_jacket_button_1_34 = new THREE.Group();
  node_jacket_button_1_34.name = "jacket-button-1__pivot";
  node_jacket_button_1_34.scale.set(1, 1, 1);
  if (endpoint_jacket_button_1_34) {
    node_jacket_button_1_34.position.copy(endpoint_jacket_button_1_34.start);
    node_jacket_button_1_34.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_jacket_button_1_34.position.set(0.087, 1.18, 0.216);
    node_jacket_button_1_34.rotation.set(0.0, 0.0, 0.0);
  }
  node_jacket_button_1_34.userData.sculptComponent = {"id": "jacket-button-1", "name": "jacket-button-1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-1-contact", "localStart": [0.087, 1.18, 0.216], "localEnd": [0.087, 1.2, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.18, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_1_34.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["root"] ?? root).add(node_jacket_button_1_34);
  nodes["jacket-button-1"] = node_jacket_button_1_34;
  const mesh_jacket_button_1_34Geometry = endpoint_jacket_button_1_34
    ? new THREE.CylinderGeometry(endpoint_jacket_button_1_34.endRadius, endpoint_jacket_button_1_34.baseRadius, endpoint_jacket_button_1_34.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_jacket_button_1_34) {
    mesh_jacket_button_1_34Geometry.scale(0.021, 0.021, 0.012);
  }
  const mesh_jacket_button_1_34 = new THREE.Mesh(
    mesh_jacket_button_1_34Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_jacket_button_1_34.name = "jacket-button-1";
  if (endpoint_jacket_button_1_34) {
    mesh_jacket_button_1_34.position.copy(endpoint_jacket_button_1_34.midpoint);
    mesh_jacket_button_1_34.quaternion.copy(endpoint_jacket_button_1_34.quaternion);
  }
  mesh_jacket_button_1_34.castShadow = options.castShadow ?? true;
  mesh_jacket_button_1_34.receiveShadow = options.receiveShadow ?? true;
  mesh_jacket_button_1_34.userData.sculptComponent = {"id": "jacket-button-1", "name": "jacket-button-1", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-1-contact", "localStart": [0.087, 1.18, 0.216], "localEnd": [0.087, 1.2, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.18, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-1", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_1_34.add(mesh_jacket_button_1_34);
  meshes["jacket-button-1"] = mesh_jacket_button_1_34;
  colliders["jacket-button-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["jacket-button-1"] ??= [];
  destructionGroups["jacket-button-1"].push(node_jacket_button_1_34);

  const endpoint_jacket_button_2_35 = makeAttachmentEndpoint(null);
  const node_jacket_button_2_35 = new THREE.Group();
  node_jacket_button_2_35.name = "jacket-button-2__pivot";
  node_jacket_button_2_35.scale.set(1, 1, 1);
  if (endpoint_jacket_button_2_35) {
    node_jacket_button_2_35.position.copy(endpoint_jacket_button_2_35.start);
    node_jacket_button_2_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_jacket_button_2_35.position.set(0.087, 1.28, 0.216);
    node_jacket_button_2_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_jacket_button_2_35.userData.sculptComponent = {"id": "jacket-button-2", "name": "jacket-button-2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-2-contact", "localStart": [0.087, 1.28, 0.216], "localEnd": [0.087, 1.3, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.28, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_2_35.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["root"] ?? root).add(node_jacket_button_2_35);
  nodes["jacket-button-2"] = node_jacket_button_2_35;
  const mesh_jacket_button_2_35Geometry = endpoint_jacket_button_2_35
    ? new THREE.CylinderGeometry(endpoint_jacket_button_2_35.endRadius, endpoint_jacket_button_2_35.baseRadius, endpoint_jacket_button_2_35.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_jacket_button_2_35) {
    mesh_jacket_button_2_35Geometry.scale(0.021, 0.021, 0.012);
  }
  const mesh_jacket_button_2_35 = new THREE.Mesh(
    mesh_jacket_button_2_35Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_jacket_button_2_35.name = "jacket-button-2";
  if (endpoint_jacket_button_2_35) {
    mesh_jacket_button_2_35.position.copy(endpoint_jacket_button_2_35.midpoint);
    mesh_jacket_button_2_35.quaternion.copy(endpoint_jacket_button_2_35.quaternion);
  }
  mesh_jacket_button_2_35.castShadow = options.castShadow ?? true;
  mesh_jacket_button_2_35.receiveShadow = options.receiveShadow ?? true;
  mesh_jacket_button_2_35.userData.sculptComponent = {"id": "jacket-button-2", "name": "jacket-button-2", "level": "micro", "role": "body", "importance": 1.0, "confidence": 0.75, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Reference-shaped solid painted sculpture component; inferred depth, preserved front silhouette.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "jacket-button-2-contact", "localStart": [0.087, 1.28, 0.216], "localEnd": [0.087, 1.3, 0.216], "contactType": "surface-contact", "embedDepth": 0.025, "gapTolerance": 0.008, "evidenceRefs": ["full-object"], "note": "Static attachment contract; visible geometry follows the authored continuous profile."}, "dimensions": {"width": 0.021, "height": 0.021, "depth": 0.012, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.087, 1.28, 0.216], "rotation": [0, 0, 0], "scale": [0.021, 0.021, 0.012]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "jacket-button-2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(34, 37, 34, 1)", "secondaryAlbedo": "rgba(34, 37, 34, 1)", "materialClass": "rubber", "materialClassConfidence": 0.65, "evidenceRefs": ["full-object"]}};
  node_jacket_button_2_35.add(mesh_jacket_button_2_35);
  meshes["jacket-button-2"] = mesh_jacket_button_2_35;
  colliders["jacket-button-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["jacket-button-2"] ??= [];
  destructionGroups["jacket-button-2"].push(node_jacket_button_2_35);
  // repetition system "jacket-button-row" describes 3 parts that are already built individually; not instanced.

  // standProud: hold these components outside the surfaces they cover.
  if (meshes["hair"] && nodes["head"]) {
    applyStandProud(
      meshes["hair"].geometry,
      meshes["hair"],
      nodes["head"],
      {"rings": [[-0.5, 0.0001, 0.0001, 0.0], [-0.416667, 0.276385, 0.276385, 0.0], [-0.333333, 0.372678, 0.372678, 0.0], [-0.25, 0.433013, 0.433013, 0.0], [-0.166667, 0.471405, 0.471405, 0.0], [-0.083333, 0.493007, 0.493007, 0.0], [0.0, 0.5, 0.5, 0.0], [0.083333, 0.493007, 0.493007, 0.0], [0.166667, 0.471405, 0.471405, 0.0], [0.25, 0.433013, 0.433013, 0.0], [0.333333, 0.372678, 0.372678, 0.0], [0.416667, 0.276385, 0.276385, 0.0], [0.5, 0.0001, 0.0001, 0.0]]},
      0.005,
      0.016,
    );
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "stylized-painted-sculpture", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Reference is a charcoal illustration. Extracted maps are diagnostic only: their hatch cannot be used as physical skin/cloth relief. Artist-authored painted response used; no exact physical recovery claim."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createCooperStaticPaintedMiniatureLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Cooper \u2014 static painted miniature look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Key: warm soft directional from upper left, intensity 3, position -3 5 4; reference illustration does not prove physical lights.", "Fill: broad cool hemisphere .9; environment ivory background.", "Rim: cool directional .8 from 3 3 -4. ACES exposure 1.0, soft ground contact shadow; no baked reference shading."];
  lights.userData.lookDevTargets = {"qualityPriority": "stylized-painted-sculpture", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "Reference is a charcoal illustration. Extracted maps are diagnostic only: their hatch cannot be used as physical skin/cloth relief. Artist-authored painted response used; no exact physical recovery claim."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createCooperStaticPaintedMiniatureEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameCooperStaticPaintedMiniatureCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createCooperStaticPaintedMiniaturePresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureCooperStaticPaintedMiniatureRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createCooperStaticPaintedMiniatureInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
