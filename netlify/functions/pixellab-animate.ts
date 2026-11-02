// Netlify Function: AI 애니메이션 생성을 시작한다(Pixellab animate-with-text-v3).
// 생성은 30초~3분 걸리므로 여기서 기다리지 않는다. 작업 번호만 돌려주고, 결과는 pixellab-job으로 조회한다.
import { parseAnimateBody, parseStartResponse } from '../lib/animation';
import { json, PIXELLAB_BASE, pixellabKey } from '../lib/http';

/** Pixellab 오류 상태를 브라우저가 문구를 고를 수 있는 이름으로 바꾼다. */
const upstreamError = (status: number) =>
  status === 402
    ? 'no-credits'
    : status === 429
      ? 'busy'
      : status === 422
        ? 'rejected'
        : 'upstream';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const key = pixellabKey();
  if (!key) return json({ error: 'not-configured' }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad-body' }, 400);
  }
  const parsed = parseAnimateBody(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { image, action, frameCount, transparent, enhance } = parsed.value;

  try {
    const res = await fetch(`${PIXELLAB_BASE}/animate-with-text-v3`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_frame: { type: 'base64', base64: image, format: 'png' },
        action,
        frame_count: frameCount,
        // 보내지 않으면 입력이 투명해도 배경이 그려진 프레임이 올 수 있다
        ...(transparent ? { no_background: true } : {}),
        // 그림을 보고 동작 설명을 자세하게 늘린다. 늘린 설명은 응답의 enhanced_prompt로 온다.
        ...(enhance ? { enhance_prompt: true } : {}),
      }),
    });
    if (!res.ok) return json({ error: upstreamError(res.status) }, 502);
    const started = parseStartResponse(await res.json());
    if (!started) return json({ error: 'upstream' }, 502);
    return json(started);
  } catch {
    return json({ error: 'unreachable' }, 502);
  }
};
