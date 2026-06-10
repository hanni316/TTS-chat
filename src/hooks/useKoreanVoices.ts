import { useEffect, useState } from 'react';
import { ttsEngine } from '@/tts/ttsEngine';

export function useKoreanVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    let active = true;
    ttsEngine.listVoices('ko').then((v) => {
      if (active) setVoices(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return voices;
}
