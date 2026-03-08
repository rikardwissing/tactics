import Phaser from 'phaser';

type MusicTrackId = 'title' | 'battle';

type MusicTrack = {
  bpm: number;
  steps: number;
  bass: Array<number | null>;
  melody: Array<number | null>;
  accents: number[];
  padRoots: number[];
};

type VoiceOptions = {
  bus?: 'music' | 'sfx';
  type?: OscillatorType;
  volume?: number;
  attack?: number;
  release?: number;
  pan?: number;
  detune?: number;
  lowpass?: number;
};

const TITLE_TRACK: MusicTrack = {
  bpm: 62,
  steps: 16,
  bass: [43, null, null, 43, 50, null, null, 50, 48, null, null, 48, 45, null, null, 45],
  melody: [67, null, 70, null, 72, null, 74, null, 75, null, 74, null, 72, null, 70, null],
  accents: [0, 4, 8, 12],
  padRoots: [43, 50, 48, 45]
};

const BATTLE_TRACK: MusicTrack = {
  bpm: 82,
  steps: 16,
  bass: [40, null, null, 40, 43, null, null, 47, 40, null, null, 43, 47, null, null, 45],
  melody: [64, null, 67, null, 71, null, 69, null, 72, null, 71, null, 69, null, 67, null],
  accents: [0, 4, 8, 12],
  padRoots: [40, 43, 47, 45]
};

function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

class AudioDirector {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private currentMusic: MusicTrackId | null = null;
  private desiredMusic: MusicTrackId | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private musicStep = 0;
  private muted = false;

  bindScene(scene: Phaser.Scene): void {
    const unlock = () => {
      void this.unlock();
    };

    scene.input.on('pointerdown', unlock);
    scene.input.keyboard?.on('keydown', unlock);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', unlock);
      scene.input.keyboard?.off('keydown', unlock);
    });
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (this.desiredMusic && this.currentMusic !== this.desiredMusic) {
      this.startMusic(this.desiredMusic);
    }
  }

  setMusic(track: MusicTrackId | null): void {
    this.desiredMusic = track;

    if (!track) {
      this.stopMusic();
      return;
    }

    if (this.context?.state === 'running') {
      this.startMusic(track);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;

    if (this.masterGain) {
      const now = this.context?.currentTime ?? 0;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.muted ? 0 : 0.82, now + 0.05);
    }

    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playUiMove(): void {
    this.playTone(740, 0.06, { type: 'triangle', volume: 0.05, release: 0.08 });
  }

  playUiConfirm(): void {
    this.playTone(523.25, 0.08, { type: 'triangle', volume: 0.06, release: 0.08 });
    this.playTone(659.25, 0.1, { type: 'triangle', volume: 0.05, release: 0.1 }, 0.05);
  }

  playUiCancel(): void {
    this.playTone(392, 0.08, { type: 'sine', volume: 0.05, release: 0.1 });
    this.playTone(329.63, 0.1, { type: 'sine', volume: 0.04, release: 0.12 }, 0.04);
  }

  playTurnStart(team: 'player' | 'enemy'): void {
    if (team === 'player') {
      this.playTone(783.99, 0.09, { type: 'triangle', volume: 0.06, release: 0.1 });
      this.playTone(987.77, 0.11, { type: 'triangle', volume: 0.05, release: 0.12 }, 0.06);
      return;
    }

    this.playTone(261.63, 0.11, { type: 'sawtooth', volume: 0.04, release: 0.12, lowpass: 920 });
    this.playTone(220, 0.14, { type: 'sawtooth', volume: 0.035, release: 0.15, lowpass: 760 }, 0.05);
  }

  playStep(): void {
    this.playTone(120, 0.03, { type: 'triangle', volume: 0.035, release: 0.05, lowpass: 600 });
    this.playNoise(0.02, 0.02, 1800);
  }

  playAttack(style: string): void {
    switch (style) {
      case 'arrow-flight':
      case 'feather-shot':
        this.playTone(820, 0.05, { type: 'square', volume: 0.05, release: 0.08, lowpass: 2400 });
        this.playNoise(0.04, 0.025, 2800);
        break;
      case 'ember-burst':
      case 'ash-hex':
        this.playTone(240, 0.12, { type: 'sawtooth', volume: 0.06, release: 0.18, lowpass: 1100 });
        this.playNoise(0.1, 0.04, 1400);
        break;
      default:
        this.playTone(180, 0.06, { type: 'sawtooth', volume: 0.06, release: 0.08, lowpass: 1400 });
        this.playTone(280, 0.05, { type: 'square', volume: 0.03, release: 0.06 }, 0.02);
        break;
    }
  }

  playHit(critical = false): void {
    this.playNoise(0.09, critical ? 0.08 : 0.05, 1100);
    this.playTone(critical ? 110 : 92, critical ? 0.12 : 0.08, {
      type: 'triangle',
      volume: critical ? 0.08 : 0.055,
      release: critical ? 0.18 : 0.12,
      lowpass: 720
    });
  }

  playHeal(): void {
    this.playTone(659.25, 0.08, { type: 'sine', volume: 0.05, release: 0.12 });
    this.playTone(783.99, 0.1, { type: 'sine', volume: 0.045, release: 0.15 }, 0.05);
    this.playTone(987.77, 0.12, { type: 'triangle', volume: 0.04, release: 0.16 }, 0.1);
  }

  playSteal(): void {
    this.playTone(698.46, 0.06, { type: 'square', volume: 0.05, release: 0.08, lowpass: 1800 });
    this.playTone(1046.5, 0.08, { type: 'triangle', volume: 0.045, release: 0.1 }, 0.04);
  }

  playChest(): void {
    this.playTone(523.25, 0.08, { type: 'triangle', volume: 0.05, release: 0.08 });
    this.playTone(783.99, 0.12, { type: 'triangle', volume: 0.05, release: 0.12 }, 0.05);
    this.playTone(1046.5, 0.14, { type: 'triangle', volume: 0.04, release: 0.16 }, 0.1);
  }

  playVictory(): void {
    this.playTone(523.25, 0.18, { type: 'triangle', volume: 0.06, release: 0.2 });
    this.playTone(659.25, 0.2, { type: 'triangle', volume: 0.055, release: 0.22 }, 0.1);
    this.playTone(783.99, 0.24, { type: 'triangle', volume: 0.05, release: 0.26 }, 0.2);
  }

  playDefeat(): void {
    this.playTone(329.63, 0.14, { type: 'sawtooth', volume: 0.05, release: 0.16, lowpass: 900 });
    this.playTone(246.94, 0.2, { type: 'sawtooth', volume: 0.045, release: 0.22, lowpass: 760 }, 0.08);
    this.playTone(196, 0.26, { type: 'triangle', volume: 0.04, release: 0.3, lowpass: 620 }, 0.16);
  }

  private ensureContext(): AudioContext {
    if (this.context && this.masterGain && this.musicGain && this.sfxGain) {
      return this.context;
    }

    const AudioContextCtor = window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error('Web Audio is not supported in this browser.');
    }

    this.context = new AudioContextCtor();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.82;
    this.musicGain.gain.value = 0.34;
    this.sfxGain.gain.value = 0.75;
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer(this.context);

    return this.context;
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 0.35, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private startMusic(trackId: MusicTrackId): void {
    const context = this.ensureContext();

    if (this.currentMusic === trackId && this.musicTimer !== null) {
      return;
    }

    this.stopMusic();
    this.currentMusic = trackId;
    this.musicStep = 0;
    this.nextNoteTime = context.currentTime + 0.04;
    this.scheduleMusic();
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }

    this.currentMusic = null;
  }

  private scheduleMusic(): void {
    if (!this.context || !this.musicGain || !this.currentMusic) {
      return;
    }

    const track = this.currentMusic === 'title' ? TITLE_TRACK : BATTLE_TRACK;
    const stepDuration = 60 / track.bpm / 2;

    while (this.nextNoteTime < this.context.currentTime + 0.24) {
      this.scheduleTrackStep(track, this.musicStep, this.nextNoteTime);
      this.nextNoteTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % track.steps;
    }

    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), 60);
  }

  private scheduleTrackStep(track: MusicTrack, step: number, time: number): void {
    const bassNote = track.bass[step];
    const melodyNote = track.melody[step];

    if (step % 4 === 0) {
      const root = track.padRoots[(step / 4) % track.padRoots.length];
      this.playTone(midiToFrequency(root), 1.05, {
        bus: 'music',
        type: 'triangle',
        volume: 0.034,
        attack: 0.03,
        release: 0.42,
        lowpass: 820
      }, time - this.getCurrentTime());
      this.playTone(midiToFrequency(root + 7), 0.96, {
        bus: 'music',
        type: 'sine',
        volume: 0.026,
        attack: 0.03,
        release: 0.38,
        lowpass: 960
      }, time - this.getCurrentTime());
      this.playTone(midiToFrequency(root + 12), 0.88, {
        bus: 'music',
        type: 'sine',
        volume: 0.018,
        attack: 0.04,
        release: 0.34,
        lowpass: 1200,
        pan: 0.08
      }, time - this.getCurrentTime());
    }

    if (bassNote !== null) {
      this.playTone(midiToFrequency(bassNote), 0.26, {
        bus: 'music',
        type: 'triangle',
        volume: 0.055,
        attack: 0.01,
        release: 0.2,
        lowpass: 620
      }, time - this.getCurrentTime());
      this.playTone(midiToFrequency(bassNote - 12), 0.22, {
        bus: 'music',
        type: 'sine',
        volume: 0.03,
        attack: 0.01,
        release: 0.18,
        lowpass: 420
      }, time - this.getCurrentTime());
    }

    if (melodyNote !== null) {
      this.playTone(midiToFrequency(melodyNote), 0.24, {
        bus: 'music',
        type: track === TITLE_TRACK ? 'triangle' : 'sawtooth',
        volume: track === TITLE_TRACK ? 0.038 : 0.032,
        attack: 0.02,
        release: 0.18,
        lowpass: track === TITLE_TRACK ? 1450 : 1180,
        pan: step % 2 === 0 ? -0.12 : 0.12
      }, time - this.getCurrentTime());
      this.playTone(midiToFrequency(melodyNote + (track === TITLE_TRACK ? 12 : 0)), 0.2, {
        bus: 'music',
        type: 'sine',
        volume: track === TITLE_TRACK ? 0.018 : 0.014,
        attack: 0.02,
        release: 0.16,
        lowpass: 1500,
        pan: step % 2 === 0 ? 0.1 : -0.1
      }, time - this.getCurrentTime());
    }

    if (track.accents.includes(step)) {
      this.playNoise(0.035, 0.016, 1800, time - this.getCurrentTime(), 0.22, 'music');
    }
  }

  private getCurrentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  private playTone(frequency: number, duration: number, options: VoiceOptions, delay = 0): void {
    if (this.muted) {
      return;
    }

    const context = this.ensureContext();
    const destination = options.bus === 'music' ? this.musicGain : this.sfxGain;

    if (!destination) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime + Math.max(0, delay);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = options.lowpass ?? 2200;
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);

    if (options.detune) {
      oscillator.detune.setValueAtTime(options.detune, now);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(options.volume ?? 0.05, now + (options.attack ?? 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + (options.release ?? 0.1));

    panner.pan.value = options.pan ?? 0;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(destination);

    oscillator.start(now);
    oscillator.stop(now + duration + (options.release ?? 0.1) + 0.02);
  }

  private playNoise(
    duration: number,
    volume: number,
    lowpass: number,
    delay = 0,
    playbackRate = 1,
    bus: 'music' | 'sfx' = 'sfx'
  ): void {
    if (this.muted) {
      return;
    }

    const context = this.ensureContext();

    const destination = bus === 'music' ? this.musicGain : this.sfxGain;

    if (!this.noiseBuffer || !destination) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime + Math.max(0, delay);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = this.noiseBuffer;
    source.playbackRate.value = playbackRate;
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}

export const audioDirector = new AudioDirector();
