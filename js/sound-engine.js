// ========== SOUND ENGINE ==========
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.humOsc = null;
    this.humGain = null;
    this.humFilter = null;
    this.humLFO = null;
    this._initOnInteraction = this._init.bind(this);
  }

  _init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) { console.warn('Web Audio not available'); }
    document.removeEventListener('pointerdown', this._initOnInteraction);
    document.removeEventListener('keydown', this._initOnInteraction);
  }

  ensure() { if (!this.ctx) this._init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  _playTone(freq, duration, type = 'sine', vol = 0.18, freqEnd = null) {
    if (!this.ctx || this.muted) return;
    this.ensure();
    const t = this._now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  playPlace() {
    if (!this.ctx || this.muted) return;
    this.ensure();
    const t = this._now();
    [800, 1200].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.04);
      gain.gain.setValueAtTime(0, t + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.04 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.07);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.08);
    });
  }

  playPop() {
    if (this.muted) return;
    this._playTone(380, 0.05, 'sine', 0.10, 280);
  }

  playTick() {
    if (this.muted) return;
    this._playTone(900, 0.03, 'sine', 0.08);
  }

  startHum() {
    if (!this.ctx || this.muted) return;
    this.ensure();
    if (this.humOsc) return;
    const t = this._now();
    this.humOsc = this.ctx.createOscillator();
    this.humFilter = this.ctx.createBiquadFilter();
    this.humLFO = this.ctx.createOscillator();
    this.humGain = this.ctx.createGain();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.value = 75;
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.value = 180;
    this.humFilter.Q.value = 3;
    this.humLFO.type = 'sine';
    this.humLFO.frequency.value = 2.5;
    this.humLFO.connect(this.humFilter.frequency);
    this.humGain.gain.setValueAtTime(0, t);
    this.humGain.gain.linearRampToValueAtTime(CONFIG.HUM_VOLUME, t + 0.4);
    this.humOsc.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.masterGain);
    this.humOsc.start(t);
    this.humLFO.start(t);
  }

  stopHum() {
    if (!this.humOsc) return;
    const t = this._now();
    try {
      this.humGain.gain.setValueAtTime(this.humGain.gain.value, t);
      this.humGain.gain.linearRampToValueAtTime(0, t + 0.5);
      this.humOsc.stop(t + 0.55);
      this.humLFO.stop(t + 0.55);
    } catch (e) { /* ignore */ }
    this.humOsc = null; this.humLFO = null; this.humFilter = null; this.humGain = null;
  }

  playSizzle() {
    if (!this.ctx || this.muted) return;
    this.ensure();
    const duration = 0.12;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = 2800 + Math.random() * 2000;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.06, this._now());
    gain.gain.exponentialRampToValueAtTime(0.001, this._now() + duration);
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    src.start(); src.stop(this._now() + duration + 0.01);
  }

  playIronFinish() {
    if (!this.ctx || this.muted) return;
    this.ensure();
    const t = this._now();
    [440, 330].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.15);
      gain.gain.setValueAtTime(0, t + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.45);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.5);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopHum();
    return this.muted;
  }
}
