// audio.js — WebAudio synthesis only: an engine hum keyed to throttle and speed, a wind bed,
// stall callsign beeps, the ring chime, touchdown thud and crash burst. No samples loaded.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.engineOsc = null;
    this.windNode = null;
    this._stallBeep = 0;
  }

  ensure() {
    if (this.ctx || !this.enabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    const engGain = this.ctx.createGain();
    engGain.gain.value = 0;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    const eng2 = this.ctx.createOscillator();
    eng2.type = 'square';
    eng2.frequency.value = 31;
    const engFilter = this.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 620;
    const engGe = this.ctx.createGain();
    engGe.gain.value = 0.7;
    this.engineOsc.connect(engFilter);
    eng2.connect(engFilter);
    engFilter.connect(engGe);
    engGe.connect(engGain);
    engGain.connect(this.master);
    this.engineOsc.start();
    eng2.start();
    this._engGain = engGain;

    // wind: filtered noise whose level follows airspeed
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.5;
    this.windNode = this.ctx.createGain();
    this.windNode.gain.value = 0;
    src.connect(windFilter);
    windFilter.connect(this.windNode);
    this.windNode.connect(this.master);
    src.start();
  }

  update(throttle, speed, stall, dt) {
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const rpm = 55 + throttle * 105 + Math.min(speed, 70) * 0.5;
    this.engineOsc.frequency.value = rpm;
    this._engGain.gain.value = 0.02 + throttle * 0.075 + speed * 0.00025;
    if (this.windNode) this.windNode.gain.value = Math.min(0.12, speed * 0.0009);
    this._stallBeep -= dt;
    if (stall && this._stallBeep <= 0) {
      this.beep([760, 520], 0.16, 0.22);
      this._stallBeep = 0.55;
    }
  }

  tone(freq, dur, vol, type = 'sine') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  beep(freqs, dur, vol) {
    for (const f of freqs) this.tone(f, dur, vol);
  }

  chime() {
    this.beep([880, 1320], 0.34, 0.24);
    setTimeout(() => this.beep([1560, 1970], 0.42, 0.16), 90);
  }

  thud(soft) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2) * (soft ? 0.4 : 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = soft ? 260 : 140;
    src.connect(filter);
    filter.connect(this.master);
    src.start(t);
  }

  crash() {
    this.beep([180, 90, 45], 0.85, 0.5, 'sawtooth');
    this.thud(false);
  }
}
