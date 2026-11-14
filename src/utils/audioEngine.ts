// Safe, user-triggered Web Audio API acoustic synthesizer
// Handles plucked string harmonics, open/closed organ pipe tones, and resonance swell

class AcousticAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;

  // Sustained nodes for organ pipe & resonance tube
  private activeSustainedStop: (() => void) | null = null;
  private resonanceGainNode: GainNode | null = null;
  private resonanceOscNode: OscillatorNode | null = null;
  private resonanceOverOsc: OscillatorNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, now, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stopSustained() {
    if (this.activeSustainedStop) {
      this.activeSustainedStop();
      this.activeSustainedStop = null;
    }
    this.resonanceGainNode = null;
    this.resonanceOscNode = null;
    this.resonanceOverOsc = null;
  }

  /**
   * Module 1: Plucked stretched string synthesis
   * Simulates rich standing wave harmonics with metallic/nylon damping profile
   */
  public playPluckedString(freqHz: number, material: 'steel' | 'copper' | 'brass' | 'nylon') {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const clampedFreq = Math.max(55, Math.min(2200, freqHz));
    const now = ctx.currentTime;

    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const brightness = material === 'steel' ? 4200 : material === 'brass' ? 3200 : material === 'copper' ? 2800 : 1800;
    filter.frequency.setValueAtTime(Math.min(8000, clampedFreq * 6 + brightness * 0.4), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(250, clampedFreq * 1.8), now + 1.4);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.45, now + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.85);

    filter.connect(noteGain);
    noteGain.connect(this.masterGain);

    const harmonics = material === 'nylon' ? [1, 0.35, 0.12] : [1, 0.55, 0.32, 0.18, 0.09];
    const oscs: OscillatorNode[] = [];

    harmonics.forEach((amp, idx) => {
      const partialFreq = clampedFreq * (idx + 1);
      if (partialFreq > 12000) return;
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(partialFreq, now);
      partialGain.gain.setValueAtTime(amp, now);
      partialGain.gain.exponentialRampToValueAtTime(0.01, now + 1.7 / (idx + 1));
      osc.connect(partialGain);
      partialGain.connect(filter);
      osc.start(now);
      osc.stop(now + 1.9);
      oscs.push(osc);
    });
  }

  /**
   * Module 2: Sustained or triggered Organ Pipe tone
   * Closed pipe emphasizes odd harmonics (1, 3, 5); Open pipe includes even & odd (1, 2, 3, 4)
   */
  public startOrganPipeTone(freqHz: number, mode: 'closed' | 'open', onAutoStop?: () => void) {
    this.stopSustained();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const clampedFreq = Math.max(60, Math.min(2400, freqHz));
    const now = ctx.currentTime;

    const pipeGain = ctx.createGain();
    pipeGain.gain.setValueAtTime(0.0001, now);
    pipeGain.gain.linearRampToValueAtTime(0.32, now + 0.08);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(6000, clampedFreq * 4.5), now);

    filter.connect(pipeGain);
    pipeGain.connect(this.masterGain);

    const partials =
      mode === 'closed'
        ? [
            { mult: 1, amp: 1.0 },
            { mult: 3, amp: 0.34 },
            { mult: 5, amp: 0.14 },
            { mult: 7, amp: 0.05 },
          ]
        : [
            { mult: 1, amp: 1.0 },
            { mult: 2, amp: 0.45 },
            { mult: 3, amp: 0.22 },
            { mult: 4, amp: 0.11 },
          ];

    const oscs: OscillatorNode[] = [];
    partials.forEach((p) => {
      const f = clampedFreq * p.mult;
      if (f > 11000) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      g.gain.value = p.amp;
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      oscs.push(osc);
    });

    let stopped = false;
    const stopFn = () => {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      pipeGain.gain.cancelScheduledValues(t);
      pipeGain.gain.setValueAtTime(pipeGain.gain.value, t);
      pipeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      setTimeout(() => {
        oscs.forEach((o) => {
          try {
            o.stop();
            o.disconnect();
          } catch {
            // ignore already stopped
          }
        });
      }, 150);
    };

    const autoTimer = window.setTimeout(() => {
      stopFn();
      if (this.activeSustainedStop === wrappedStop) {
        this.activeSustainedStop = null;
      }
      onAutoStop?.();
    }, 3200);

    const wrappedStop = () => {
      window.clearTimeout(autoTimer);
      stopFn();
    };

    this.activeSustainedStop = wrappedStop;
  }

  /**
   * Module 3: Continuous Tuning Fork + Air Column Resonance Swell
   */
  public startResonanceTone(freqHz: number, resonanceLevel: number) {
    this.stopSustained();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const clampedFreq = Math.max(120, Math.min(1800, freqHz));
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    const targetAmp = 0.05 + resonanceLevel * 0.42;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetAmp, now + 0.04);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(clampedFreq, now);

    // Subtle metallic fork shimmer on strike
    const overOsc = ctx.createOscillator();
    const overGain = ctx.createGain();
    overOsc.type = 'sine';
    overOsc.frequency.setValueAtTime(clampedFreq * 2, now);
    overGain.gain.value = 0.04 * resonanceLevel;

    osc.connect(gain);
    overOsc.connect(overGain);
    overGain.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    overOsc.start(now);

    this.resonanceGainNode = gain;
    this.resonanceOscNode = osc;
    this.resonanceOverOsc = overOsc;

    this.activeSustainedStop = () => {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      setTimeout(() => {
        try {
          osc.stop();
          overOsc.stop();
          osc.disconnect();
          overOsc.disconnect();
        } catch {
          // ignore
        }
      }, 170);
    };
  }

  public updateResonanceParams(freqHz: number, resonanceLevel: number) {
    if (!this.ctx || !this.resonanceGainNode || !this.resonanceOscNode) return;
    const now = this.ctx.currentTime;
    const clampedFreq = Math.max(120, Math.min(1800, freqHz));
    const targetAmp = 0.05 + resonanceLevel * 0.42;
    this.resonanceOscNode.frequency.setTargetAtTime(clampedFreq, now, 0.02);
    if (this.resonanceOverOsc) {
      this.resonanceOverOsc.frequency.setTargetAtTime(clampedFreq * 2, now, 0.02);
    }
    this.resonanceGainNode.gain.setTargetAtTime(targetAmp, now, 0.03);
  }
}

export const audioEngine = new AcousticAudioEngine();
