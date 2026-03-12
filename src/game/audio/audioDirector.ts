import Phaser from 'phaser';
import type { CombatEffectAudioDefinition, CombatEffectAudioPhase, CombatEffectAudioProfileId } from '../core/combatEffects';

type MusicTrackId = 'title' | 'setup' | 'battle';
type BattleAmbienceId = 'day' | 'dusk' | 'night' | 'dawn';

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

type BattleAmbienceProfile = {
  droneInterval: number;
  droneType: OscillatorType;
  droneVolume: number;
  droneLowpass: number;
  droneDetune?: number;
  shimmerInterval: number;
  shimmerVolume: number;
  shimmerLowpass: number;
  noiseVolume: number;
  noiseLowpass: number;
  noiseRate: number;
};

const TITLE_TRACK: MusicTrack = {
  bpm: 62,
  steps: 16,
  bass: [43, null, null, 43, 50, null, null, 50, 48, null, null, 48, 45, null, null, 45],
  melody: [67, null, 70, null, 72, null, 74, null, 75, null, 74, null, 72, null, 70, null],
  accents: [0, 4, 8, 12],
  padRoots: [43, 50, 48, 45]
};

const SETUP_TRACK: MusicTrack = {
  bpm: 68,
  steps: 32,
  bass: [
    45,
    null,
    null,
    45,
    48,
    null,
    null,
    48,
    50,
    null,
    null,
    50,
    52,
    null,
    null,
    52,
    45,
    null,
    null,
    45,
    43,
    null,
    null,
    43,
    48,
    null,
    null,
    47,
    45,
    null,
    null,
    45
  ],
  melody: [
    69,
    null,
    72,
    null,
    74,
    null,
    72,
    null,
    76,
    null,
    74,
    null,
    72,
    null,
    69,
    null,
    67,
    null,
    69,
    null,
    71,
    null,
    72,
    null,
    74,
    null,
    72,
    null,
    71,
    null,
    69,
    null
  ],
  accents: [0, 4, 8, 12, 16, 20, 24, 28],
  padRoots: [45, 48, 50, 52, 45, 43, 48, 45]
};

const BATTLE_TRACK: MusicTrack = {
  bpm: 82,
  steps: 16,
  bass: [40, null, null, 40, 43, null, null, 47, 40, null, null, 43, 47, null, null, 45],
  melody: [64, null, 67, null, 71, null, 69, null, 72, null, 71, null, 69, null, 67, null],
  accents: [0, 4, 8, 12],
  padRoots: [40, 43, 47, 45]
};

const MUSIC_TRACKS: Record<MusicTrackId, MusicTrack> = {
  title: TITLE_TRACK,
  setup: SETUP_TRACK,
  battle: BATTLE_TRACK
};

const BATTLE_AMBIENCE_PROFILES: Record<BattleAmbienceId, BattleAmbienceProfile> = {
  day: {
    droneInterval: 12,
    droneType: 'sine',
    droneVolume: 0.01,
    droneLowpass: 920,
    shimmerInterval: 19,
    shimmerVolume: 0.007,
    shimmerLowpass: 2100,
    noiseVolume: 0.004,
    noiseLowpass: 2600,
    noiseRate: 0.28
  },
  dusk: {
    droneInterval: 7,
    droneType: 'triangle',
    droneVolume: 0.014,
    droneLowpass: 760,
    shimmerInterval: 15,
    shimmerVolume: 0.009,
    shimmerLowpass: 1780,
    noiseVolume: 0.005,
    noiseLowpass: 1900,
    noiseRate: 0.2
  },
  night: {
    droneInterval: 0,
    droneType: 'sine',
    droneVolume: 0.018,
    droneLowpass: 520,
    droneDetune: -8,
    shimmerInterval: 12,
    shimmerVolume: 0.006,
    shimmerLowpass: 1380,
    noiseVolume: 0.007,
    noiseLowpass: 1300,
    noiseRate: 0.12
  },
  dawn: {
    droneInterval: 12,
    droneType: 'triangle',
    droneVolume: 0.012,
    droneLowpass: 1040,
    shimmerInterval: 19,
    shimmerVolume: 0.01,
    shimmerLowpass: 2280,
    noiseVolume: 0.0045,
    noiseLowpass: 2400,
    noiseRate: 0.24
  }
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
  private battleAmbience: BattleAmbienceId = 'dusk';

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

  setBattleAmbience(ambience: BattleAmbienceId): void {
    this.battleAmbience = ambience;
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

  playCombatEffectPhase(
    audio: CombatEffectAudioDefinition,
    phase: CombatEffectAudioPhase,
    critical = false
  ): void {
    const detune =
      phase === 'telegraph'
        ? audio.telegraphDetune ?? 0
        : phase === 'travel'
          ? audio.travelDetune ?? 0
          : audio.impactDetune ?? 0;

    this.playCombatEffectProfile(audio.profile, phase, detune);

    if (phase === 'impact' && critical) {
      this.playNoise(0.08, 0.07, 980);
      this.playTone(104, 0.12, {
        type: 'triangle',
        volume: 0.075,
        release: 0.18,
        lowpass: 680,
        detune: detune + 6
      });
    }
  }

  playAttack(style: string): void {
    switch (style) {
      case 'arrow-flight':
      case 'feather-shot':
        this.playCombatEffectPhase({ profile: 'chrono-ranged' }, 'telegraph');
        break;
      case 'ember-burst':
        this.playCombatEffectPhase({ profile: 'burst-discharge' }, 'telegraph');
        break;
      case 'ash-hex':
        this.playCombatEffectPhase({ profile: 'psychic-sigil' }, 'telegraph');
        break;
      default:
        this.playCombatEffectPhase({ profile: 'sanctified-arc' }, 'telegraph');
        break;
    }
  }

  playHit(critical = false): void {
    this.playCombatEffectPhase({ profile: 'sanctified-arc' }, 'impact', critical);
  }

  playHeal(): void {
    this.playCombatEffectPhase({ profile: 'support-bloom' }, 'impact');
  }

  playSteal(): void {
    this.playCombatEffectPhase({ profile: 'utility-extract' }, 'impact');
  }

  playChest(): void {
    this.playTone(523.25, 0.08, { type: 'triangle', volume: 0.05, release: 0.08 });
    this.playTone(783.99, 0.12, { type: 'triangle', volume: 0.05, release: 0.12 }, 0.05);
    this.playTone(1046.5, 0.14, { type: 'triangle', volume: 0.04, release: 0.16 }, 0.1);
  }

  playVictory(): void {
    const trackId = this.getActiveMusicTrackId();
    const root = this.getActiveTrackRoot(trackId);

    this.duckMusicBed(0.92, 0.15);

    switch (trackId) {
      case 'setup':
        this.playStingerTone(root + 7, 0.12, { type: 'sine', volume: 0.045, release: 0.14 });
        this.playStingerTone(root + 12, 0.16, { type: 'triangle', volume: 0.055, release: 0.18 }, 0.08);
        this.playStingerTone(root + 16, 0.22, { type: 'sine', volume: 0.04, release: 0.2 }, 0.18);
        this.playStingerTone(root + 19, 0.3, { type: 'triangle', volume: 0.05, release: 0.28 }, 0.28);
        this.playNoise(0.04, 0.014, 2200, 0.02, 0.24);
        break;
      case 'battle':
        this.playStingerTone(root, 0.16, { type: 'sine', volume: 0.04, release: 0.14, lowpass: 480 });
        this.playStingerTone(root + 12, 0.16, { type: 'sawtooth', volume: 0.055, release: 0.16, lowpass: 1100 }, 0.02);
        this.playStingerTone(root + 19, 0.2, { type: 'sawtooth', volume: 0.05, release: 0.18, lowpass: 1180 }, 0.12);
        this.playStingerTone(root + 24, 0.28, { type: 'triangle', volume: 0.048, release: 0.26, lowpass: 1500 }, 0.24);
        this.playNoise(0.05, 0.018, 1900, 0.01, 0.2);
        this.playNoise(0.045, 0.014, 2400, 0.26, 0.3);
        break;
      case 'title':
      default:
        this.playStingerTone(root + 12, 0.18, { type: 'triangle', volume: 0.05, release: 0.2, lowpass: 1280 });
        this.playStingerTone(root + 15, 0.2, { type: 'sine', volume: 0.04, release: 0.22, lowpass: 1100 }, 0.1);
        this.playStingerTone(root + 19, 0.28, { type: 'triangle', volume: 0.042, release: 0.28, lowpass: 1380 }, 0.22);
        this.playStingerTone(root + 24, 0.34, { type: 'sine', volume: 0.03, release: 0.34, lowpass: 1520 }, 0.32);
        this.playNoise(0.035, 0.012, 1600, 0.04, 0.16);
        break;
    }
  }

  playDefeat(): void {
    const trackId = this.getActiveMusicTrackId();
    const root = this.getActiveTrackRoot(trackId);

    this.duckMusicBed(1.05, 0.12);

    switch (trackId) {
      case 'setup':
        this.playStingerTone(root + 12, 0.14, { type: 'sine', volume: 0.038, release: 0.16, lowpass: 1180 });
        this.playStingerTone(root + 7, 0.18, { type: 'triangle', volume: 0.042, release: 0.2, lowpass: 980 }, 0.08);
        this.playStingerTone(root + 2, 0.24, { type: 'sine', volume: 0.04, release: 0.24, lowpass: 860 }, 0.18);
        this.playStingerTone(root, 0.32, { type: 'triangle', volume: 0.032, release: 0.34, lowpass: 720 }, 0.32);
        this.playNoise(0.05, 0.012, 1200, 0.03, 0.14);
        break;
      case 'battle':
        this.playStingerTone(root + 12, 0.14, { type: 'sawtooth', volume: 0.05, release: 0.14, lowpass: 980 });
        this.playStingerTone(root + 10, 0.16, { type: 'sawtooth', volume: 0.045, release: 0.16, lowpass: 920 }, 0.08);
        this.playStingerTone(root + 7, 0.22, { type: 'triangle', volume: 0.042, release: 0.2, lowpass: 820 }, 0.18);
        this.playStingerTone(root, 0.28, { type: 'sine', volume: 0.032, release: 0.24, lowpass: 520 }, 0.3);
        this.playStingerTone(root - 5, 0.38, { type: 'triangle', volume: 0.036, release: 0.36, lowpass: 460 }, 0.42);
        this.playNoise(0.06, 0.018, 980, 0.02, 0.12);
        break;
      case 'title':
      default:
        this.playStingerTone(root + 7, 0.16, { type: 'triangle', volume: 0.042, release: 0.18, lowpass: 980 });
        this.playStingerTone(root + 3, 0.2, { type: 'sine', volume: 0.038, release: 0.22, lowpass: 860 }, 0.1);
        this.playStingerTone(root, 0.26, { type: 'triangle', volume: 0.032, release: 0.28, lowpass: 700 }, 0.22);
        this.playStingerTone(root - 5, 0.34, { type: 'sine', volume: 0.03, release: 0.34, lowpass: 560 }, 0.36);
        this.playNoise(0.045, 0.01, 1100, 0.04, 0.16);
        break;
    }
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

    const trackId = this.currentMusic;
    const track = MUSIC_TRACKS[trackId];
    const stepDuration = 60 / track.bpm / 2;

    while (this.nextNoteTime < this.context.currentTime + 0.24) {
      this.scheduleTrackStep(trackId, track, this.musicStep, this.nextNoteTime);
      this.nextNoteTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % track.steps;
    }

    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), 60);
  }

  private scheduleTrackStep(trackId: MusicTrackId, track: MusicTrack, step: number, time: number): void {
    const bassNote = track.bass[step];
    const melodyNote = track.melody[step];
    const root = track.padRoots[Math.floor(step / 4) % track.padRoots.length];
    const leadType: OscillatorType = trackId === 'battle' ? 'sawtooth' : trackId === 'setup' ? 'sine' : 'triangle';
    const leadVolume = trackId === 'title' ? 0.034 : trackId === 'setup' ? 0.024 : 0.035;
    const leadLowpass = trackId === 'title' ? 1180 : trackId === 'setup' ? 1280 : 1080;
    const leadRelease = trackId === 'title' ? 0.24 : trackId === 'setup' ? 0.18 : 0.16;
    const harmonyInterval = trackId === 'setup' ? 7 : trackId === 'title' ? -12 : 0;
    const harmonyVolume = trackId === 'battle' ? 0.012 : 0.014;

    if (step % 4 === 0) {
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

      if (trackId === 'battle') {
        this.playTone(midiToFrequency(bassNote - 5), 0.16, {
          bus: 'music',
          type: 'sawtooth',
          volume: 0.022,
          attack: 0.008,
          release: 0.12,
          lowpass: 680,
          detune: -6
        }, time - this.getCurrentTime());
      }
    }

    if (melodyNote !== null) {
      this.playTone(midiToFrequency(melodyNote), 0.24, {
        bus: 'music',
        type: leadType,
        volume: leadVolume,
        attack: 0.02,
        release: leadRelease,
        lowpass: leadLowpass,
        pan: step % 2 === 0 ? -0.12 : 0.12
      }, time - this.getCurrentTime());
      this.playTone(midiToFrequency(melodyNote + harmonyInterval), 0.2, {
        bus: 'music',
        type: 'sine',
        volume: harmonyVolume,
        attack: 0.02,
        release: 0.16,
        lowpass: 1500,
        pan: step % 2 === 0 ? 0.1 : -0.1
      }, time - this.getCurrentTime());
    }

    if (trackId === 'title' && melodyNote !== null && step % 8 === 6) {
      this.playTone(midiToFrequency(melodyNote - 12), 0.28, {
        bus: 'music',
        type: 'sine',
        volume: 0.012,
        attack: 0.03,
        release: 0.24,
        lowpass: 920,
        pan: step % 16 === 6 ? -0.08 : 0.08
      }, time - this.getCurrentTime());
    }

    if (trackId === 'setup' && step % 8 === 4) {
      this.playTone(midiToFrequency(root + 19), 0.26, {
        bus: 'music',
        type: 'triangle',
        volume: 0.014,
        attack: 0.01,
        release: 0.32,
        lowpass: 1720,
        pan: step % 16 === 4 ? -0.18 : 0.18
      }, time - this.getCurrentTime());
    }

    if (trackId === 'battle' && step % 2 === 1) {
      this.playNoise(0.024, 0.01, 2400, time - this.getCurrentTime(), 0.32, 'music');
    }

    if (trackId === 'battle' && step % 4 === 2) {
      this.playTone(midiToFrequency(root - 12), 0.1, {
        bus: 'music',
        type: 'square',
        volume: 0.018,
        attack: 0.004,
        release: 0.06,
        lowpass: 900
      }, time - this.getCurrentTime());
    }

    if (trackId === 'battle') {
      this.scheduleBattleAmbience(root, step, time);
    }

    if (track.accents.includes(step)) {
      this.playNoise(
        0.035,
        trackId === 'title' ? 0.011 : trackId === 'setup' ? 0.012 : 0.018,
        trackId === 'title' ? 1500 : trackId === 'setup' ? 1450 : 1800,
        time - this.getCurrentTime(),
        trackId === 'title' ? 0.16 : trackId === 'setup' ? 0.18 : 0.22,
        'music'
      );
    }
  }

  private getCurrentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  private scheduleBattleAmbience(root: number, step: number, time: number): void {
    const profile = BATTLE_AMBIENCE_PROFILES[this.battleAmbience];
    const delay = time - this.getCurrentTime();

    if (step % 8 === 0) {
      this.playTone(midiToFrequency(root + profile.droneInterval), 1.5, {
        bus: 'music',
        type: profile.droneType,
        volume: profile.droneVolume,
        attack: 0.08,
        release: 0.42,
        lowpass: profile.droneLowpass,
        detune: profile.droneDetune,
        pan: step % 16 === 0 ? -0.18 : 0.18
      }, delay);
    }

    if (step % 8 === 4) {
      this.playTone(midiToFrequency(root + profile.shimmerInterval), 0.34, {
        bus: 'music',
        type: 'sine',
        volume: profile.shimmerVolume,
        attack: 0.04,
        release: 0.28,
        lowpass: profile.shimmerLowpass,
        pan: step % 16 === 4 ? 0.16 : -0.16
      }, delay);
    }

    if (step % 4 === 0) {
      this.playNoise(0.11, profile.noiseVolume, profile.noiseLowpass, delay, profile.noiseRate, 'music');
    }
  }

  private getActiveMusicTrackId(): MusicTrackId {
    return this.currentMusic ?? this.desiredMusic ?? 'title';
  }

  private getActiveTrackRoot(trackId: MusicTrackId): number {
    const track = MUSIC_TRACKS[trackId];
    const padIndex = Math.floor(this.musicStep / 4) % track.padRoots.length;

    return track.padRoots[padIndex] ?? track.padRoots[0];
  }

  private duckMusicBed(holdDuration: number, targetGain: number): void {
    if (!this.musicGain) {
      return;
    }

    const context = this.context ?? this.ensureContext();
    const now = context.currentTime;
    const baseGain = 0.34;

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
    this.musicGain.gain.setValueAtTime(targetGain, now + holdDuration);
    this.musicGain.gain.linearRampToValueAtTime(baseGain, now + holdDuration + 0.28);
  }

  private playStingerTone(note: number, duration: number, options: Omit<VoiceOptions, 'bus'>, delay = 0): void {
    this.playTone(midiToFrequency(note), duration, { ...options, bus: 'sfx' }, delay);
  }

  private playCombatEffectProfile(
    profile: CombatEffectAudioProfileId,
    phase: CombatEffectAudioPhase,
    detune = 0
  ): void {
    switch (profile) {
      case 'sanctified-arc':
        if (phase === 'telegraph') {
          this.playTone(186, 0.06, { type: 'sawtooth', volume: 0.055, release: 0.08, lowpass: 1260, detune });
          this.playTone(292, 0.05, { type: 'triangle', volume: 0.03, release: 0.06, lowpass: 1820, detune }, 0.02);
          return;
        }

        if (phase === 'impact') {
          this.playNoise(0.07, 0.055, 1040);
          this.playTone(96, 0.08, { type: 'triangle', volume: 0.055, release: 0.12, lowpass: 760, detune });
          this.playTone(168, 0.05, { type: 'square', volume: 0.024, release: 0.06, lowpass: 1240, detune }, 0.01);
        }
        return;
      case 'chrono-ranged':
        if (phase === 'telegraph') {
          this.playTone(820, 0.05, { type: 'square', volume: 0.048, release: 0.08, lowpass: 2300, detune });
          this.playNoise(0.035, 0.022, 2800);
          return;
        }

        if (phase === 'travel') {
          this.playTone(1120, 0.06, { type: 'triangle', volume: 0.03, release: 0.08, lowpass: 2600, detune });
          return;
        }

        if (phase === 'impact') {
          this.playNoise(0.045, 0.03, 2200);
          this.playTone(178, 0.06, { type: 'triangle', volume: 0.04, release: 0.08, lowpass: 1200, detune });
        }
        return;
      case 'burst-discharge':
        if (phase === 'telegraph') {
          this.playTone(238, 0.11, { type: 'sawtooth', volume: 0.058, release: 0.18, lowpass: 1080, detune });
          this.playNoise(0.09, 0.03, 1450);
          return;
        }

        if (phase === 'travel') {
          this.playTone(296, 0.08, { type: 'triangle', volume: 0.035, release: 0.1, lowpass: 1320, detune });
          return;
        }

        if (phase === 'impact') {
          this.playNoise(0.08, 0.04, 1320);
          this.playTone(132, 0.08, { type: 'triangle', volume: 0.05, release: 0.12, lowpass: 780, detune });
        }
        return;
      case 'psychic-sigil':
        if (phase === 'telegraph') {
          this.playTone(466.16, 0.08, { type: 'sine', volume: 0.032, release: 0.1, lowpass: 1550, detune: detune - 8 });
          this.playTone(554.37, 0.1, { type: 'triangle', volume: 0.026, release: 0.12, lowpass: 1720, detune: detune + 4 }, 0.03);
          return;
        }

        if (phase === 'impact') {
          this.playNoise(0.06, 0.028, 1500, 0, 0.65);
          this.playTone(164.81, 0.1, { type: 'sine', volume: 0.04, release: 0.16, lowpass: 900, detune: detune - 10 });
          this.playTone(329.63, 0.12, { type: 'triangle', volume: 0.028, release: 0.14, lowpass: 1400, detune: detune + 12 }, 0.02);
        }
        return;
      case 'temporal-rend':
        if (phase === 'telegraph') {
          this.playTone(392, 0.06, { type: 'sine', volume: 0.038, release: 0.1, lowpass: 1880, detune: detune - 6 });
          this.playTone(783.99, 0.05, { type: 'square', volume: 0.028, release: 0.08, lowpass: 2200, detune: detune + 10 }, 0.02);
          return;
        }

        if (phase === 'travel') {
          this.playTone(659.25, 0.08, { type: 'triangle', volume: 0.03, release: 0.1, lowpass: 2100, detune });
          this.playNoise(0.04, 0.016, 2300, 0, 0.82);
          return;
        }

        if (phase === 'impact') {
          this.playNoise(0.07, 0.03, 1760, 0, 0.72);
          this.playTone(130.81, 0.09, { type: 'triangle', volume: 0.048, release: 0.14, lowpass: 760, detune });
          this.playTone(523.25, 0.08, { type: 'sine', volume: 0.022, release: 0.12, lowpass: 1720, detune: detune + 14 }, 0.02);
        }
        return;
      case 'support-bloom':
        if (phase === 'telegraph') {
          this.playTone(659.25, 0.06, { type: 'sine', volume: 0.04, release: 0.1, lowpass: 1800, detune });
          this.playTone(783.99, 0.08, { type: 'triangle', volume: 0.034, release: 0.12, lowpass: 1920, detune }, 0.04);
          return;
        }

        if (phase === 'travel') {
          this.playTone(880, 0.06, { type: 'sine', volume: 0.026, release: 0.08, lowpass: 2100, detune });
          return;
        }

        if (phase === 'impact') {
          this.playTone(659.25, 0.08, { type: 'sine', volume: 0.05, release: 0.12, lowpass: 1900, detune });
          this.playTone(783.99, 0.1, { type: 'sine', volume: 0.045, release: 0.15, lowpass: 2100, detune }, 0.05);
          this.playTone(987.77, 0.12, { type: 'triangle', volume: 0.04, release: 0.16, lowpass: 2300, detune }, 0.1);
        }
        return;
      case 'utility-extract':
        if (phase === 'telegraph') {
          this.playTone(698.46, 0.05, { type: 'square', volume: 0.042, release: 0.08, lowpass: 1800, detune });
          return;
        }

        if (phase === 'travel') {
          this.playTone(932.33, 0.06, { type: 'triangle', volume: 0.03, release: 0.08, lowpass: 2200, detune }, 0.01);
          return;
        }

        if (phase === 'impact') {
          this.playTone(698.46, 0.06, { type: 'square', volume: 0.05, release: 0.08, lowpass: 1800, detune });
          this.playTone(1046.5, 0.08, { type: 'triangle', volume: 0.045, release: 0.1, lowpass: 2200, detune }, 0.04);
        }
        return;
      case 'item-use':
        if (phase === 'telegraph') {
          this.playTone(523.25, 0.05, { type: 'sine', volume: 0.034, release: 0.08, lowpass: 1600, detune });
          return;
        }

        if (phase === 'travel') {
          this.playTone(783.99, 0.05, { type: 'triangle', volume: 0.026, release: 0.08, lowpass: 1900, detune });
          return;
        }

        if (phase === 'impact') {
          this.playTone(587.33, 0.08, { type: 'sine', volume: 0.042, release: 0.1, lowpass: 1800, detune });
          this.playTone(880, 0.1, { type: 'triangle', volume: 0.036, release: 0.14, lowpass: 2100, detune }, 0.04);
        }
        return;
      default:
        return;
    }
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
