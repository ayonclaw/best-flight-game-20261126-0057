// instruments.js — the individual flight instruments drawn on the panel: the compass strip with
// its target bug, the speed and altitude tapes, the artificial horizon and the engine bars.

const AMBER = '#ffd08a';
const AMBER_DIM = 'rgba(255,208,138,0.42)';
const CYAN = '#93e8ff';
const RED = '#ff7566';
const PANEL = 'rgba(5,13,19,0.62)';
const EDGE = 'rgba(255,214,150,0.22)';

export function panel(ctx, x, y, w, h, r = 5) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function text(ctx, str, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = weight + ' ' + size + 'px "Consolas","SF Mono",Menlo,monospace';
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export function compassCard(ctx, w, s, hdg, bug) {
  const bw = Math.min(560 * s, w * 0.5);
  const x = w / 2 - bw / 2, y = 22 * s, bh = 40 * s;
  panel(ctx, x, y, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 6, y + 2, bw - 12, bh - 4);
  ctx.clip();
  const ppd = bw / 90;
  const cx = w / 2;
  for (let d = Math.floor(hdg - 50); d <= hdg + 50; d++) {
    if (d % 5 !== 0) continue;
    const px = cx + (d - hdg) * ppd;
    const major = ((d % 30) + 30) % 30 === 0;
    ctx.strokeStyle = major ? AMBER : AMBER_DIM;
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(px, y + bh - (major ? 14 * s : 8 * s));
    ctx.lineTo(px, y + bh - 3);
    ctx.stroke();
    if (major) {
      const dd = ((d % 360) + 360) % 360;
      const label = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd).padStart(3, '0');
      text(ctx, label, px, y + 13 * s, (dd % 90 === 0 ? 13 : 11) * s, dd % 90 === 0 ? AMBER : AMBER_DIM, 'center', 700);
    }
  }
  if (bug !== null) {
    const rel = ((bug - hdg + 540) % 360) - 180;
    if (Math.abs(rel) < 46) {
      const px = cx + rel * ppd;
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.moveTo(px, y + 5 * s);
      ctx.lineTo(px - 5 * s, y - 4 * s);
      ctx.lineTo(px + 5 * s, y - 4 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx, y + bh - 1);
  ctx.lineTo(cx - 5 * s, y + bh + 7 * s);
  ctx.lineTo(cx + 5 * s, y + bh + 7 * s);
  ctx.closePath();
  ctx.fill();
  text(ctx, 'HDG ' + String(Math.round(hdg) % 360).padStart(3, '0'), w / 2, y + bh + 20 * s, 12 * s, AMBER, 'center', 700);
}

export function speedTape(ctx, x, cy, s, kt, stallKt) {
  const tw = 82 * s, th = 296 * s;
  const y = cy - th / 2;
  panel(ctx, x, y, tw, th);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + 14 * s, tw, th - 28 * s);
  ctx.clip();
  const ppk = th / 130;
  for (let k = Math.floor((kt - 70) / 10) * 10; k <= kt + 70; k += 10) {
    if (k < 0) continue;
    const py = cy - (k - kt) * ppk;
    const major = k % 50 === 0;
    ctx.strokeStyle = major ? AMBER : AMBER_DIM;
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x + tw - (major ? 22 : 12) * s, py);
    ctx.lineTo(x + tw - 6 * s, py);
    ctx.stroke();
    if (major) text(ctx, String(k), x + 8 * s, py, 11 * s, AMBER, 'left');
  }
  const sy = cy - (stallKt - kt) * ppk;
  ctx.fillStyle = 'rgba(255,90,72,0.35)';
  ctx.fillRect(x + tw - 8 * s, sy, 8 * s, th);
  ctx.restore();
  ctx.fillStyle = 'rgba(5,13,19,0.9)';
  ctx.fillRect(x + 4 * s, cy - 17 * s, tw - 8 * s, 34 * s);
  ctx.strokeStyle = AMBER;
  ctx.strokeRect(x + 4 * s, cy - 17 * s, tw - 8 * s, 34 * s);
  text(ctx, String(Math.round(kt)).padStart(3, '0'), x + tw / 2, cy - 2 * s, 20 * s, AMBER, 'center', 700);
  text(ctx, 'KT', x + tw / 2, cy + 11 * s, 9 * s, AMBER_DIM, 'center');
  text(ctx, 'SPD', x + tw / 2, y + 9 * s, 9 * s, AMBER_DIM, 'center', 700);
}

export function altTape(ctx, x, cy, s, ft, aglFt, vsFpm) {
  const tw = 96 * s, th = 296 * s;
  const y = cy - th / 2;
  panel(ctx, x, y, tw, th);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + 14 * s, tw, th - 28 * s);
  ctx.clip();
  const ppf = th / 1800;
  for (let f = Math.floor((ft - 900) / 200) * 200; f <= ft + 900; f += 200) {
    const py = cy - (f - ft) * ppf;
    const major = f % 1000 === 0;
    ctx.strokeStyle = major ? AMBER : AMBER_DIM;
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 6 * s, py);
    ctx.lineTo(x + (major ? 24 : 14) * s, py);
    ctx.stroke();
    if (major) text(ctx, String(f / 100), x + tw - 8 * s, py, 11 * s, AMBER, 'right');
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(5,13,19,0.9)';
  ctx.fillRect(x + 4 * s, cy - 17 * s, tw - 8 * s, 34 * s);
  ctx.strokeStyle = AMBER;
  ctx.strokeRect(x + 4 * s, cy - 17 * s, tw - 8 * s, 34 * s);
  text(ctx, String(Math.round(ft)).padStart(5, '0'), x + tw / 2, cy - 2 * s, 19 * s, AMBER, 'center', 700);
  text(ctx, 'FT', x + tw / 2, cy + 11 * s, 9 * s, AMBER_DIM, 'center');
  text(ctx, 'ALT', x + tw / 2, y + 9 * s, 9 * s, AMBER_DIM, 'center', 700);
  text(ctx, 'AGL ' + Math.max(0, Math.round(aglFt)), x + tw / 2, y + th + 12 * s, 9 * s, AMBER_DIM, 'center');
  text(ctx, (vsFpm >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(vsFpm / 10) * 10) + ' FPM', x + tw / 2, y + th + 26 * s, 9 * s, vsFpm < -1200 ? RED : AMBER_DIM, 'center');
}

export function horizon(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  const shift = Math.max(-r * 1.6, Math.min(r * 1.6, pitch * 210));
  const sky = ctx.createLinearGradient(0, -r * 2 + shift, 0, shift);
  sky.addColorStop(0, '#1e5f86');
  sky.addColorStop(1, '#79b3c9');
  ctx.fillStyle = sky;
  ctx.fillRect(-r * 2.2, -r * 3 + shift, r * 4.4, r * 3);
  ctx.fillStyle = '#6f5a3c';
  ctx.fillRect(-r * 2.2, shift, r * 4.4, r * 3);
  ctx.fillStyle = 'rgba(255,235,200,0.9)';
  ctx.fillRect(-r * 2.2, shift - 1, r * 4.4, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let p = -40; p <= 40; p += 10) {
    if (p === 0) continue;
    const py = shift + p * (210 / 57.3);
    if (Math.abs(py) > r * 1.7) continue;
    const wl = p % 20 === 0 ? r * 0.42 : r * 0.24;
    ctx.strokeStyle = 'rgba(255,245,225,0.82)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-wl, py);
    ctx.lineTo(-wl * 0.35, py);
    ctx.moveTo(wl * 0.35, py);
    ctx.lineTo(wl, py);
    ctx.stroke();
    if (p % 20 === 0) {
      ctx.font = '600 9px "Consolas",monospace';
      ctx.fillStyle = 'rgba(255,245,225,0.85)';
      ctx.fillText(String(Math.abs(p)), -wl - 10, py);
      ctx.fillText(String(Math.abs(p)), wl + 10, py);
    }
  }
  ctx.restore();

  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 1;
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const ang = (a * Math.PI) / 180;
    const r0 = r + 5, r1 = r + (a % 30 === 0 ? 15 : 9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(ang) * r0, cy - Math.cos(ang) * r0);
    ctx.lineTo(cx + Math.sin(ang) * r1, cy - Math.cos(ang) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx + Math.sin(roll) * (r + 6), cy - Math.cos(roll) * (r + 6));
  ctx.lineTo(cx + Math.sin(roll - 0.09) * (r + 16), cy - Math.cos(roll - 0.09) * (r + 16));
  ctx.lineTo(cx + Math.sin(roll + 0.09) * (r + 16), cy - Math.cos(roll + 0.09) * (r + 16));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx - r * 0.16, cy);
  ctx.lineTo(cx - r * 0.08, cy + 6);
  ctx.moveTo(cx + r * 0.5, cy);
  ctx.lineTo(cx + r * 0.16, cy);
  ctx.lineTo(cx + r * 0.08, cy + 6);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function bar(ctx, x, y, s, label, value, color, readout) {
  text(ctx, label, x, y, 9 * s, AMBER_DIM, 'left', 700);
  text(ctx, readout, x + 190 * s, y, 10 * s, color, 'right', 700);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(x, y + 8 * s, 190 * s, 7 * s);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 8 * s, 190 * s * Math.max(0, Math.min(1, value)), 7 * s);
  for (let i = 1; i < 10; i++) {
    ctx.fillStyle = 'rgba(5,13,19,0.55)';
    ctx.fillRect(x + (190 * s * i) / 10, y + 8 * s, 1, 7 * s);
  }
}
