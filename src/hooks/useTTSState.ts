import { useEffect, useState } from 'react';
import { ttsEngine, type EngineState } from '@/tts/ttsEngine';

export function useTTSState(): EngineState {
  const [s, setS] = useState<EngineState>(ttsEngine.getState());
  useEffect(() => ttsEngine.subscribe(setS), []);
  return s;
}
