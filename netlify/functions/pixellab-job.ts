// Netlify Function: AI 애니메이션 작업 상태 조회. 완료되면 프레임 PNG(base64) 목록을 돌려준다.
import { isJobId, parseJobResponse } from '../lib/animation';
import { json, PIXELLAB_BASE, pixellabKey } from '../lib/http';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);

  const key = pixellabKey();
  if (!key) return json({ error: 'not-configured' }, 500);

  const id = new URL(req.url).searchParams.get('id');
  if (!isJobId(id)) return json({ error: 'bad-id' }, 400);

  try {
    const res = await fetch(`${PIXELLAB_BASE}/background-jobs/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 404) return json({ status: 'failed' });
    if (!res.ok) return json({ error: 'upstream' }, 502);
    const result = parseJobResponse(await res.json());
    if (!result) return json({ error: 'upstream' }, 502);
    return json(result);
  } catch {
    return json({ error: 'unreachable' }, 502);
  }
};
