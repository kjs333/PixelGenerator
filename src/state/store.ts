import type { ConvertOptions, PixelBuffer, RGBA } from '../core/types';

export type Step = 'start' | 'draw' | 'convert' | 'edit' | 'animate' | 'sheet';

export type NoticeCode =
  | 'empty'
  | 'too-large'
  | 'unsupported-type'
  | 'decode-failed'
  | 'resized'
  | 'convert-failed'
  | 'saved'
  | 'save-failed';

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
  /** 변환 결과를 직접 고쳤는지. 다시 변환하면 고친 내용이 사라지므로 확인 창을 띄우는 데 쓴다. */
  edited: boolean;
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
  convertOptions: { width: 32, height: 32, colors: 8, dither: 'none', cleanup: false },
  converted: null,
  converting: false,
  edited: false,
  notice: null,
};
