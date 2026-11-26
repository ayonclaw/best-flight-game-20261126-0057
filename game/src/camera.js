// camera.js — cockpit and chase rigs: a smoothed chase camera that trails the airframe and a
// cockpit eye that sits over the nose, with bank lean, buffet shake and an instant pose for shots.

export function createRig() {
  return { mode: 'chase', pos: [0, 20, -1140], yaw: 0, pitch: 0, roll: 0, ready: false, dist: 21 };
}

export function updateRig(rig, flight, dt, opts = {}) {
  const cp = Math.cos(flight.pitch);
  const fwd = [Math.sin(flight.yaw) * cp, Math.sin(flight.pitch), Math.cos(flight.yaw) * cp];
  const roll = flight.roll;
  const up = [
    -Math.sin(flight.yaw) * Math.sin(flight.pitch) * Math.cos(roll) + Math.cos(flight.yaw) * Math.sin(roll),
    Math.cos(flight.pitch) * Math.cos(roll),
    -Math.cos(flight.yaw) * Math.sin(flight.pitch) * Math.cos(roll) - Math.sin(flight.yaw) * Math.sin(roll),
  ];
  const shake = (flight.stall ? 0.011 : 0.0012 + Math.min(1, flight.speed / 110) * 0.0022) *
    Math.sin((flight.time || 0) * 31.7);

  if (rig.mode === 'cockpit') {
    const eye = [
      flight.pos[0] + fwd[0] * 1.85 + up[0] * 1.02,
      flight.pos[1] + fwd[1] * 1.85 + up[1] * 1.02,
      flight.pos[2] + fwd[2] * 1.85 + up[2] * 1.02,
    ];
    rig.pos = eye;
    rig.yaw = flight.yaw;
    rig.pitch = flight.pitch + shake;
    rig.roll = flight.roll;
    return { pos: eye, yaw: rig.yaw, pitch: rig.pitch, roll: rig.roll, fov: 69 };
  }

  const dist = opts.dist || rig.dist || 21;
  const target = [
    flight.pos[0] - fwd[0] * dist,
    flight.pos[1] - fwd[1] * dist + 5.2,
    flight.pos[2] - fwd[2] * dist,
  ];
  if (!rig.ready) {
    rig.pos = target;
    rig.ready = true;
  }
  const k = 1 - Math.exp(-dt * (opts.snap ? 40 : 7.5));
  rig.pos = [
    rig.pos[0] + (target[0] - rig.pos[0]) * k,
    rig.pos[1] + (target[1] - rig.pos[1]) * k,
    rig.pos[2] + (target[2] - rig.pos[2]) * k,
  ];
  const look = [
    flight.pos[0] + fwd[0] * 7,
    flight.pos[1] + fwd[1] * 7 + 1.2 - (opts.lookDown || 0),
    flight.pos[2] + fwd[2] * 7,
  ];
  const dx = look[0] - rig.pos[0], dy = look[1] - rig.pos[1], dz = look[2] - rig.pos[2];
  const wantYaw = Math.atan2(dx, dz);
  const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
  let dyaw = wantYaw - rig.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const kk = opts.snap ? 1 : 1 - Math.exp(-dt * 9);
  rig.yaw += dyaw * kk;
  rig.pitch += (wantPitch - rig.pitch) * kk;
  rig.roll += (flight.roll * 0.35 - rig.roll) * kk;
  return { pos: rig.pos, yaw: rig.yaw, pitch: rig.pitch + shake, roll: rig.roll, fov: opts.fov || 63 };
}
