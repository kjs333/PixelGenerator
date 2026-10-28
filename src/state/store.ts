import type { ConvertOptions, PixelBuffer, RGBA } from '../core/types';

export type Step = 'start' | 'draw' | 'convert' | 'animate' | 'sheet';

export type NoticeCode =
  | 'empty'
  | 'too-large'
  | 'unsupported-type'
  | 'decode-failed'
  | 'resized'
  | 'convert-failed';

export interface Notice {
  kind: 'error' | 'info';
  code: NoticeCode;
}

export interface AppState {
  step: Step;
  source: PixelBuffer | null;
  convertOptions: ConvertOptions;
  converted: { image: PixelBuffer; palette: RGBA[] } | null;
  converting: boolean;
  notice: Notice | null;
}

export interface Store<T> {
  getState(): T;
  setState(patch: Partial<T>): void;
  subscribe(listener: (state: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T) => void>();
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      // 알림 도중 구독이 해지된 리스너는 건너뛴다
      for (const listener of [...listeners]) {
        if (listeners.has(listener)) listener(state);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const initialState: AppState = {
  step: 'start',
  source: null,
  convertOptions: { width: 32, height: 32, colors: 8, dither: 'none', cleanup: true },
  converted: null,
  converting: false,
  notice: null,
};
