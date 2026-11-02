// Netlify 함수에서 쓰는 애니메이션 요청 검사와 Pixellab 응답 해석. 네트워크를 쓰지 않아 테스트할 수 있다.
import {
  checkAnimationRequest,
  type AnimationCost,
  type AnimationFrameCount,
  type UsageCost,
} from '../../src/core/animation';
import { base64ToBytes, pngSize } from '../../src/io/base64';

const MAX_IMAGE_BASE64 = 1_000_000; // 256×256 PNG는 이보다 훨씬 작다. 큰 본문을 미리 막는다.
const MAX_FRAME_BASE64 = 2_000_000;
const JOB_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_ENHANCED_PROMPT = 2000; // Pixellab이 늘린 설명을 브라우저로 넘길 때 최대 글자 수

export interface AnimateInput {
  /** PNG base64(머리말 없음) */
  image: string;
  action: string;
  frameCount: AnimationFrameCount;
  /** 배경을 지운(투명) 프레임을 받을지 */
  transparent: boolean;
  /** Pixellab이 동작 설명을 자세하게 늘려서 쓸지(추가 비용) */
  enhance: boolean;
}

export type AnimateParse = { ok: true; value: AnimateInput } | { ok: false; error: string };

/** 브라우저가 보낸 본문을 다시 검사한다. 브라우저 검사만 믿지 않는다. */
export function parseAnimateBody(body: unknown): AnimateParse {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'bad-body' };
  const {
    image,
    action,
    frameCount,
    transparent = false,
    enhance = false,
  } = body as Record<string, unknown>;
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64) {
    return { ok: false, error: 'bad-image' };
  }
  if (typeof action !== 'string') return { ok: false, error: 'action-empty' };
  if (typeof transparent !== 'boolean' || typeof enhance !== 'boolean')
    return { ok: false, error: 'bad-body' };

  let size: ReturnType<typeof pngSize>;
  try {
    size = pngSize(base64ToBytes(image));
  } catch {
    size = null;
  }
  if (!size) return { ok: false, error: 'bad-image' };

  const error = checkAnimationRequest({ ...size, frameCount, action });
  if (error) return { ok: false, error };
  return {
    ok: true,
    value: {
      image,
      action: action.trim(),
      frameCount: frameCount as AnimationFrameCount,
      transparent,
      enhance,
    },
  };
}

const finiteOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * Pixellab의 Usage({ type: 'usd' | 'generations', usd, generations })를 금액 하나로 줄인다.
 * type이 generations면 생성분, 아니면 달러. 값이 없으면 null.
 */
export function parseUsage(value: unknown): UsageCost | null {
  if (typeof value !== 'object' || value === null) return null;
  const { type, usd, generations } = value as Record<string, unknown>;
  const gen = finiteOrNull(generations);
  const dollars = finiteOrNull(usd);
  if (type === 'generations' && gen !== null) return { unit: 'generations', amount: gen };
  if (dollars !== null) return { unit: 'usd', amount: dollars };
  return null;
}

/** 생성 시작 응답에서 작업 번호, Pixellab이 늘린 설명, 비용을 꺼낸다. 작업 번호가 없으면 null. */
export function parseStartResponse(
  body: unknown,
): { jobId: string; enhancedPrompt: string | null; cost: AnimationCost } | null {
  if (typeof body !== 'object' || body === null) return null;
  const {
    background_job_id: jobId,
    enhanced_prompt: enhanced,
    usage,
    enhance_usage: enhanceUsage,
  } = body as Record<string, unknown>;
  if (typeof jobId !== 'string') return null;
  return {
    jobId,
    enhancedPrompt:
      typeof enhanced === 'string' && enhanced.trim()
        ? enhanced.trim().slice(0, MAX_ENHANCED_PROMPT)
        : null,
    cost: { generation: parseUsage(usage), enhance: parseUsage(enhanceUsage) },
  };
}

export const isJobId = (id: string | null): id is string => id !== null && JOB_ID.test(id);

export type JobResult =
  { status: 'processing' } | { status: 'completed'; frames: string[] } | { status: 'failed' };

/**
 * GET /background-jobs/{id} 응답에서 필요한 것만 꺼낸다.
 * 완료되면 last_response.images에 { type: 'base64', base64, format: 'png' } 목록이 온다.
 * 모양이 예상과 다르면 null.
 */
export function parseJobResponse(body: unknown): JobResult | null {
  if (typeof body !== 'object' || body === null) return null;
  const { status, last_response: last } = body as { status?: unknown; last_response?: unknown };
  if (status === 'processing') return { status: 'processing' };
  if (status === 'failed') return { status: 'failed' };
  if (status !== 'completed') return null;

  const images = (last as { images?: unknown } | null | undefined)?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const frames: string[] = [];
  for (const item of images) {
    const base64 = typeof item === 'string' ? item : (item as { base64?: unknown } | null)?.base64;
    if (typeof base64 !== 'string' || base64.length === 0 || base64.length > MAX_FRAME_BASE64)
      return null;
    frames.push(base64.replace(/^data:[^,]*,/, ''));
  }
  return { status: 'completed', frames };
}
