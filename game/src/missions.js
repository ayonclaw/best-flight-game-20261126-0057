// missions.js — the sortie's three jobs in rotation: timed RING RUN, SUPPLY DROP onto a marked
// island zone, and AIRFIELD RETURN; each scores, announces itself and hands over to the next.

import { RINGS, DROP_ZONE, RUNWAY, RING_RADIUS } from './world.js';

const KT = 1.94384;
const FT = 3.28084;

const DEFS = [
  { kind: 'rings', name: 'RING RUN', brief: 'FLY THE SIX NUMBERED RINGS IN ORDER', limit: 165 },
  { kind: 'supply', name: 'SUPPLY DROP', brief: 'DROP THE CRATE ON THE MARKED ISLAND ZONE', limit: 240 },
  { kind: 'return', name: 'AIRFIELD RETURN', brief: 'LAND ON RUNWAY 36, GEAR DOWN', limit: 300 },
];

export class Missions {
  constructor(world) {
    this.world = world;
    this.score = 0;
    this.stats = { rings: 0, drops: 0, landings: 0, missions: 0, soft: 0 };
    this.timer = 0;
    this.toast = null;
    this.crate = null;
    this.start(0);
  }

  start(index) {
    this.index = index % DEFS.length;
    this.def = DEFS[this.index];
    this.timeLeft = this.def.limit;
    this.complete = false;
    this.doneTimer = 0;
    this.ringIdx = 0;
    this.passed = [];
    this.dropped = false;
    this.crate = null;
    this.landed = null;
    this.said = '';
  }

  next() {
    this.start(this.index + 1);
  }

  get target() {
    if (this.def.kind === 'rings') {
      const ring = this.world.rings[Math.min(this.ringIdx, this.world.rings.length - 1)];
      return {
        pos: ring.p,
        label: 'RING ' + (this.ringIdx + 1),
        kind: 'ring',
        size: RING_RADIUS,
        idx: this.ringIdx,
      };
    }
    if (this.def.kind === 'supply') {
      return {
        pos: [DROP_ZONE.x, DROP_ZONE.y + 3, DROP_ZONE.z],
        label: 'DROP ZONE',
        kind: 'zone',
        size: DROP_ZONE.r,
      };
    }
    return {
      pos: [RUNWAY.x, RUNWAY.y + 1, RUNWAY.z - RUNWAY.len * 0.5],
      label: 'RUNWAY 36',
      kind: 'runway',
      size: 60,
    };
  }

  ringPass(flight) {
    const ring = this.world.rings[this.ringIdx];
    if (!ring) return false;
    const dx = flight.pos[0] - ring.p[0];
    const dy = flight.pos[1] - ring.p[1];
    const dz = flight.pos[2] - ring.p[2];
    const axial = Math.abs(dx * ring.n[0] + dy * ring.n[1] + dz * ring.n[2]);
    return Math.hypot(dx, dy, dz) < ring.radius * 0.98 && axial < 11;
  }

  finish(text) {
    this.complete = true;
    this.doneTimer = 2.4;
    this.stats.missions++;
    this.toast = text;
  }

  update(dt, flight) {
    this.timer += dt;
    if (this.crate) {
      const c = this.crate;
      if (c.chute) {
        c.vel = Math.max(c.vel - 2.2 * dt, -5);
        c.pos[1] += c.vel * dt;
        const g = this.world.heightAt(c.pos[0], c.pos[2]) + 1.4;
        if (c.pos[1] <= g) {
          c.pos[1] = g;
          c.chute = false;
          const miss = Math.hypot(c.pos[0] - DROP_ZONE.x, c.pos[2] - DROP_ZONE.z);
          c.miss = miss;
          this.crateTimer = 2.4;
        }
      } else {
        this.crateTimer -= dt;
        if (this.crateTimer <= 0) this.crate = null;
      }
    }
    if (this.complete) {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) this.next();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.toast = 'OUT OF TIME — ' + this.def.name + ' CLOSED';
      this.finish('');
      this.timeLeft = 0;
      return;
    }
    if (this.def.kind === 'rings') {
      if (this.ringPass(flight)) {
        this.stats.rings++;
        this.score += 120;
        this.passed.push(this.ringIdx);
        this.ringIdx++;
        if (this.ringIdx >= this.world.rings.length) {
          this.score += 300;
          this.finish('RING RUN COMPLETE  +' + (120 * this.world.rings.length + 300));
        }
      }
    } else if (this.def.kind === 'return') {
      if (flight.state === 'landed' && !this.landed) {
        this.landed = flight.landing;
        const bonus = flight.landing && flight.landing.quality === 'GREASER' ? 220 : 90;
        if (bonus === 220) this.stats.soft++;
        this.stats.landings++;
        this.score += 350 + bonus;
        this.finish('RUNWAY 36 — ' + (flight.landing ? flight.landing.quality : 'LANDED'));
      }
    }
  }

  drop(flight) {
    if (this.def.kind !== 'supply' || this.complete) return { ok: false, msg: 'NO DROP ON THIS LEG' };
    if (this.crate) return { ok: false, msg: 'CRATE ALREADY AWAY' };
    const dx = flight.pos[0] - DROP_ZONE.x, dz = flight.pos[2] - DROP_ZONE.z;
    const range = Math.hypot(dx, dz);
    const altFt = flight.agl * FT;
    const kt = flight.speed * KT;
    if (range > DROP_ZONE.r) return { ok: false, msg: 'OUTSIDE THE ZONE — ' + Math.round(range) + ' M OFF' };
    if (altFt > 800) return { ok: false, msg: 'TOO HIGH — DESCEND BELOW 800 FT' };
    if (kt > 120) return { ok: false, msg: 'TOO FAST — SLOW BELOW 120 KT' };
    const miss = range;
    const pts = Math.max(120, Math.round(420 - miss * 1.6));
    this.dropped = true;
    this.stats.drops++;
    this.score += pts;
    this.crate = { pos: [flight.pos[0], flight.pos[1] - 1.5, flight.pos[2]], vel: -1, chute: true };
    this.finish('CRATE AWAY — ' + Math.round(miss) + ' M FROM THE MARK  +' + pts);
    return { ok: true, msg: 'CRATE AWAY' };
  }

  hint(flight) {
    if (this.def.kind === 'supply' && !this.complete) {
      const kt = flight.speed * KT;
      const alt = flight.agl * FT;
      const dx = flight.pos[0] - DROP_ZONE.x, dz = flight.pos[2] - DROP_ZONE.z;
      if (Math.hypot(dx, dz) > DROP_ZONE.r) return 'ZONE ' + Math.round(Math.hypot(dx, dz) / 1852 * 10) / 10 + ' NM';
      if (alt > 800) return 'OVER ZONE — TOO HIGH (' + Math.round(alt) + ' FT)';
      if (kt > 120) return 'OVER ZONE — TOO FAST (' + Math.round(kt) + ' KT)';
      return 'DROP WINDOW — PRESS SPACE';
    }
    return '';
  }
}

export const MISSION_NAMES = DEFS.map((d) => d.name);
export const MISSION_COUNT = DEFS.length;
