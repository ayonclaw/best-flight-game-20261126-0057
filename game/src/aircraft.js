// aircraft.js — the player's Kestrel: a low-poly airframe built from local triangles, transformed
// into the scene with its propeller disc spinning; also patrol traffic and the supply crate.
import { rgbOf, shade, norm3, dot3 } from './render3d.js';
import { SUN } from './world.js';

const BODY = rgbOf('#c8493b');
const BODY_DARK = rgbOf('#a33a30');
const CREAM = rgbOf('#ece2cd');
const GLASS = rgbOf('#24384a');
const METAL = rgbOf('#b9b4a6');
const RUBBER = rgbOf('#23272c');
const RED_TIP = rgbOf('#8f2f26');

function addFace(list, pts, color, opts = {}) {
  list.push({ pts, color, ...opts });
}

function addBox(list, cx, cy, cz, sx, sy, sz, color) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
  addFace(list, [v[4], v[5], v[6], v[7]], color);
  addFace(list, [v[0], v[1], v[2], v[3]], shade(color, 0.8));
  addFace(list, [v[0], v[1], v[5], v[4]], shade(color, 0.92));
  addFace(list, [v[1], v[2], v[6], v[5]], shade(color, 0.96));
  addFace(list, [v[2], v[3], v[7], v[6]], shade(color, 0.86));
  addFace(list, [v[3], v[0], v[4], v[7]], shade(color, 0.88));
}

function addSlab(list, plan, y0, y1, color) {
  // plan: four [x,z] corners; extruded between y0 and y1.
  const top = plan.map((p) => [p[0], y1, p[1]]);
  const bot = plan.map((p) => [p[0], y0, p[1]]);
  addFace(list, top, color);
  addFace(list, [...bot].reverse(), shade(color, 0.72));
  for (let i = 0; i < plan.length; i++) {
    const j = (i + 1) % plan.length;
    addFace(list, [bot[i], bot[j], top[j], top[i]], shade(color, 0.86));
  }
}

function buildAirframe(livery) {
  const faces = [];
  const rings = [
    [-4.55, 0.09, 0.12], [-3.5, 0.36, 0.34], [-2.1, 0.54, 0.5],
    [0.0, 0.66, 0.62], [2.0, 0.62, 0.58], [3.35, 0.4, 0.4],
  ];
  for (let r = 0; r < rings.length - 1; r++) {
    const [z0, w0, h0] = rings[r];
    const [z1, w1, h1] = rings[r + 1];
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
      const p0 = [Math.cos(a0) * w0, Math.sin(a0) * h0, z0];
      const p1 = [Math.cos(a1) * w0, Math.sin(a1) * h0, z0];
      const q0 = [Math.cos(a0) * w1, Math.sin(a0) * h1, z1];
      const q1 = [Math.cos(a1) * w1, Math.sin(a1) * h1, z1];
      addFace(faces, [p0, p1, q1, q0], r === 0 ? BODY_DARK : livery.body);
    }
  }
  // nose cone and tail cap
  const nose = [0, 0.02, 4.55];
  const last = rings[rings.length - 1];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    addFace(faces, [
      [Math.cos(a0) * last[1], Math.sin(a0) * last[2], last[0]],
      [Math.cos(a1) * last[1], Math.sin(a1) * last[2], last[0]],
      nose,
    ], livery.nose);
  }
  const first = rings[0];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    addFace(faces, [
      [0, 0, -4.6],
      [Math.cos(a0) * first[1], Math.sin(a0) * first[2], first[0]],
      [Math.cos(a1) * first[1], Math.sin(a1) * first[2], first[0]],
    ], BODY_DARK);
  }
  // wings, swept and tapered, with red tips
  for (const s of [1, -1]) {
    addSlab(faces, [
      [0.55 * s, 1.05], [5.65 * s, -0.35], [5.65 * s, -1.15], [0.55 * s, -0.55],
    ], 0.02, 0.17, livery.wing);
    addSlab(faces, [
      [4.65 * s, -0.16], [5.65 * s, -0.35], [5.65 * s, -1.15], [4.65 * s, -0.92],
    ], 0.175, 0.2, livery.tip);
    addFace(faces, [[5.6 * s, 0.03, 0.15], [5.6 * s, 0.03, -0.4], [5.62 * s, 0.22, -0.4], [5.62 * s, 0.22, 0.15]], [235, 72, 58]);
    addFace(faces, [[5.6 * s, 0.03, -0.75], [5.6 * s, 0.03, -1.25], [5.62 * s, 0.22, -1.25], [5.62 * s, 0.22, -0.75]], [82, 220, 138]);
  }
  // horizontal stabiliser
  for (const s of [1, -1]) {
    addSlab(faces, [[0.1 * s, -3.55], [2.35 * s, -4.1], [2.35 * s, -4.6], [0.1 * s, -4.35]], 1.62, 1.74, livery.wing);
  }
  // fin
  addFace(faces, [[0.05, 0.55, -4.4], [0.05, 2.05, -4.15], [0.05, 2.05, -3.35], [0.05, 0.55, -2.95]], livery.tip);
  addFace(faces, [[-0.05, 0.55, -4.4], [-0.05, 2.05, -4.15], [-0.05, 2.05, -3.35], [-0.05, 0.55, -2.95]], livery.tip);
  addFace(faces, [[0.05, 2.05, -4.15], [-0.05, 2.05, -4.15], [-0.05, 2.05, -3.35], [0.05, 2.05, -3.35]], shade(livery.tip, 1.2));
  addFace(faces, [[0.05, 2.05, -3.35], [-0.05, 2.05, -3.35], [-0.05, 0.55, -2.95], [0.05, 0.55, -2.95]], livery.tip);
  // canopy and cowling
  addFace(faces, [[-0.42, 0.55, 1.55], [0.42, 0.55, 1.55], [0.34, 0.94, 1.05], [-0.34, 0.94, 1.05]], GLASS);
  addFace(faces, [[-0.34, 0.94, 1.05], [0.34, 0.94, 1.05], [0.3, 0.92, -0.25], [-0.3, 0.92, -0.25]], GLASS);
  addFace(faces, [[-0.42, 0.55, 1.55], [-0.34, 0.94, 1.05], [-0.3, 0.92, -0.25], [-0.4, 0.55, -0.2]], shade(GLASS, 0.8));
  addFace(faces, [[0.42, 0.55, 1.55], [0.34, 0.94, 1.05], [0.3, 0.92, -0.25], [0.4, 0.55, -0.2]], shade(GLASS, 0.8));
  // spinner
  addFace(faces, [[0.2, 0.18, 3.35], [-0.2, 0.18, 3.35], [0, 0.02, 4.55]], METAL);
  addFace(faces, [[-0.2, -0.18, 3.35], [0.2, -0.18, 3.35], [0, 0.02, 4.55]], METAL);
  addFace(faces, [[0.2, 0.18, 3.35], [0.2, -0.18, 3.35], [0, 0.02, 4.55]], shade(METAL, 0.85));
  addFace(faces, [[-0.2, 0.18, 3.35], [-0.2, -0.18, 3.35], [0, 0.02, 4.55]], shade(METAL, 0.85));
  return faces;
}

function buildGear() {
  const faces = [];
  for (const s of [1, -1]) {
    addBox(faces, 1.35 * s, -0.55, 0.1, 0.12, 1.1, 0.12, METAL);
    addBox(faces, 1.35 * s, -1.08, 0.1, 0.16, 0.44, 0.44, RUBBER);
    addFace(faces, [[1.1 * s, -0.1, 0.7], [1.6 * s, -0.1, 0.7], [1.6 * s, -0.1, 0.4], [1.1 * s, -0.1, 0.4]], BODY_DARK);
  }
  addBox(faces, 0, -0.5, 3.2, 0.1, 0.75, 0.1, METAL);
  addBox(faces, 0, -0.9, 3.2, 0.14, 0.36, 0.36, RUBBER);
  return faces;
}

const LIVERY = {
  player: { body: BODY, wing: CREAM, tip: RED_TIP, nose: BODY_DARK },
  patrol: { body: rgbOf('#3f7f83'), wing: rgbOf('#dfe4d8'), tip: rgbOf('#245a5e'), nose: rgbOf('#245a5e') },
};

export function buildAircraft(kind = 'player') {
  return {
    faces: buildAirframe(LIVERY[kind] || LIVERY.player),
    gear: buildGear(),
    radius: 6,
  };
}

const _t = (pos, right, up, fwd, p) => [
  pos[0] + right[0] * p[0] + up[0] * p[1] + fwd[0] * p[2],
  pos[1] + right[1] * p[0] + up[1] * p[1] + fwd[1] * p[2],
  pos[2] + right[2] * p[0] + up[2] * p[1] + fwd[2] * p[2],
];

export function drawAircraft(scene, model, pos, yaw, pitch, roll, time, opts = {}) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fwd = [sy * cp, sp, cy * cp];
  const rx = cy, rz = -sy;
  const ux = -sy * sp, uy = cp, uz = -cy * sp;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const right = [rx * cr - ux * sr, -uy * sr, rz * cr - uz * sr];
  const up = [ux * cr + rx * sr, uy * cr, uz * cr + rz * sr];
  const scale = opts.scale || 1;
  const place = (p) => _t(
    pos, right.map((v) => v * scale), up.map((v) => v * scale), fwd.map((v) => v * scale), p,
  );
  const push = (faces) => {
    for (const f of faces) {
      const w = f.pts.map(place);
      const n = norm3([
        (w[1][1] - w[0][1]) * (w[2][2] - w[0][2]) - (w[1][2] - w[0][2]) * (w[2][1] - w[0][1]),
        (w[1][2] - w[0][2]) * (w[2][0] - w[0][0]) - (w[1][0] - w[0][0]) * (w[2][2] - w[0][2]),
        (w[1][0] - w[0][0]) * (w[2][1] - w[0][1]) - (w[1][1] - w[0][1]) * (w[2][0] - w[0][0]),
      ]);
      const lit = 0.58 + 0.5 * Math.abs(dot3(n, SUN));
      scene.add(w, shade(f.color, lit));
    }
  };
  push(model.faces);
  if (opts.gear) push(model.gear);

  // propeller: translucent disc plus two blades spinning about z
  const discR = 1.18;
  const disc = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    disc.push(place([Math.cos(a) * discR, Math.sin(a) * discR, 4.62]));
  }
  scene.add(disc, [214, 218, 214], { alpha: 0.17, fog: false });
  const ang = (time || 0) * 46;
  for (const off of [0, Math.PI / 2]) {
    const a = ang + off;
    const tip = [Math.cos(a) * discR, Math.sin(a) * discR, 4.62];
    const nxp = [-Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0];
    scene.add([
      place([nxp[0], nxp[1], 4.62]), place([-nxp[0], -nxp[1], 4.62]),
      place([tip[0] - nxp[0], tip[1] - nxp[1], 4.62]), place([tip[0] + nxp[0], tip[1] + nxp[1], 4.62]),
    ], [226, 226, 218], { fog: false });
  }
}

export function drawCrate(scene, pos, chute, time) {
  const s = 1.4;
  const v = [
    [pos[0] - s, pos[1] - s, pos[2] - s], [pos[0] + s, pos[1] - s, pos[2] - s],
    [pos[0] + s, pos[1] - s, pos[2] + s], [pos[0] - s, pos[1] - s, pos[2] + s],
    [pos[0] - s, pos[1] + s, pos[2] - s], [pos[0] + s, pos[1] + s, pos[2] - s],
    [pos[0] + s, pos[1] + s, pos[2] + s], [pos[0] - s, pos[1] + s, pos[2] + s],
  ];
  scene.add([v[4], v[5], v[6], v[7]], [198, 132, 54]);
  scene.add([v[0], v[1], v[2], v[3]], [150, 98, 40]);
  scene.add([v[0], v[1], v[5], v[4]], [178, 116, 46]);
  scene.add([v[2], v[3], v[7], v[6]], [178, 116, 46]);
  if (chute) {
    const r = 4.2, y = pos[1] + 9;
    const ring = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ring.push([pos[0] + Math.cos(a) * r, y + Math.sin(a) * 1.2, pos[2] + Math.sin(a) * r]);
    }
    scene.add(ring, [230, 88, 66], { alpha: 0.92 });
    const top = [pos[0], y + 4.2, pos[2]];
    for (let i = 0; i < 12; i++) {
      const a0 = ring[i], a1 = ring[(i + 1) % 12];
      scene.add([a0, a1, top], [214, 74, 56], { alpha: 0.95 });
      scene.add([a0, [pos[0], pos[1] + 1.5, pos[2]], a1], [120, 120, 120], { alpha: 0.25, fog: false });
    }
  }
}
