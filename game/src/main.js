// main.js — boot, the fixed-step loop and the frame assembly: sky, sea, sorted 3D faces, HUD and
// screens. It owns game state, key bindings, mission events and the ?shot= debug poses.

import { Scene, makeCamera, drawSky, drawSea } from './render3d.js';
import { buildWorld, SUN } from './world.js';
import { buildAircraft, drawAircraft, drawCrate } from './aircraft.js';
import { Flight } from './flight.js';
import { createRig, updateRig } from './camera.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Missions } from './missions.js';
import { drawHUD } from './hud.js';
import { drawTitle, drawPause, drawSummary } from './screens.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const world = buildWorld();
const player = buildAircraft('player');
const patrol = [buildAircraft('patrol'), buildAircraft('patrol')];
const flight = new Flight(world);
const rig = createRig();
const input = new Input(canvas);
const sound = new Sound();
const scene = new Scene();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const game = {
  flight,
  missions: new Missions(world),
  rig,
  world,
  scene,
  sound,
  state: 'title',
  clock: 0,
  sortieClock: 0,
  viewMode: 'chase',
  cam: null,
  toast: null,
  lastMissionToast: '',
  crashReason: '',
  endTimer: null,
  shot: null,
  time: 0,
  lookDown: 0,
};
window.__game = game;

function resize() {
  canvas.width = Math.max(320, window.innerWidth);
  canvas.height = Math.max(240, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

function titlePose() {
  flight.reset({ pos: [-520, 300, 1020], yaw: -0.86, pitch: 0.01, roll: 0.1, speed: 68, throttle: 0.6, gear: false, fuel: 0.8 });
  rig.mode = 'chase';
  rig.ready = false;
  rig.dist = 24;
}

function startSortie() {
  sound.ensure();
  game.missions = new Missions(world);
  game.lastMissionToast = '';
  flight.reset();
  rig.mode = 'chase';
  rig.ready = false;
  rig.dist = 21;
  game.viewMode = 'chase';
  game.state = 'fly';
  game.sortieClock = 0;
  game.crashReason = '';
  game.endTimer = null;
  game.toast = { text: 'CLEARED FOR TAKE-OFF — RUNWAY 36', t: 5 };
  announce('Sortie started. Mission one: ring run.');
}

function showTitle() {
  titlePose();
  game.state = 'title';
  game.endTimer = null;
  game.missions = new Missions(world);
  announce('Kestrel Run. Press Enter to launch.');
}

function announce(msg) {
  if (status) status.textContent = msg;
}

input.on('Enter', () => {
  sound.ensure();
  if (game.state === 'title') startSortie();
  else if (game.state === 'over') showTitle();
});
input.on('Space', () => {
  sound.ensure();
  if (game.state === 'title' || game.state === 'over') startSortie();
  else if (game.state === 'fly') {
    const r = game.missions.drop(flight);
    game.toast = { text: r.msg, t: 3 };
  }
});
input.on('KeyP', togglePause);
input.on('Escape', togglePause);
input.on('KeyR', () => {
  if (game.state === 'fly' || game.state === 'paused' || game.state === 'over') startSortie();
});
input.on('KeyG', () => {
  if (game.state !== 'fly') return;
  if (flight.speed > 70) game.toast = { text: 'TOO FAST FOR GEAR', t: 2 };
  else {
    flight.toggleGear();
    game.toast = { text: flight.gear ? 'GEAR DOWN' : 'GEAR UP', t: 2 };
  }
});
input.on('KeyC', () => {
  if (game.state === 'title') return;
  rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase';
  rig.ready = false;
  game.viewMode = rig.mode;
});
input.on('KeyM', () => {
  sound.enabled = !sound.enabled;
  if (!sound.enabled && sound.master) sound.master.gain.value = 0;
  if (sound.enabled && sound.master) sound.master.gain.value = 0.5;
  game.toast = { text: sound.enabled ? 'SOUND ON' : 'SOUND MUTED', t: 2 };
});
window.addEventListener('pointerdown', () => {
  if (game.state === 'title') startSortie();
});

function togglePause() {
  if (game.state === 'fly') game.state = 'paused';
  else if (game.state === 'paused') game.state = 'fly';
}

function stepSim(dt) {
  const c = input.snapshot();
  const prevRings = game.missions.stats.rings;
  const prevDrops = game.missions.stats.drops;
  flight.update(dt, c);
  game.missions.update(dt, flight);
  game.sortieClock += dt;
  if (game.missions.stats.rings > prevRings || game.missions.stats.drops > prevDrops) sound.chime();
  for (const e of flight.events) {
    if (e.type === 'landing') {
      sound.thud(e.landing && e.landing.quality === 'GREASER');
      game.toast = { text: 'TOUCHDOWN — ' + (e.landing ? e.landing.quality : 'FIRM'), t: 4 };
      game.endTimer = 1.8;
    } else if (e.type === 'crash') {
      sound.crash();
      game.crashReason = e.reason;
      game.state = 'over';
      game.toast = { text: e.reason, t: 9 };
    }
  }
  if (game.missions.toast && game.missions.toast !== game.lastMissionToast) {
    game.lastMissionToast = game.missions.toast;
    game.toast = { text: game.missions.toast, t: 4.5 };
  }
  if (flight.state === 'landed' && game.endTimer === null) game.endTimer = 1.8;
  if (game.endTimer !== null && game.state === 'fly') {
    game.endTimer -= dt;
    if (game.endTimer <= 0) {
      game.endTimer = null;
      game.state = 'over';
    }
  }
}

function ringFaces() {
  const m = game.missions;
  const active = m.def.kind === 'rings' && !m.complete ? m.ringIdx : -1;
  for (let i = 0; i < world.rings.length; i++) {
    const ring = world.rings[i];
    if (Math.hypot(ring.p[0] - rig.pos[0], ring.p[2] - rig.pos[2]) > 6500) continue;
    const passed = m.passed.indexOf(i) !== -1;
    const isActive = i === active;
    const color = passed ? [96, 198, 128] : isActive ? [247, 199, 96] : [186, 158, 104];
    const o = { alpha: isActive ? 0.97 : 0.6 };
    for (const f of ring.faces) scene.add(f, color, o);
  }
}

function zoneFaces() {
  const z = world.zone;
  const active = game.missions.def.kind === 'supply';
  for (const f of z.faces) scene.add(f, [240, 150, 60], { alpha: active ? 0.9 : 0.4, glow: active ? 'rgba(255,150,60,0.8)' : null });
  if (active) {
    const x = z.x, zz = z.z, top = z.y + 58;
    for (const [ox, oz] of [[-70, -70], [70, 70], [-70, 60]]) {
      scene.add([[x + ox, z.y, zz + oz], [x + ox + 7, z.y, zz + oz], [x + ox + 7, top, zz + oz], [x + ox, top, zz + oz]], [255, 170, 90], { alpha: 0.16, fog: false });
    }
  }
}

function trafficFaces(t) {
  const a0 = t * 0.055 + 1.2;
  const p0 = [-1520 + Math.cos(a0) * 520, 310 + Math.sin(a0 * 1.7) * 12, 1180 + Math.sin(a0) * 520];
  if (Math.hypot(p0[0] - rig.pos[0], p0[2] - rig.pos[2]) < 3400) {
    drawAircraft(scene, patrol[0], p0, -a0, 0, 0.18, t, { scale: 0.9 });
  }
  const a1 = -t * 0.045 + 2.6;
  const p1 = [1260 + Math.cos(a1) * 300, 235, 840 + Math.sin(a1) * 300];
  if (Math.hypot(p1[0] - rig.pos[0], p1[2] - rig.pos[2]) < 3400) {
    drawAircraft(scene, patrol[1], p1, -a1, 0, 0, t);
  }
}

const CLOUDS = [
  [-1150, 560, 380, 1.0], [980, 640, 1560, 0.8], [-2250, 720, -1180, 1.15],
  [1620, 520, -620, 0.75], [320, 610, 2260, 0.95], [-200, 700, -2600, 0.85],
];

function drawClouds(cam) {
  for (const [cx, cy, cz, sc] of CLOUDS) {
    const puffs = [[-0.9, -0.25, 160], [0, 0.1, 230], [0.95, -0.2, 180], [0.1, 0.42, 150]];
    for (const [ox, oy, r] of puffs) {
      const pts = [];
      const rad = r * sc;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rg = Math.cos(a) * rad * 1.55 + ox * 240 * sc;
        const rg2 = Math.sin(a) * rad * 0.62 + oy * 170 * sc;
        pts.push([
          cx + cam.right[0] * rg + cam.up[0] * rg2,
          cy + cam.right[1] * rg + cam.up[1] * rg2,
          cz + cam.right[2] * rg + cam.up[2] * rg2,
        ]);
      }
      scene.add(pts, oy < 0 ? [212, 221, 230] : [255, 255, 255], { alpha: 0.95 });
    }
  }
}

function buildScene(t, cam) {
  scene.clear();
  drawClouds(cam);
  for (const g of world.glints(rig.pos, t)) scene.add(g.pts, g.color, { alpha: g.alpha, fog: false });
  for (const f of world.terrain) scene.add(f.pts, f.color, { normal: f.n });
  for (const f of world.runway) scene.add(f.pts, f.color, { normal: f.n, layer: 1 });
  ringFaces();
  zoneFaces();
  if (game.missions.crate) {
    const c = game.missions.crate;
    drawCrate(scene, c.pos, c.chute, t);
  }
  trafficFaces(t);
  if (rig.mode === 'chase') drawAircraft(scene, player, flight.pos, flight.yaw, flight.pitch, flight.roll, t, { gear: flight.gear });
}

let last = performance.now();
let acc = 0;
let painted = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 1 / 60;
  dt = Math.min(dt, 0.1);
  game.clock += dt;
  game.time += dt;

  if (game.state === 'fly' && !game.shot) {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 5) {
      stepSim(1 / 60);
      acc -= 1 / 60;
      steps++;
    }
    if (game.state === 'fly') sound.update(flight.throttle, flight.speed, flight.stall, dt);
  } else {
    acc = 0;
  }
  if (game.toast) {
    game.toast.t -= dt;
    if (game.toast.t <= 0) game.toast = null;
  }

  const view = updateRig(rig, flight, game.shot ? 1 / 60 : dt, { snap: !!game.shot, lookDown: game.lookDown || 0 });
  const cam = makeCamera(view.pos, view.yaw, view.pitch, view.roll, view.fov);
  game.cam = cam;

  const w = canvas.width, h = canvas.height;
  drawSky(ctx, w, h, cam, SUN);
  drawSea(ctx, w, h, cam);
  buildScene(game.time, cam);
  scene.flush(ctx, cam, w, h);

  if (game.state === 'title') {
    drawTitle(ctx, w, h, game);
  } else {
    drawHUD(ctx, w, h, game);
    if (game.state === 'paused') drawPause(ctx, w, h, game);
    if (game.state === 'over') drawSummary(ctx, w, h, game, game.crashReason !== '');
  }

  if (game.shot) {
    painted++;
    if (painted >= 3) window.__shotReady = true;
  }
}

if (shotName && applyShot(shotName, game)) {
  game.shot = shotName;
  rig.ready = false;
  announce('Kestrel Run shot: ' + shotName);
  requestAnimationFrame(frame);
} else {
  titlePose();
  announce('Kestrel Run. Press Enter to launch.');
  requestAnimationFrame(frame);
}
