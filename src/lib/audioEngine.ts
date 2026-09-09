import { SoundscapeType } from '../types';

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'silence';
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.35;
  private activeNodes: (AudioNode | number)[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public play(type: SoundscapeType) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.stop();
    this.currentType = type;

    if (type === 'silence') return;

    try {
      if (type === 'rain') {
        this.generateRain();
      } else if (type === 'wind') {
        this.generateWind();
      } else if (type === 'fireplace') {
        this.generateFireplace();
      } else if (type === 'night-forest') {
        this.generateNightForest();
      } else if (type === 'library') {
        this.generateLibrary();
      }
    } catch {
    }
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      if (typeof node === 'number') {
        clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
        }
      }
    });
    this.activeNodes = [];
    this.currentType = 'silence';
  }

  private generatePinkNoiseBuffer(seconds: number = 4): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private generateRain() {
    if (!this.ctx || !this.masterGain) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.generatePinkNoiseBuffer(5);
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    this.activeNodes.push(noise, filter, gain);
  }

  private generateWind() {
    if (!this.ctx || !this.masterGain) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.generatePinkNoiseBuffer(6);
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // LFO for slow breeze modulation
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    lfo.start();
    this.activeNodes.push(noise, filter, lfo, lfoGain, gain);
  }

  private generateFireplace() {
    if (!this.ctx || !this.masterGain) return;
    // Low rumble base
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(55, this.ctx.currentTime);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    rumble.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start();
    this.activeNodes.push(rumble, rumbleGain);

    // Crackle noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.generatePinkNoiseBuffer(4);
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);

    const crackleGain = this.ctx.createGain();
    crackleGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise, filter, crackleGain);
  }

  private generateNightForest() {
    if (!this.ctx || !this.masterGain) return;
    // Deep nocturnal air
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.generatePinkNoiseBuffer(6);
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
    this.activeNodes.push(noise, filter, gain);

    // Subtle cricket harmonic
    const cricket = this.ctx.createOscillator();
    cricket.type = 'triangle';
    cricket.frequency.setValueAtTime(4200, this.ctx.currentTime);

    const cricketGain = this.ctx.createGain();
    cricketGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    cricket.connect(cricketGain);
    cricketGain.connect(this.masterGain);
    cricket.start();
    this.activeNodes.push(cricket, cricketGain);
  }

  private generateLibrary() {
    if (!this.ctx || !this.masterGain) return;
    // Extremely subtle room resonance
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.activeNodes.push(osc, gain);
  }

  public getCurrentState() {
    return {
      type: this.currentType,
      isMuted: this.isMuted,
      volume: this.volume,
    };
  }
}

export const audioEngine = new SoundscapeEngine();
