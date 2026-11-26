// render3d.js — a tiny software 3D pipeline: camera basis, near-plane clipping, painter-sorted
// flat polygon fill with distance haze, and the sky and sea backdrop. Canvas 2D, no libraries.

export const NEAR = 0.5;
const HAZE = [177, 201, 220];

export function rgbOf(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function shade(c, k) {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function css(c, a = 1) {
  return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
}

export function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// A camera is an eye position plus an orthonormal basis; roll is baked into right/up.
export function makeCamera(pos, yaw, pitch, roll, fovDeg = 64) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fwd = [sy * cp, sp, cy * cp];
  const rx = cy, rz = -sy;
  const ux = -sy * sp, uy = cp, uz = -cy * sp;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return {
    pos,
    fwd,
    right: [rx * cr + ux * sr, uy * sr, rz * cr + uz * sr],
    up: [ux * cr - rx * sr, uy * cr, uz * cr - rz * sr],
    fov: (fovDeg * Math.PI) / 180,
    roll,
    pitch,
  };
}

export function camSpace(cam, p) {
  const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
  return {
    x: dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2],
    y: dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2],
    z: dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2],
  };
}

export function focalFor(cam, h) {
  return (h * 0.5) / Math.tan(cam.fov * 0.5);
}

export function project(cs, w, h, f) {
  return [w * 0.5 + (cs.x / cs.z) * f, h * 0.5 - (cs.y / cs.z) * f];
}

// Sutherland-Hodgman clip of a camera-space polygon against z = NEAR.
function clipNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ain = a.z >= NEAR, bin = b.z >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  return out;
}

// Collects flat polygons in world space, then draws them far-to-near with haze.
export class Scene {
  constructor() {
    this.faces = [];
  }
  add(pts, color, opts = {}) {
    this.faces.push({ pts, color, opts });
  }
  clear() {
    this.faces.length = 0;
  }
  flush(ctx, cam, w, h, far = 16000) {
    const f = focalFor(cam, h);
    const ready = [];
    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];
      const pts = face.pts;
      const o = face.opts;
      let depth = 0, behind = 0;
      const cs = [];
      for (let j = 0; j < pts.length; j++) {
        const c = camSpace(cam, pts[j]);
        cs.push(c);
        depth += c.z;
        if (c.z < NEAR) behind++;
      }
      if (behind === pts.length) continue;
      depth /= pts.length;
      if (depth > far || (o.maxDist && depth > o.maxDist)) continue;
      if (o.normal && dot3(o.normal, [cam.pos[0] - pts[0][0], cam.pos[1] - pts[0][1], cam.pos[2] - pts[0][2]]) <= 0) continue;
      const poly = behind > 0 ? clipNear(cs) : cs;
      if (poly.length < 3) continue;
      const scr = new Array(poly.length);
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let j = 0; j < poly.length; j++) {
        const p = project(poly[j], w, h, f);
        scr[j] = p;
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      if (maxX < 0 || minX > w || maxY < 0 || minY > h) continue;
      let area = 0;
      for (let j = 0; j < scr.length; j++) {
        const k = (j + 1) % scr.length;
        area += scr[j][0] * scr[k][1] - scr[k][0] * scr[j][1];
      }
      if (Math.abs(area) < 7) continue;
      const fog = o.fog === false ? 0 : 0.9 * (1 - Math.exp(-depth / 5200));
      ready.push({ depth: depth - (o.bias || 0), scr, col: fog > 0.01 ? mix(face.color, HAZE, fog) : face.color, o });
    }
    ready.sort((a, b) => (a.o.layer || 0) - (b.o.layer || 0) || b.depth - a.depth);
    for (let i = 0; i < ready.length; i++) {
      const r = ready[i], o = r.o;
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      ctx.fillStyle = o.flat ? o.fill : css(r.col);
      ctx.beginPath();
      ctx.moveTo(r.scr[0][0], r.scr[0][1]);
      for (let j = 1; j < r.scr.length; j++) ctx.lineTo(r.scr[j][0], r.scr[j][1]);
      ctx.closePath();
      if (o.glow) {
        ctx.shadowColor = o.glow;
        ctx.shadowBlur = o.glowSize || 14;
      }
      ctx.fill();
      if (o.edge) {
        ctx.strokeStyle = css(r.col, 0.55);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.strokeWidth || 1.6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// Sky: vertical gradient anchored on the projected horizon, with sun disc and warm haze.
export function drawSky(ctx, w, h, cam, sun) {
  const f = focalFor(cam, h);
  const hy = h * 0.5 + Math.tan(cam.pitch) * f;
  const top = hy - h * 1.25;
  const g = ctx.createLinearGradient(0, top, 0, hy + 2);
  g.addColorStop(0, '#122f5c');
  g.addColorStop(0.34, '#356592');
  g.addColorStop(0.68, '#7ba6c4');
  g.addColorStop(0.9, '#b9d2e1');
  g.addColorStop(1, '#e0e9ec');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sx = dot3(sun, cam.right), sy = dot3(sun, cam.up), sz = dot3(sun, cam.fwd);
  if (sz > 0.1) {
    const px = w * 0.5 + (sx / sz) * f;
    const py = h * 0.5 - (sy / sz) * f;
    const glow = ctx.createRadialGradient(px, py, 4, px, py, 120);
    glow.addColorStop(0, 'rgba(255,244,214,0.95)');
    glow.addColorStop(0.18, 'rgba(255,228,168,0.55)');
    glow.addColorStop(1, 'rgba(255,225,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Sea: a deep gradient below the tilted horizon, with a pale haze band on the waterline.
export function drawSea(ctx, w, h, cam) {
  const f = focalFor(cam, h);
  const hy = h * 0.5 + Math.tan(cam.pitch) * f;
  ctx.save();
  ctx.translate(w * 0.5, hy);
  ctx.rotate(cam.roll);
  const g = ctx.createLinearGradient(0, 0, 0, h * 2.2);
  g.addColorStop(0, '#8fb6c8');
  g.addColorStop(0.04, '#4f859d');
  g.addColorStop(0.16, '#2f6a88');
  g.addColorStop(0.46, '#1d4f6b');
  g.addColorStop(1, '#0f3247');
  ctx.fillStyle = g;
  ctx.fillRect(-w * 2, 0, w * 4, h * 3.2);
  // wind streaks on the water: short dashes that drift with heading and time
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w * 2, 24, w * 4, h * 3.2);
  ctx.clip();
  const roll = cam.roll;
  const drift = (cam.yaw || 0) * 220 + (cam.pos[2] || 0) * 0.03;
  for (let i = 0; i < 70; i++) {
    const ty = 40 + i * i * 0.34;
    if (ty > h * 1.7) break;
    const len = 14 + ty * 0.18;
    const xx = ((i * 137.5 + drift * (0.4 + i * 0.03)) % (w * 2)) - w;
    const yy = ty + Math.sin(i * 1.9 + (cam.pos[1] || 0) * 0.01) * 6;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(214,235,242,0.16)' : 'rgba(10,32,46,0.20)';
    ctx.fillRect(xx, yy, len * (1 + (i % 4) * 0.3), 1.6 + ty * 0.004);
  }
  ctx.restore();
  const band = ctx.createLinearGradient(0, -26, 0, 34);
  band.addColorStop(0, 'rgba(220,233,240,0)');
  band.addColorStop(0.5, 'rgba(226,238,244,0.6)');
  band.addColorStop(1, 'rgba(220,233,240,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-w * 2, -26, w * 4, 60);
  ctx.restore();
}
