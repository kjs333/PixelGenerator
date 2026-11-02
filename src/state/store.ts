import type { AnimationCost, AnimationFrameCount } from '../core/animation';
import type { ConvertOptions, PixelBuffer, RGBA } from '../core/types';

/** home: 두 갈래 고르기, start: 변환 시작(올리기/그리기), animate: 픽셀 그림 올리기 */
export type Step = 'home' | 'start' | 'draw' | 'convert' | 'edit' | 'animate' | 'sheet';

/** convert: 사진·그림을 픽셀로 변환하는 경로, animate: 픽셀 그림을 바로 애니메이션으로 만드는 경로 */
export type Mode = 'convert' | 'animate';

export type NoticeCode =
  | 'empty'
  | 'too-large'
  | 'unsupported-type'
  | 'decode-failed'
  | 'resized'
  | 'convert-failed'
  | 'saved'
  | 'save-failed'
  | 'ai-failed'
  | 'ai-timeout'
  | 'ai-no-credits'
  | 'ai-busy'
  | 'ai-rejected'
  | 'ai-not-configured'
  | 'not-pixel-art-size'
  | 'not-pixel-art-colors';

export interface Notice {
  kind: 'error' | 'info';
  code: NoticeCode;
  /** 문구 뒤에 덧붙이는 값(예: 잔액) */
  detail?: string;
}

/** AI로 만든 애니메이션. 스프라이트 시트 화면이 그린다. */
export interface Animation {
  /** 애니메이션에 쓴 픽셀 결과(첫 프레임). "다시 애니메이션 생성"도 이 그림으로 만든다. */
  source: PixelBuffer;
  action: string;
  frameCount: AnimationFrameCount;
  /** 배경을 지운(투명) 프레임으로 만들었는지 */
  transparent: boolean;
  /** Pixellab에 동작 설명을 자세하게 늘려 달라고 했는지 */
  enhance: boolean;
  /** Pixellab이 늘린 설명. 요청하지 않았거나 받지 못했으면 null */
  enhancedPrompt: string | null;
  /** Pixellab이 알려 준 이번 요청 비용. 생성 시작 응답을 받기 전이면 null */
  cost: AnimationCost | null;
  /** 받은 프레임. 직접 고치면 여기가 바뀌고, 미리보기도 이 목록을 읽는다. 아직 없으면 빈 배열. */
  frames: PixelBuffer[];
  /** 만드는 중이면 시작 시각(ms), 아니면 null */
  startedAt: number | null;
}

export interface AppState {
  step: Step;
  mode: Mode;
  source: PixelBuffer | null;
  convertOptions: ConvertOptions;
  converted: { image: PixelBuffer; palette: RGBA[] } | null;
  converting: boolean;
  /** 변환 결과를 직접 고쳤는지. 다시 변환하면 고친 내용이 사라지므로 확인 창을 띄우는 데 쓴다. */
  edited: boolean;
  /** AI(Pixellab) 요청을 기다리는 중인지. 기다리는 동안 버튼을 막는다. */
  aiBusy: boolean;
  animation: Animation | null;
  /** 애니메이션 경로에서 올린 픽셀 그림. 확인을 통과하면 원래 크기로 줄인 그림으로 바뀐다. */
  pixelArt: PixelBuffer | null;
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
  step: 'home',
  mode: 'convert',
  source: null,
  convertOptions: { width: 32, height: 32, colors: 8, dither: 'none', cleanup: false },
  converted: null,
  converting: false,
  edited: false,
  aiBusy: false,
  animation: null,
  pixelArt: null,
  notice: null,
};
