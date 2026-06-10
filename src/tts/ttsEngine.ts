// TTS engine
// ----------
// Web Speech API-based engine with:
// - A FIFO queue (planning §4)
// - Per-sender voice assignment for group chats
// - Pause / resume / clear-queue controls
// - Text preprocessing (URL/emoji/jamo-repeat/profanity mask) via ttsTransforms
// - Robust against Chrome bug where speechSynthesis pauses after ~15s of speech

import { prepareForSpeech } from '@/lib/ttsTransforms';
import type { AppSettings, ID } from '@/types';

export interface SpeakRequest {
  text: string;
  senderId?: ID;
  senderName?: string; // for "○○님:" prefix in groups
  announceSender?: boolean;
  voiceHint?: string; // explicit voiceURI override
}

interface InternalItem {
  id: number;
  segments: string[];
  voiceURI?: string;
  settings: AppSettings;
}

export type EngineState = {
  speaking: boolean;
  paused: boolean;
  queueLength: number;
  currentText: string | null;
};

type Listener = (s: EngineState) => void;

class TTSEngine {
  private synth: SpeechSynthesis | null;
  private queue: InternalItem[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private current: InternalItem | null = null;
  private nextId = 1;
  private listeners = new Set<Listener>();
  private voices: SpeechSynthesisVoice[] = [];
  private voicesReady: Promise<SpeechSynthesisVoice[]>;
  private keepAliveTimer: number | null = null;

  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voicesReady = this.loadVoices();
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (!this.synth) return resolve([]);
      const tryNow = () => {
        const v = this.synth!.getVoices();
        if (v.length > 0) {
          this.voices = v;
          resolve(v);
          return true;
        }
        return false;
      };
      if (tryNow()) return;
      const handler = () => {
        if (tryNow()) {
          this.synth!.removeEventListener('voiceschanged', handler);
        }
      };
      this.synth.addEventListener('voiceschanged', handler);
      // Some browsers (Safari) never emit voiceschanged; poll briefly.
      let tries = 0;
      const iv = window.setInterval(() => {
        if (tryNow() || ++tries > 20) {
          window.clearInterval(iv);
          this.synth!.removeEventListener('voiceschanged', handler);
        }
      }, 250);
    });
  }

  get supported(): boolean {
    return !!this.synth;
  }

  async listVoices(lang = 'ko'): Promise<SpeechSynthesisVoice[]> {
    const v = await this.voicesReady;
    return v.filter((x) => x.lang.toLowerCase().startsWith(lang.toLowerCase()));
  }

  /** Stable pick: same senderId always gets the same voice from the koreanVoices pool. */
  pickVoiceForSender(senderId: ID, koreanVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (koreanVoices.length === 0) return null;
    let h = 0;
    for (let i = 0; i < senderId.length; i++) {
      h = (h * 31 + senderId.charCodeAt(i)) >>> 0;
    }
    return koreanVoices[h % koreanVoices.length];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }
  getState(): EngineState {
    return {
      speaking: !!this.currentUtterance,
      paused: this.synth?.paused ?? false,
      queueLength: this.queue.length,
      currentText: this.current?.segments.join(' ') ?? null,
    };
  }
  private emit() {
    const s = this.getState();
    for (const fn of this.listeners) fn(s);
  }

  async speak(req: SpeakRequest, settings: AppSettings): Promise<void> {
    if (!this.synth) return;
    if (settings.globalMuted) return;

    const prefix =
      req.announceSender !== false && settings.announceSender && req.senderName
        ? `${req.senderName}님, `
        : '';
    const prepared = prepareForSpeech(req.text, settings);
    if (prepared.segments.every((s) => !s.trim())) return;
    const segments =
      prefix && prepared.segments.length > 0
        ? [prefix + prepared.segments[0], ...prepared.segments.slice(1)]
        : prepared.segments;

    let voiceURI = req.voiceHint ?? settings.voiceURI;
    if (!voiceURI && req.senderId) {
      const koreanVoices = await this.listVoices('ko');
      const v = this.pickVoiceForSender(req.senderId, koreanVoices);
      voiceURI = v?.voiceURI;
    }

    this.queue.push({
      id: this.nextId++,
      segments,
      voiceURI,
      settings,
    });
    this.emit();
    this.pump();
  }

  private pump() {
    if (!this.synth || this.currentUtterance) return;
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.emit();
      return;
    }
    this.current = next;
    this.speakSegments(next, 0);
  }

  private speakSegments(item: InternalItem, idx: number) {
    if (!this.synth) return;
    if (idx >= item.segments.length) {
      this.currentUtterance = null;
      this.startKeepAlive(false);
      this.pump();
      return;
    }
    const u = new SpeechSynthesisUtterance(item.segments[idx]);
    u.lang = item.settings.language;
    u.rate = item.settings.rate;
    u.volume = item.settings.volume;
    if (item.voiceURI) {
      const v = this.voices.find((x) => x.voiceURI === item.voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => this.speakSegments(item, idx + 1);
    u.onerror = () => this.speakSegments(item, idx + 1);
    this.currentUtterance = u;
    this.emit();
    this.startKeepAlive(true);
    if (this.synth.paused) this.synth.resume();
    this.synth.speak(u);
  }

  // Chrome silently pauses speechSynthesis after ~15s. Tap pause/resume to keep it alive.
  private startKeepAlive(on: boolean) {
    if (this.keepAliveTimer) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (!on || !this.synth) return;
    this.keepAliveTimer = window.setInterval(() => {
      if (!this.synth) return;
      if (this.synth.speaking && !this.synth.paused) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10_000);
  }

  pause() {
    this.synth?.pause();
    this.emit();
  }
  resume() {
    this.synth?.resume();
    this.emit();
  }
  clearQueue() {
    this.queue = [];
    if (this.synth?.paused) this.synth.resume();
    this.synth?.cancel();
    this.currentUtterance = null;
    this.current = null;
    this.startKeepAlive(false);
    this.emit();
  }
}

export const ttsEngine = new TTSEngine();
