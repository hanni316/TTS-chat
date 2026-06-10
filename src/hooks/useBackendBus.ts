import { useEffect, useState } from 'react';
import { backend } from '@/services/backend';
import type { ServerEvent } from '@/types';

/** Subscribe to backend events; returns a counter that bumps on every event. */
export function useBackendBus(filter?: (e: ServerEvent) => boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    return backend.subscribe((e) => {
      if (!filter || filter(e)) setTick((t) => t + 1);
    });
  }, [filter]);
  return tick;
}
