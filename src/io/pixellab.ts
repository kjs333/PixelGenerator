import { isUsageCost, type AnimationCost, type AnimationFrameCount } from '../core/animation';
import type { PixelBuffer } from '../core/types';
import { base64ToBytes, bytesToBase64 } from './base64';
import { encodePng } from './exportPng';

/** Pixellab 계정 잔액. 값이 없으면 null. */
export interface PixellabBalance {
  usd: number | null;
  generations: number | null;
  total: number | null;
}

// Pixellab 주소와 API 키는 브라우저에서 다루지 않는다. 항상 우리 Netlify 함수를 거친다.
const BALANCE_URL = '/.netlify/functions/pixellab-balance';
const ANIMATE_URL = '/.netlify/functions/pixellab-animate';
const JOB_URL = '/.netlify/functions/pixellab-job';

/** 함수가 돌려준 오류 이름. 화면이 알맞은 문구를 고르는 데 쓴다. */
export class PixellabError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'PixellabError';
  }
}

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const readError = async (res: Response) => {
  try {
    const body = (await res.json()) as { error?: unknown };
    return new PixellabError(typeof body.error === 'string' ? body.error : `http-${res.status}`);
  } catch {
    return new PixellabError(`http-${res.status}`);
  }
};

/** 우리 Netlify 함수를 거쳐 Pixellab 잔액을 읽는다. API 연결 확인용. */
export async function fetchPixellabBalance(): Promise<PixellabBalance> {
  const res = await fetch(BALANCE_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`잔액 조회 실패: ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  return { usd: numberOrNull(body.usd), generations: numberOrNull(body.generations), total: numberOrNull(body.total) };
}

/** 애니메이션 생성을 시작하고 작업 번호, (요청했다면) Pixellab이 늘린 설명, 이번 요청 비용을 돌려준다. 요청마다 요금이 나간다. */
export async function startAnimation(req: {
  image: PixelBuffer;
  action: string;
  frameCount: AnimationFrameCount;
  transparent: boolean;
  enhance: boolean;
}): Promise<{ jobId: string; enhancedPrompt: string | null; cost: AnimationCost }> {
  const png = new Uint8Array(await (await encodePng(req.image)).arrayBuffer());
  const res = await fetch(ANIMATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      image: bytesToBase64(png),
      action: req.action,
      frameCount: req.frameCount,
      transparent: req.transparent,
      enhance: req.enhance,
    }),
  });
  if (!res.ok) throw await readError(res);
  const { jobId, enhancedPrompt, cost } = (await res.json()) as {
    jobId?: unknown;
    enhancedPrompt?: unknown;
    cost?: { generation?: unknown; enhance?: unknown };
  };
  if (typeof jobId !== 'string') throw new PixellabError('upstream');
  return {
    jobId,
    enhancedPrompt: typeof enhancedPrompt === 'string' ? enhancedPrompt : null,
    cost: {
      generation: isUsageCost(cost?.generation) ? cost.generation : null,
      enhance: isUsageCost(cost?.enhance) ? cost.enhance : null,
    },
  };
}

export type AnimationJob = { status: 'processing' } | { status: 'completed'; frames: string[] } | { status: 'failed' };

/** 작업 상태를 한 번 조회한다. 완료면 프레임 PNG(base64) 목록이 함께 온다. */
export async function fetchAnimationJob(jobId: string): Promise<AnimationJob> {
  const res = await fetch(`${JOB_URL}?id=${encodeURIComponent(jobId)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { status?: unknown; frames?: unknown };
  if (body.status === 'processing' || body.status === 'failed') return { status: body.status };
  if (body.status === 'completed' && Array.isArray(body.frames) && body.frames.every((f) => typeof f === 'string')) {
    return { status: 'completed', frames: body.frames };
  }
  throw new PixellabError('upstream');
}

/** 프레임 PNG(base64)를 PixelBuffer로 읽는다. */
export async function decodeFrame(base64: string): Promise<PixelBuffer> {
  const bitmap = await createImageBitmap(new Blob([base64ToBytes(base64) as BlobPart], { type: 'image/png' }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('캔버스를 쓸 수 없어요');
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
  } finally {
    bitmap.close();
  }
}
