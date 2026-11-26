// shots.js — deterministic debug poses for the four screenshots, reached only with ?shot=<name>;
// each sets a mission, the aircraft attitude and the camera so the render repeats exactly.

export const SHOT_NAMES = ['cockpit', 'rings', 'landing', 'islands'];

export function applyShot(name, game) {
  const f = game.flight;
  const m = game.missions;
  game.lookDown = 0;
  if (name === 'cockpit') {
    f.reset({ pos: [0, 50, -1360], yaw: 0.01, pitch: 0.07, roll: 0.04, speed: 62, throttle: 0.58, gear: false, fuel: 0.74 });
    m.start(0);
    m.ringIdx = 0;
    m.timeLeft = 148;
    game.rig.mode = 'cockpit';
  } else if (name === 'rings') {
    f.reset({ pos: [825, 174, -1132], yaw: -2.40, pitch: 0.02, roll: 0.22, speed: 62, throttle: 0.72, gear: false, fuel: 0.58 });
    m.start(0);
    m.ringIdx = 4;
    m.passed = [0, 1, 2, 3];
    m.timeLeft = 71;
    m.stats.rings = 4;
    m.score = 780;
    game.rig.mode = 'chase';
    game.rig.dist = 18;
    game.lookDown = -1.4;
  } else if (name === 'landing') {
    f.reset({ pos: [14, 38, -1300], yaw: -0.02, pitch: 0.02, roll: 0.015, speed: 38, throttle: 0.25, gear: true, fuel: 0.44 });
    f.agl = 30;
    f.vspeed = -1.6;
    m.start(2);
    m.timeLeft = 96;
    m.score = 940;
    game.rig.mode = 'chase';
    game.rig.dist = 15;
    game.lookDown = -5.2;
  } else if (name === 'islands') {
    f.reset({ pos: [-2450, 290, 700], yaw: 0.86, pitch: 0.01, roll: 0.14, speed: 70, throttle: 0.62, gear: false, fuel: 0.67 });
    m.start(1);
    m.timeLeft = 204;
    m.score = 420;
    game.rig.mode = 'chase';
    game.rig.dist = 26;
    game.lookDown = -1.2;
  } else {
    return false;
  }
  game.viewMode = game.rig.mode;
  game.state = 'fly';
  return true;
}
