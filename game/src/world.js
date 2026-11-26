// world.js — the archipelago: flat-shaded polar island meshes, a coastal airfield with a painted
// runway, mountain peaks, the numbered target rings, a supply drop zone, props and sea glints.
import { rgbOf, shade, norm3, dot3 } from './render3d.js';

export const SUN = norm3([0.62, 0.46, 0.30]);
export const RUNWAY = { x: 0, z: -650, len: 1000, width: 46, y: 8, heading: 0 };

const ISLANDS = [
  { x: 0, z: -650, r: 760, peak: 88, seed: 3, airfield: true, rings: 6, sectors: 16 },
  { x: -1780, z: 1480, r: 900, peak: 400, seed: 11, alpine: true, rings: 6, sectors: 13 },
  { x: 1470, z: 880, r: 540, peak: 128, seed: 23, rings: 5, sectors: 11 },
  { x: -2380, z: -420, r: 660, peak: 240, seed: 37, alpine: true, rings: 5, sectors: 11 },
  { x: 1830, z: -1880, r: 580, peak: 76, seed: 41, rings: 4, sectors: 9 },
  { x: 120, z: 2560, r: 840, peak: 185, seed: 57, rings: 6, sectors: 13 },
  { x: -880, z: -2280, r: 480, peak: 58, seed: 71, rings: 4, sectors: 9 },
];

export const RINGS = [
  { p: [140, 150, 330], n: [0, 0, 1] },
  { p: [760, 215, 1020], n: [0.45, 0, 0.89] },
  { p: [1580, 300, 1150], n: [0.92, 0, 0.38] },
  { p: [1720, 245, -150], n: [0.2, 0, -0.98] },
  { p: [700, 170, -1350], n: [-0.5, 0, -0.87] },
  { p: [-520, 300, -720], n: [-0.92, 0, 0.4] },
];
export const RING_RADIUS = 50;
export const DROP_ZONE = { x: 120, z: 2680, r: 150 };

const TREE_GREEN = rgbOf('#3c6b4a');
const TREE_DARK = rgbOf('#2f5a40');
const ROCK = rgbOf('#8b8b83');
const SAND = rgbOf('#d9c79a');
const GRASS = rgbOf('#6f9457');
const GRASS_HI = rgbOf('#87a862');

function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function roughNoise(x, z, seed) {
  return (
    Math.sin(x * 0.014 + seed * 2.1) * Math.cos(z * 0.012 - seed * 1.3) * 0.55 +
    Math.sin((x + z) * 0.026 + seed * 0.7) * 0.28 +
    Math.sin(x * 0.043 - z * 0.021 + seed * 4.3) * 0.17
  );
}

// Analytic ground height in metres above sea level; the mesh and the collision share it.
export function heightAt(x, z) {
  let h = 0;
  for (let i = 0; i < ISLANDS.length; i++) {
    const isl = ISLANDS[i];
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d > isl.r) continue;
    const edge = 1 - d / isl.r;
    let hh = isl.peak * Math.pow(edge, isl.alpine ? 1.05 : 1.65);
    hh *= 0.84 + 0.30 * roughNoise(x, z, isl.seed);
    if (isl.alpine) {
      const cone = Math.max(0, 1 - d / (isl.r * 0.52));
      hh += isl.peak * 0.5 * cone * cone;
    }
    if (isl.airfield) {
      const ax = Math.abs(x - RUNWAY.x);
      const az = Math.abs(z - RUNWAY.z);
      const fx = Math.min(1, Math.max(0, (330 - ax) / 120));
      const fz = Math.min(1, Math.max(0, (RUNWAY.len * 0.5 + 350 - az) / 150));
      const flat = fx * fz;
      hh = hh * (1 - flat) + 6.0 * flat;
    }
    if (hh > h) h = hh;
  }
  return h < 0.35 ? 0 : h;
}

export function runwayAt(x, z) {
  const lateral = x - RUNWAY.x;
  const along = z - RUNWAY.z;
  return {
    on: Math.abs(lateral) <= RUNWAY.width * 0.5 + 2 && Math.abs(along) <= RUNWAY.len * 0.5,
    lateral,
    along,
  };
}

function groundColor(h, seed, jitter) {
  let c;
  if (h < 2.4) c = SAND;
  else if (h < 55) c = GRASS;
  else if (h < 150) c = GRASS_HI;
  else if (h < 260) c = (seed & 1) ? GRASS_HI : ROCK;
  else if (h < 360) c = ROCK;
  else c = [230, 236, 240];
  return shade(c, 0.88 + jitter * 0.24);
}

function tri(list, a, b, c, color) {
  let n = norm3([
    (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
    (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
  ]);
  if (n[1] < 0) {
    const t = b;
    b = c;
    c = t;
    n = [-n[0], -n[1], -n[2]];
  }
  const lit = 0.58 + 0.5 * Math.max(0, dot3(n, SUN)) + 0.08 * (n[1] > 0.9 ? 1 : 0);
  list.push({
    pts: [a, b, c],
    color: shade(color, lit),
    n,
    c: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3],
  });
}

function quad(list, a, b, c, d, color) {
  tri(list, a, b, c, color);
  tri(list, a, c, d, color);
}

function paintDigit(list, digit, cx, cz, scale, rot) {
  // Seven-segment strokes in (u across, v along the approach) so numbers read from short final.
  const segs = {
    '1': [[0.45, 0.0, 0.45, 1.0], [0.25, 0.85, 0.45, 1.0]],
    '3': [[0.0, 1.0, 1.0, 1.0], [1.0, 1.0, 1.0, 0.0], [0.0, 0.5, 1.0, 0.5], [0.0, 0.0, 1.0, 0.0]],
    '6': [[1.0, 1.0, 0.0, 1.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [1.0, 0.0, 1.0, 0.5], [1.0, 0.5, 0.0, 0.5]],
    '8': [[0, 1, 1, 1], [1, 1, 1, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0.5, 1, 0.5]],
  };
  const y = RUNWAY.y + 0.07;
  for (const s of segs[digit] || []) {
    const [u0, v0, u1, v1] = s;
    const w = 0.16 * scale;
    const x0 = (u0 - 0.5) * scale, x1 = (u1 - 0.5) * scale;
    const z0 = (v0 - 0.5) * scale, z1 = (v1 - 0.5) * scale;
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const corners = [
      [ax - w / 2, az - w / 2], [bx + w / 2, az - w / 2], [bx + w / 2, bz + w / 2], [ax - w / 2, bz + w / 2],
    ];
    const place = (q) => {
      const u = rot ? -q[0] : q[0], v = rot ? -q[1] : q[1];
      return [cx + u, y, cz + v];
    };
    quad(list, place(corners[0]), place(corners[1]), place(corners[2]), place(corners[3]), [238, 240, 236]);
  }
}

function box(list, cx, cy, cz, sx, sy, sz, color) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
  quad(list, v[4], v[5], v[6], v[7], color);
  quad(list, v[0], v[1], v[2], v[3], shade(color, 0.7));
  quad(list, v[0], v[1], v[5], v[4], shade(color, 0.9));
  quad(list, v[1], v[2], v[6], v[5], shade(color, 0.95));
  quad(list, v[2], v[3], v[7], v[6], shade(color, 0.8));
  quad(list, v[3], v[0], v[4], v[7], shade(color, 0.85));
}

function cone(list, x, y, z, r, hgt, color) {
  const top = [x, y + hgt, z];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r];
    const p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    tri(list, p0, p1, top, shade(color, 0.8 + (i % 2) * 0.12));
  }
}

function tree(list, x, z, s) {
  const y = heightAt(x, z);
  cone(list, x, y + 2.2 * s, z, 3.6 * s, 12.5 * s, TREE_GREEN);
}

function buildTerrain() {
  const faces = [];
  for (const isl of ISLANDS) {
    const NR = isl.rings, NS = isl.sectors;
    const grid = [];
    for (let ri = 0; ri <= NR; ri++) {
      const row = [];
      const fr = ri / NR;
      for (let si = 0; si < NS; si++) {
        const a = (si / NS) * Math.PI * 2;
        const wob = 0.94 + 0.10 * Math.sin(a * 3 + isl.seed) + 0.04 * Math.sin(a * 7 - isl.seed * 2);
        const rr = isl.r * Math.pow(fr, 0.92) * wob;
        const x = isl.x + Math.cos(a) * rr;
        const z = isl.z + Math.sin(a) * rr;
        row.push([x, heightAt(x, z), z]);
      }
      grid.push(row);
    }
    for (let ri = 0; ri < NR; ri++) {
      for (let si = 0; si < NS; si++) {
        const sn = (si + 1) % NS;
        const a = grid[ri][si], b = grid[ri][sn], c = grid[ri + 1][si], d = grid[ri + 1][sn];
        const avg = (a[1] + b[1] + c[1] + d[1]) / 4;
        if (avg < 0.4) continue;
        const col = groundColor(avg, si + ri, hash2(si * 3.1 + ri, isl.seed));
        tri(faces, a, b, c, col);
        tri(faces, b, d, c, col);
      }
    }
  }
  return faces;
}

function buildRunway(faces, facesProps) {
  const y = RUNWAY.y;
  const z0 = RUNWAY.z - RUNWAY.len / 2, z1 = RUNWAY.z + RUNWAY.len / 2;
  const hw = RUNWAY.width / 2;
  quad(faces, [-hw, y, z0], [hw, y, z0], [hw, y, z1], [-hw, y, z1], rgbOf('#4a4f55'));
  quad(faces, [-hw + 1.2, y + 0.03, z0 + 4], [-hw + 2.4, y + 0.03, z0 + 4], [-hw + 2.4, y + 0.03, z1 - 4], [-hw + 1.2, y + 0.03, z1 - 4], rgbOf('#d8d8d2'));
  quad(faces, [hw - 2.4, y + 0.03, z0 + 4], [hw - 1.2, y + 0.03, z0 + 4], [hw - 1.2, y + 0.03, z1 - 4], [hw - 2.4, y + 0.03, z1 - 4], rgbOf('#d8d8d2'));
  for (let z = z0 + 60; z < z1 - 60; z += 64) {
    quad(faces, [-0.7, y + 0.03, z], [0.7, y + 0.03, z], [0.7, y + 0.03, z + 26], [-0.7, y + 0.03, z + 26], [226, 228, 220]);
  }
  for (const zt of [z0 + 26, z1 - 46]) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const x = i * 5.6;
      quad(faces, [x - 1.5, y + 0.04, zt], [x + 1.5, y + 0.04, zt], [x + 1.5, y + 0.04, zt + 14], [x - 1.5, y + 0.04, zt + 14], [230, 232, 225]);
    }
  }
  paintDigit(faces, '3', -9, z0 + 82, 15, false);
  paintDigit(faces, '6', 9, z0 + 82, 15, false);
  paintDigit(faces, '1', -9, z1 - 98, 15, true);
  paintDigit(faces, '8', 9, z1 - 98, 15, true);
  // aiming point blocks and the simple approach lighting before the threshold
  for (const s of [-1, 1]) {
    quad(faces, [s * 3 + (s > 0 ? 1 : -1), y + 0.05, z0 + 290], [s * 3 + (s > 0 ? 9 : -9), y + 0.05, z0 + 290], [s * 3 + (s > 0 ? 9 : -9), y + 0.05, z0 + 335], [s * 3 + (s > 0 ? 1 : -1), y + 0.05, z0 + 335], [232, 234, 226]);
  }
  for (let i = 0; i < 4; i++) {
    const zz = z0 - 40 - i * 42;
    quad(faces, [-26, y + 0.06, zz], [26, y + 0.06, zz], [26, y + 0.06, zz + 4], [-26, y + 0.06, zz + 4], [240, 242, 236]);
  }
  quad(faces, [42, y - 0.15, -430], [170, y - 0.15, -430], [170, y - 0.15, -640], [42, y - 0.15, -640], rgbOf('#4a4e52'));
  quad(faces, [hw, y - 0.2, -470], [42, y - 0.2, -470], [42, y - 0.2, -500], [hw, y - 0.2, -500], rgbOf('#4a4e52'));
  box(facesProps, 128, y + 8, -570, 46, 15, 34, rgbOf('#cfc7b4'));
  box(facesProps, 128, y + 16.4, -570, 50, 1.8, 38, rgbOf('#b04a3a'));
  box(facesProps, 78, y + 6, -472, 22, 12, 18, rgbOf('#c9c3b2'));
  box(facesProps, -176, y + 13, -430, 5.6, 26, 5.6, rgbOf('#d3cdbd'));
  box(facesProps, -176, y + 27.5, -430, 10, 5, 10, rgbOf('#2c4657'));
}

function buildProps(faces) {
  const taken = (x, z) => Math.abs(x - RUNWAY.x) < 230 && Math.abs(z - RUNWAY.z) < 660;
  let n = 0;
  for (let i = 0; i < 240 && n < 46; i++) {
    const isl = ISLANDS[(i * 7 + 1) % ISLANDS.length];
    const a = hash2(i * 2.3, 11.7) * Math.PI * 2;
    const rr = isl.r * (0.2 + 0.62 * hash2(i * 5.1, 3.3));
    const x = isl.x + Math.cos(a) * rr;
    const z = isl.z + Math.sin(a) * rr;
    const h = heightAt(x, z);
    if (h < 8 || h > 240 || taken(x, z)) continue;
    tree(faces, x, z, 0.8 + hash2(i, 9.1) * 0.9);
    n++;
  }
}

function buildRings() {
  return RINGS.map((r) => {
    const n = norm3(r.n);
    const right = norm3([n[2], 0, -n[0]]);
    const up = norm3([
      n[1] * right[2] - n[2] * right[1],
      n[2] * right[0] - n[0] * right[2],
      n[0] * right[1] - n[1] * right[0],
    ]);
    const inner = RING_RADIUS - 9, outer = RING_RADIUS;
    const faces = [];
    const S = 18;
    for (let i = 0; i < S; i++) {
      const a0 = (i / S) * Math.PI * 2, a1 = ((i + 1) / S) * Math.PI * 2;
      const p = (rad, a) => [
        r.p[0] + right[0] * Math.cos(a) * rad + up[0] * Math.sin(a) * rad,
        r.p[1] + right[1] * Math.cos(a) * rad + up[1] * Math.sin(a) * rad,
        r.p[2] + right[2] * Math.cos(a) * rad + up[2] * Math.sin(a) * rad,
      ];
      faces.push([p(inner, a0), p(outer, a0), p(outer, a1), p(inner, a1)]);
    }
    return { p: r.p, n, right, up, faces, radius: RING_RADIUS };
  });
}

function buildDropZone() {
  const ground = heightAt(DROP_ZONE.x, DROP_ZONE.z);
  const faces = [];
  const S = 22;
  for (let i = 0; i < S; i++) {
    const a0 = (i / S) * Math.PI * 2, a1 = ((i + 1) / S) * Math.PI * 2;
    const p = (rad, a) => [DROP_ZONE.x + Math.cos(a) * rad, ground + 1.4, DROP_ZONE.z + Math.sin(a) * rad];
    faces.push([p(DROP_ZONE.r - 16, a0), p(DROP_ZONE.r, a0), p(DROP_ZONE.r, a1), p(DROP_ZONE.r - 16, a1)]);
  }
  return { ...DROP_ZONE, y: ground, faces };
}

export function buildWorld() {
  const terrain = buildTerrain();
  const runway = [];
  const buildings = [];
  buildRunway(runway, buildings);
  buildProps(terrain);
  terrain.push(...buildings);
  return {
    terrain,
    runway,
    rings: buildRings(),
    zone: buildDropZone(),
    heightAt,
    runwayAt,
    glints(camPos, time) {
      const az = Math.atan2(SUN[0], SUN[2]);
      const out = [];
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const dist = 260 + t * t * 6800;
        const spread = 40 + t * 760;
        const x = camPos[0] + Math.sin(az) * dist + Math.sin(i * 7.3 + time * 0.2) * spread;
        const z = camPos[2] + Math.cos(az) * dist + Math.cos(i * 4.9 + time * 0.17) * spread;
        const sz = 3 + t * 26;
        const a = 0.10 + 0.26 * Math.abs(Math.sin(time * 0.9 + i * 2.7)) * (1 - t * 0.55);
        out.push({
          pts: [[x - sz, 0.2, z - sz], [x + sz, 0.2, z - sz], [x + sz, 0.2, z + sz], [x - sz, 0.2, z + sz]],
          color: [255, 238, 196],
          alpha: a,
        });
      }
      return out;
    },
  };
}
