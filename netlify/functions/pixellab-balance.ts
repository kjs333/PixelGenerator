// Netlify Function: Pixellab 잔액 조회. 지금은 API 연결이 되는지 확인하는 용도다.
// API 키는 이 함수 안에서만 읽는다. 브라우저에는 키도, Pixellab 원본 응답도 넘기지 않는다.

declare const process: { env: Record<string, string | undefined> };

const PIXELLAB_BASE = 'https://api.pixellab.ai/v2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);

  const key = process.env.PIXELLAB_API_KEY;
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
