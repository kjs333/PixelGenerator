// Netlify Function: Pixellab 잔액 조회. API 연결이 되는지 확인하는 용도다.
import { json, PIXELLAB_BASE, pixellabKey } from '../lib/http';

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);

  const key = pixellabKey();
  if (!key) return json({ error: 'not-configured' }, 500);

  try {
    const res = await fetch(`${PIXELLAB_BASE}/balance`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502);
    const body = (await res.json()) as {
      credits?: { usd?: unknown };
      subscription?: { generations?: unknown; total?: unknown };
    };
    // 필요한 숫자만 골라서 돌려준다
    return json({
      usd: numberOrNull(body.credits?.usd),
      generations: numberOrNull(body.subscription?.generations),
      total: numberOrNull(body.subscription?.total),
    });
  } catch {
    return json({ error: 'unreachable' }, 502);
  }
};
