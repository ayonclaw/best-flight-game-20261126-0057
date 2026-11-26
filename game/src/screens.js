// screens.js — the title card with controls and the mission list, the pause sheet and the sortie
// summary; all drawn on the same canvas in the instrument's amber-on-navy style.

const AMBER = '#ffd08a';
const DIM = 'rgba(255,208,138,0.5)';
const GREEN = '#9df0af';
const RED = '#ff7566';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(4,11,17,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,214,150,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(255,214,150,0.1)';
  ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = weight + ' ' + size + 'px "Consolas","SF Mono",Menlo,monospace';
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export function drawTitle(ctx, w, h, game) {
  const s = Math.min(w / 1280, h / 720);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(4,10,18,0.78)');
  g.addColorStop(0.55, 'rgba(4,10,18,0.55)');
  g.addColorStop(1, 'rgba(4,10,18,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const px = w * 0.5 - 400 * s, py = h * 0.5 - 245 * s;
  panel(ctx, px, py, 800 * s, 490 * s);

  text(ctx, 'KESTREL RUN', w / 2, py + 76 * s, 58 * s, AMBER, 'center', 700);
  text(ctx, 'A LOW-POLY SORTIE OVER THE MERIDIAN ARCHIPELAGO', w / 2, py + 116 * s, 12 * s, DIM, 'center', 600);
  ctx.strokeStyle = 'rgba(255,208,138,0.35)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 250 * s, py + 138 * s);
  ctx.lineTo(w / 2 + 250 * s, py + 138 * s);
  ctx.stroke();

  const colL = w / 2 - 355 * s, colR = w / 2 + 55 * s;
  text(ctx, 'CONTROLS', colL, py + 166 * s, 11 * s, AMBER, 'left', 700);
  const rows = [
    ['W / S', 'THROTTLE UP / DOWN'],
    ['ARROWS', 'PITCH & ROLL'],
    ['A / D', 'RUDDER'],
    ['G', 'GEAR DOWN / UP'],
    ['SPACE', 'DROP CRATE'],
    ['C', 'COCKPIT / CHASE'],
  ];
  rows.forEach((r, i) => {
    text(ctx, r[0], colL, py + 188 * s + i * 21 * s, 10 * s, GREEN, 'left', 700);
    text(ctx, r[1], colL + 78 * s, py + 188 * s + i * 21 * s, 10 * s, DIM, 'left');
  });

  text(ctx, 'THIS SORTIE', colR, py + 166 * s, 11 * s, AMBER, 'left', 700);
  const missions = [
    ['01', 'RING RUN', 'six gates, against the clock'],
    ['02', 'SUPPLY DROP', 'crate onto the island zone'],
    ['03', 'AIRFIELD RETURN', 'grease it onto runway 36'],
  ];
  missions.forEach((m, i) => {
    text(ctx, m[0], colR, py + 188 * s + i * 30 * s, 10 * s, DIM, 'left', 700);
    text(ctx, m[1], colR + 26 * s, py + 188 * s + i * 30 * s, 11 * s, AMBER, 'left', 700);
    text(ctx, m[2], colR + 26 * s, py + 202 * s + i * 30 * s, 9 * s, DIM, 'left');
  });
  text(ctx, 'Watch the fuel. Below 54 kt she stalls.', colR, py + 292 * s, 9 * s, DIM, 'left');

  const pulse = 0.55 + 0.45 * Math.sin(game.clock * 3.4);
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS ENTER TO LAUNCH', w / 2, py + 404 * s, 20 * s, AMBER, 'center', 700);
  ctx.globalAlpha = 1;
  text(ctx, 'throttle up, hold a little right rudder, and fly 36', w / 2, py + 434 * s, 10 * s, DIM, 'center');
  text(ctx, 'KESTREL RUN · BUILD 0057', w / 2, py + 462 * s, 8 * s, 'rgba(255,208,138,0.3)', 'center');
}

export function drawPause(ctx, w, h, game) {
  const s = Math.min(w / 1280, h / 720);
  ctx.fillStyle = 'rgba(3,8,14,0.6)';
  ctx.fillRect(0, 0, w, h);
  const pw = 520 * s, ph = 250 * s;
  const px = w / 2 - pw / 2, py = h / 2 - ph / 2;
  panel(ctx, px, py, pw, ph);
  text(ctx, 'PAUSED', w / 2, py + 52 * s, 34 * s, AMBER, 'center', 700);
  text(ctx, 'P  RESUME     R  RESTART     M  SOUND', w / 2, py + 108 * s, 12 * s, DIM, 'center');
  text(ctx, 'SCORE ' + Math.round(game.missions.score), w / 2, py + 148 * s, 14 * s, GREEN, 'center', 700);
  text(ctx, 'MISSION ' + (game.missions.index + 1) + ' · ' + game.missions.def.name, w / 2, py + 174 * s, 11 * s, DIM, 'center');
  text(ctx, 'ESC TO RESUME', w / 2, py + 214 * s, 9 * s, 'rgba(255,208,138,0.35)', 'center');
}

export function drawSummary(ctx, w, h, game, crashed) {
  const s = Math.min(w / 1280, h / 720);
  ctx.fillStyle = 'rgba(3,8,14,0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = 640 * s, ph = 420 * s;
  const px = w / 2 - pw / 2, py = h / 2 - ph / 2;
  panel(ctx, px, py, pw, ph);
  const st = game.missions.stats;
  text(ctx, crashed ? 'AIRFRAME LOST' : 'SORTIE COMPLETE', w / 2, py + 54 * s, 30 * s, crashed ? RED : AMBER, 'center', 700);
  text(ctx, crashed ? (game.crashReason || 'CONTACT WITH THE GROUND') : 'TOUCHDOWN ON RUNWAY 36', w / 2, py + 88 * s, 11 * s, DIM, 'center', 700);
  const rows = [
    ['RINGS PASSED', String(st.rings) + ' / 6'],
    ['CRATES ON TARGET', String(st.drops)],
    ['LANDINGS', String(st.landings) + (st.soft ? '  (one greaser)' : '')],
    ['MISSIONS CLEARED', String(st.missions)],
    ['FLIGHT TIME', String(Math.floor(game.sortieClock / 60)).padStart(2, '0') + ':' + String(Math.floor(game.sortieClock % 60)).padStart(2, '0')],
    ['SORTIE SCORE', String(Math.round(game.missions.score))],
  ];
  rows.forEach((r, i) => {
    const y = py + 132 * s + i * 30 * s;
    text(ctx, r[0], px + 70 * s, y, 11 * s, DIM, 'left');
    text(ctx, r[1], px + pw - 70 * s, y, i === rows.length - 1 ? 16 * s : 12 * s, i === rows.length - 1 ? AMBER : GREEN, 'right', 700);
    ctx.strokeStyle = 'rgba(255,214,150,0.1)';
    ctx.beginPath();
    ctx.moveTo(px + 70 * s, y + 14 * s);
    ctx.lineTo(px + pw - 70 * s, y + 14 * s);
    ctx.stroke();
  });
  text(ctx, 'R  FLY AGAIN      ENTER  TITLE', w / 2, py + ph - 34 * s, 13 * s, AMBER, 'center', 700);
}
