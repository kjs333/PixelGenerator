/** Pixellab 계정 잔액. 값이 없으면 null. */
export interface PixellabBalance {
  usd: number | null;
  generations: number | null;
  total: number | null;
}

const BALANCE_URL = '/.netlify/functions/pixellab-balance';

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * 우리 Netlify 함수를 거쳐 Pixellab 잔액을 읽는다. API 연결 확인용.
 * Pixellab 주소와 API 키는 브라우저에서 다루지 않는다.
 */
export async function fetchPixellabBalance(): Promise<PixellabBalance> {
  const res = await fetch(BALANCE_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`잔액 조회 실패: ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  return { usd: numberOrNull(body.usd), generations: numberOrNull(body.generations), total: numberOrNull(body.total) };
}
