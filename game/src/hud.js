// hud.js — assembles the lit instrument panel: mission card and next-target line, target marker
// projected onto the view, warnings, score, and the cockpit canopy overlay.
import { camSpace, project, focalFor } from './render3d.js';
import { compassCard, speedTape, altTape, horizon, bar, panel, text } from './instruments.js';

const AMBER = '#ffd08a';
const AMBER_DIM = 'rgba(255,208,138,0.42)';
const GREEN = '#9df0af';
const CYAN = '#93e8ff';
const RED = '#ff7566';

const KT = 1.94384;
const FT = 3.28084;
const NM = 1 / 1852;

function deg(r) {
  return ((r * 180) / Math.PI + 360) % 360;
}

function targetMarker(ctx, cam, w, h, target, hdg) {
  if (!target) return;
  const cs = camSpace(cam, target.pos);
  const f = focalFor(cam, h);
  const distM = Math.hypot(target.pos[0] - cam.pos[0], target.pos[1] - cam.pos[1], target.pos[2] - cam.pos[2]);
  const dist = distM * NM;
  const bearing = deg(Math.atan2(target.pos[0] - cam.pos[0], target.pos[2] - cam.pos[2]));
  if (cs.z > 1) {
    const [px, py] = project(cs, w, h, f);
    if (px > 40 && px < w - 40 && py > 70 && py < h - 40) {
      const r = 22;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - r - 8, py);
      ctx.lineTo(px - r - 2, py);
      ctx.moveTo(px + r + 2, py);
      ctx.lineTo(px + r + 8, py);
      ctx.stroke();
      text(ctx, target.label, px, py - r - 14, 11, CYAN, 'center', 700);
      text(ctx, dist.toFixed(dist < 1 ? 2 : 1) + ' NM  ' + String(Math.round(bearing)).padStart(3, '0') + '°', px, py + r + 14, 10, 'rgba(147,232,255,0.8)', 'center');
      return;
    }
  }
  const rel = ((bearing - hdg + 540) % 360) - 180;
  const px = w / 2 + Math.sign(rel) * Math.min(w * 0.42, Math.min(w, h) * 0.3 + Math.abs(rel) * 3);
  const py = h * 0.56;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((rel * Math.PI) / 180);
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, target.label + ' ' + dist.toFixed(1) + ' NM', px, py + 20, 10, CYAN, 'center', 700);
}

function missionCard(ctx, x, y, s, game) {
  const m = game.missions;
  const wCard = 378 * s, hCard = 96 * s;
  panel(ctx, x, y, wCard, hCard);
  text(ctx, 'MISSION ' + (m.index + 1) + '/3  ·  ' + m.def.name, x + 12 * s, y + 17 * s, 13 * s, AMBER, 'left', 700);
  text(ctx, m.complete ? (m.toast || 'COMPLETE') : m.def.brief, x + 12 * s, y + 36 * s, 9 * s, AMBER_DIM, 'left', 600);
  const t = m.target;
  const dx = t.pos[0] - game.flight.pos[0], dz = t.pos[2] - game.flight.pos[2];
  const dist = Math.hypot(dx, dz) * NM;
  const bearing = deg(Math.atan2(dx, dz));
  const rel = ((bearing - deg(game.flight.yaw) + 540) % 360) - 180;
  text(ctx, 'NEXT ' + t.label, x + 12 * s, y + 62 * s, 11 * s, GREEN, 'left', 700);
  text(ctx, dist.toFixed(1) + ' NM   ' + String(Math.round(bearing)).padStart(3, '0') + '°', x + 150 * s, y + 62 * s, 11 * s, GREEN, 'left', 600);
  const ax = x + 336 * s, ay = y + 62 * s;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate((rel * Math.PI) / 180);
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s);
  ctx.lineTo(7 * s, 7 * s);
  ctx.lineTo(0, 3 * s);
  ctx.lineTo(-7 * s, 7 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const clock = Math.max(0, m.timeLeft);
  text(ctx, String(Math.floor(clock / 60)).padStart(2, '0') + ':' + String(Math.floor(clock % 60)).padStart(2, '0'), x + wCard - 12 * s, y + 17 * s, 14 * s, clock < 20 ? RED : AMBER, 'right', 700);
  if (m.def.kind === 'rings') {
    for (let i = 0; i < 6; i++) {
      const px = x + 12 * s + i * 16 * s;
      ctx.beginPath();
      ctx.arc(px, y + 80 * s, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = i < m.ringIdx ? GREEN : i === m.ringIdx ? CYAN : 'rgba(255,255,255,0.16)';
      ctx.fill();
    }
  } else if (m.def.kind === 'supply') {
    text(ctx, m.hint(game.flight), x + 12 * s, y + 81 * s, 9 * s, CYAN, 'left', 600);
  } else {
    text(ctx, game.flight.gear ? 'GEAR DOWN' : 'GEAR UP — EXTEND WITH G', x + 12 * s, y + 81 * s, 9 * s, game.flight.gear ? GREEN : RED, 'left', 600);
  }
}

function cockpitFrame(ctx, w, h) {
  const red = '#8f382e', redDark = '#6f2b24';
  ctx.fillStyle = redDark;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.9);
  ctx.lineTo(w * 0.2, h * 0.955);
  ctx.lineTo(w * 0.27, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, h);
  ctx.lineTo(w, h * 0.9);
  ctx.lineTo(w * 0.8, h * 0.955);
  ctx.lineTo(w * 0.73, h);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, h * 0.9, 0, h);
  g.addColorStop(0, red);
  g.addColorStop(1, redDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h);
  ctx.quadraticCurveTo(w * 0.36, h * 0.945, w * 0.42, h * 0.945);
  ctx.lineTo(w * 0.58, h * 0.945);
  ctx.quadraticCurveTo(w * 0.64, h * 0.945, w * 0.67, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,170,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.945);
  ctx.lineTo(w * 0.58, h * 0.945);
  ctx.stroke();
  ctx.fillStyle = 'rgba(8,10,12,0.55)';
  ctx.fillRect(0, 0, Math.max(8, w * 0.012), h);
  ctx.fillRect(w - Math.max(8, w * 0.012), 0, Math.max(8, w * 0.012), h);
}

export function drawHUD(ctx, w, h, game) {
  const s = Math.max(0.72, Math.min(1.35, h / 720));
  const f = game.flight;
  const kt = f.speed * KT;
  const ft = f.pos[1] * FT;
  const agl = Math.max(0, f.agl) * FT;
  const hdg = deg(f.yaw);
  const tgt = game.missions.target;

  if (game.rig.mode === 'cockpit') cockpitFrame(ctx, w, h);

  compassCard(ctx, w, s, hdg, deg(Math.atan2(tgt.pos[0] - f.pos[0], tgt.pos[2] - f.pos[2])));
  speedTape(ctx, 26 * s, h * 0.47, s, kt, 52);
  altTape(ctx, w - 122 * s, h * 0.47, s, ft, agl, f.vspeed * 196.85);
  horizon(ctx, w / 2, h * 0.5, 70 * s, f.pitch, f.roll);
  missionCard(ctx, 26 * s, 92 * s, s, game);

  const bx = 26 * s, by = h - 146 * s;
  panel(ctx, bx, by, 300 * s, 118 * s);
  bar(ctx, bx + 12 * s, by + 16 * s, s, 'THR', f.throttle, AMBER, Math.round(f.throttle * 100) + '%');
  bar(ctx, bx + 12 * s, by + 40 * s, s, 'FUEL', f.fuel, f.fuel < 0.15 ? RED : GREEN, Math.round(f.fuel * 100) + '%');
  bar(ctx, bx + 12 * s, by + 64 * s, s, 'DMG', f.damage, f.damage > 0.5 ? RED : '#ffa36b', Math.round(f.damage * 100) + '%');
  ctx.beginPath();
  ctx.arc(bx + 24 * s, by + 94 * s, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = f.gear ? GREEN : 'rgba(255,255,255,0.18)';
  ctx.fill();
  text(ctx, 'GEAR ' + (f.gear ? 'DN' : 'UP'), bx + 36 * s, by + 94 * s, 9 * s, f.gear ? GREEN : AMBER_DIM, 'left', 700);
  text(ctx, 'OAT 14°C', bx + 200 * s, by + 94 * s, 9 * s, AMBER_DIM, 'left');
  text(ctx, 'WIND 240/08', bx + 200 * s, by + 106 * s, 8 * s, AMBER_DIM, 'left');

  text(ctx, 'SCORE ' + String(Math.round(game.missions.score)).padStart(4, '0'), w - 26 * s, h - 30 * s, 15 * s, AMBER, 'right', 700);
  text(ctx, 'SORTIE ' + String(Math.floor(game.sortieClock / 60)).padStart(2, '0') + ':' + String(Math.floor(game.sortieClock % 60)).padStart(2, '0'), w - 26 * s, h - 50 * s, 9 * s, AMBER_DIM, 'right');
  text(ctx, 'KESTREL RUN', 26 * s, h - 18 * s, 9, AMBER_DIM, 'left', 700);

  targetMarker(ctx, game.cam, w, h, tgt, hdg);

  const warn = [];
  if (f.stall) warn.push(['STALL', RED]);
  if (f.fuel < 0.14) warn.push(['FUEL LOW', RED]);
  if (f.damage > 0.45) warn.push(['AIRFRAME DAMAGE', '#ffb066']);
  if (f.state === 'landed') warn.push(['ON THE GROUND', GREEN]);
  if (warn.length && (Math.sin(game.clock * 9) > -0.3 || f.state === 'landed')) {
    warn.forEach(([label, color], i) => {
      const yy = h * 0.26 + i * 24 * s;
      ctx.fillStyle = 'rgba(10,8,8,0.6)';
      ctx.fillRect(w / 2 - 74 * s, yy - 12 * s, 148 * s, 22 * s);
      ctx.strokeStyle = color;
      ctx.strokeRect(w / 2 - 74 * s, yy - 12 * s, 148 * s, 22 * s);
      text(ctx, label, w / 2, yy, 12 * s, color, 'center', 700);
    });
  }

  if (game.toast && game.toast.t > 0) {
    ctx.globalAlpha = Math.min(1, game.toast.t / 0.6);
    text(ctx, game.toast.text, w / 2, 120 * s, 15 * s, AMBER, 'center', 700);
    ctx.globalAlpha = 1;
  }
}
