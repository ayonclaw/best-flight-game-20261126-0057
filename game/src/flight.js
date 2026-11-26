// flight.js — the Kestrel's flight model: throttle, pitch/roll/yaw with bank-induced turns,
// stall and gravity sink, fuel burn, gear, terrain/sea damage and a real landing test.

export const KNOTS = 1.94384;
export const FEET = 3.28084;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Flight {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset(pose = {}) {
    this.pos = [0, 9.35, -1112];
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = 1;
    this.damage = 0;
    this.gear = true;
    this.state = 'air';
    this.vspeed = 0;
    this.agl = 9.6;
    this.stall = false;
    this.prev = [...this.pos];
    this.events = [];
    this.landing = null;
    this.time = 0;
    this.onRunway = true;
    this.grounded = !pose.pos;
    if (pose.pos) this.pos = [...pose.pos];
    if (pose.yaw !== undefined) this.yaw = pose.yaw;
    if (pose.pitch !== undefined) this.pitch = pose.pitch;
    if (pose.roll !== undefined) this.roll = pose.roll;
    if (pose.speed !== undefined) this.speed = pose.speed;
    if (pose.throttle !== undefined) this.throttle = pose.throttle;
    if (pose.gear !== undefined) this.gear = pose.gear;
    if (pose.fuel !== undefined) this.fuel = pose.fuel;
    if (pose.damage !== undefined) this.damage = pose.damage;
    this.prev = [...this.pos];
    this.agl = this.pos[1] - this.surfaceHeight();
  }

  forward() {
    const cp = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
  }

  toggleGear() {
    if (this.state !== 'air') return;
    if (this.speed < 70) this.gear = !this.gear;
  }

  update(dt, c) {
    dt = Math.min(dt, 0.05);
    this.events.length = 0;
    if (this.state === 'crashed') return;
    this.time += dt;
    const surface = this.surfaceHeight();

    if (this.state === 'landed') {
      this.speed = Math.max(0, this.speed - 3.4 * dt);
      this.pos[0] += Math.sin(this.yaw) * this.speed * dt;
      this.pos[2] += Math.cos(this.yaw) * this.speed * dt;
      this.pos[1] = this.surfaceHeight() + 1.35;
      this.throttle = Math.max(0, this.throttle - dt * 0.8);
      this.fuel = Math.max(0, this.fuel - 0.0009 * dt);
      this.agl = this.pos[1] - this.surfaceHeight();
      return;
    }

    this.throttle = clamp(this.throttle + c.thr * 0.62 * dt, 0, 1);
    this.stall = this.speed < 27 && this.pos[1] > surface + 3;
    const auth = (this.stall ? 0.38 : 1) * (0.55 + 0.45 * clamp(this.speed / 46, 0.12, 1));
    this.pitch += c.pitch * 0.92 * auth * dt;
    this.pitch = clamp(this.pitch, -0.75, 0.7);
    this.roll += c.roll * 2.15 * auth * dt;
    if (!c.roll) this.roll *= Math.pow(0.5, dt * 0.55);
    this.roll = clamp(this.roll, -1.32, 1.32);

    const bankTurn = (9.81 * Math.tan(this.roll)) / Math.max(this.speed, 24) * 1.35;
    this.yaw += clamp(bankTurn + c.yaw * 0.5, -0.65, 0.65) * dt;

    const thrust = this.fuel > 0 ? this.throttle * 12.4 : 0;
    const drag = 0.00115 * this.speed * this.speed + (this.gear ? 1.8 : 0) + (this.stall ? 3.2 : 0) + this.damage * 1.6;
    const gravity = 9.81 * Math.sin(this.pitch) * 0.85;
    this.speed = clamp(this.speed + (thrust - drag - gravity) * dt, 0, 112);

    const lift = clamp((this.speed - 8) / 26, 0, 1);
    this.vspeed = this.speed * Math.sin(this.pitch) - (1 - lift) * 9.5 - Math.abs(Math.sin(this.roll)) * 1.8;
    if (this.gear) this.vspeed -= 0.4;

    this.prev = [...this.pos];
    const hs = this.speed * Math.cos(this.pitch);
    this.pos[0] += Math.sin(this.yaw) * hs * dt;
    this.pos[2] += Math.cos(this.yaw) * hs * dt;
    this.pos[1] += this.vspeed * dt;
    if (this.pos[1] > 4200) {
      this.pos[1] = 4200;
      this.vspeed = Math.min(0, this.vspeed);
    }

    this.fuel = Math.max(0, this.fuel - (0.0014 + 0.0036 * this.throttle) * dt * (this.damage > 0.55 ? 1.3 : 1));
    const surface2 = this.surfaceHeight();
    this.agl = this.pos[1] - surface2;

    // Ground roll: on the runway, gear down, slow and aligned, she sits on her wheels until
    // the wing lifts her off. A descent onto the runway is handed to touchDown instead.
    const rwy = this.world.runwayAt(this.pos[0], this.pos[2]);
    if (this.grounded) {
      if (rwy.on && this.gear && this.speed < 38 && Math.abs(angleDiff(this.yaw, 0)) < 0.55) {
        this.pos[1] = surface2 + 1.35;
        this.vspeed = 0;
        this.agl = 1.35;
        return;
      }
      this.grounded = false;
    }
    if (this.pos[1] <= surface2 + 1.5) {
      if (this.vspeed < -0.6) this.touchDown(surface2);
      else this.pos[1] = surface2 + 1.5;
    }
  }

  surfaceHeight() {
    const rwy = this.world.runwayAt(this.pos[0], this.pos[2]);
    this.onRunway = rwy.on;
    return Math.max(this.world.heightAt(this.pos[0], this.pos[2]), rwy.on ? 8 : 0);
  }

  touchDown(surface) {
    const rwy = this.world.runwayAt(this.pos[0], this.pos[2]);
    this.pos[1] = surface + 1.35;
    this.agl = 1.35;
    const vs = this.vspeed;
    const headingErr = Math.abs(angleDiff(this.yaw, 0));
    const aligned = headingErr < 0.30 && Math.abs(rwy.lateral) < 18;
    const soft = vs > -4.3;
    const slow = this.speed <= 48;
    const noseUp = this.pitch > -0.03;
    if (rwy.on && this.gear && soft && slow && aligned && noseUp) {
      this.state = 'landed';
      this.landing = { vs, speed: this.speed, quality: vs > -2.2 && this.speed < 38 ? 'GREASER' : 'FIRM', at: [...this.pos] };
      this.vspeed = 0;
      this.speed = Math.min(this.speed, 40);
      this.events.push({ type: 'landing', landing: this.landing });
      return;
    }
    let reason = 'TERRAIN';
    if (!rwy.on) reason = surface <= 0.05 ? 'DITCHED IN THE SEA' : 'HIT HIGH GROUND';
    else if (!this.gear) reason = 'BELLY LANDING — GEAR UP';
    else if (!slow) reason = 'TOO FAST TO SET DOWN';
    else if (!soft) reason = 'SINK RATE TOO HIGH';
    else if (!aligned) reason = 'NOT ALIGNED WITH 36';
    else if (!noseUp) reason = 'NOSE DOWN ON CONTACT';
    this.state = 'crashed';
    this.damage = 1;
    this.speed *= 0.2;
    this.vspeed = 0;
    if (!rwy.on && surface <= 0.05) this.pos[1] = 1.2;
    this.events.push({ type: 'crash', reason });
  }
}
