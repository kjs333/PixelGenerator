import {
  ANIMATION_FRAME_COUNTS,
  ANIMATION_MAX_PIXELS,
  ANIMATION_MAX_SIZE,
  MAX_ACTION_LENGTH,
} from '../config/constants';

export type AnimationFrameCount = (typeof ANIMATION_FRAME_COUNTS)[number];

export type AnimationRequestError =
  'action-empty' | 'action-too-long' | 'bad-frame-count' | 'too-large';

export const isFrameCount = (value: unknown): value is AnimationFrameCount =>
  typeof value === 'number' && (ANIMATION_FRAME_COUNTS as readonly number[]).includes(value);

/** 이 크기의 그림으로 이만큼의 프레임을 만들 수 있는지(Pixellab 크기·픽셀 수 제한). */
export function fitsAnimationLimit(width: number, height: number, frameCount: number): boolean {
  return (
    width >= 1 &&
    height >= 1 &&
    width <= ANIMATION_MAX_SIZE &&
    height <= ANIMATION_MAX_SIZE &&
    width * height * frameCount <= ANIMATION_MAX_PIXELS
  );
}

/**
 * 애니메이션 요청 값을 검사한다. 문제가 없으면 null.
 * 창에서 버튼을 막을 때와 Netlify 함수에서 다시 검사할 때 같은 규칙을 쓴다.
 */
export function checkAnimationRequest(req: {
  width: number;
  height: number;
  frameCount: unknown;
  action: string;
}): AnimationRequestError | null {
  const action = req.action.trim();
  if (action.length === 0) return 'action-empty';
  if (action.length > MAX_ACTION_LENGTH) return 'action-too-long';
  if (!isFrameCount(req.frameCount)) return 'bad-frame-count';
  if (!fitsAnimationLimit(req.width, req.height, req.frameCount)) return 'too-large';
  return null;
}

/** Pixellab이 알려 준 요청 비용. 구독이면 생성분(generations), 아니면 달러(usd). */
export interface UsageCost {
  unit: 'usd' | 'generations';
  amount: number;
}

/** 한 번의 생성 요청 비용. 받지 못한 값은 null. */
export interface AnimationCost {
  generation: UsageCost | null;
  /** 설명 늘리기 비용. 요청하지 않았거나 청구되지 않았으면 null */
  enhance: UsageCost | null;
}

export const isUsageCost = (value: unknown): value is UsageCost =>
  typeof value === 'object' &&
  value !== null &&
  ((value as UsageCost).unit === 'usd' || (value as UsageCost).unit === 'generations') &&
  typeof (value as UsageCost).amount === 'number' &&
  Number.isFinite((value as UsageCost).amount) &&
  (value as UsageCost).amount >= 0;

/** 비용 숫자를 소수점 넷째 자리까지 보여 주고 뒤의 쓸모없는 0은 지운다. 예: 0.05, 1, 0.0123 */
export const formatAmount = (amount: number) => String(Number(amount.toFixed(4)));
