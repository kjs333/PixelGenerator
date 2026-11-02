// Netlify 함수 공통 도우미. API 키는 함수 안에서만 읽고, 브라우저에는 키도 Pixellab 원본 응답도 넘기지 않는다.

declare const process: { env: Record<string, string | undefined> };

export const PIXELLAB_BASE = 'https://api.pixellab.ai/v2';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const pixellabKey = () => process.env.PIXELLAB_API_KEY;
