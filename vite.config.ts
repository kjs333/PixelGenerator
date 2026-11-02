import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

declare const process: { env: Record<string, string | undefined> };

/**
 * `npm run dev`에서도 /.netlify/functions/* 를 쓸 수 있게 netlify/functions/의 함수를 대신 실행한다.
 * .env의 PIXELLAB_* 값은 이 개발 서버(Node)에만 넣는다. envPrefix가 VITE_라서 브라우저 번들에는 들어가지 않는다.
 * POST 요청은 본문과 Content-Type을 함께 넘긴다.
 */
function netlifyFunctionsDev(): Plugin {
  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, 'PIXELLAB_'));
      server.middlewares.use('/.netlify/functions', async (rawReq, res) => {
        // @types/node 없이 쓰는 필드만 타입을 붙인다
        const req = rawReq as unknown as {
          url?: string;
          originalUrl?: string;
          method?: string;
          headers: Record<string, string | string[] | undefined>;
        } & AsyncIterable<Uint8Array>;
        const name = (req.url ?? '').split('?')[0]!.replace(/^\//, '');
        if (!/^[a-z0-9-]+$/.test(name)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const chunks: Uint8Array[] = [];
          if (req.method === 'POST') for await (const chunk of req) chunks.push(chunk);
          const contentType = req.headers['content-type'];
          const mod = await server.ssrLoadModule(`/netlify/functions/${name}.ts`);
          const response: Response = await mod.default(
            new Request(`http://localhost${req.originalUrl ?? req.url}`, {
              method: req.method,
              headers: typeof contentType === 'string' ? { 'Content-Type': contentType } : {},
              body: req.method === 'POST' ? new Blob(chunks as BlobPart[]) : undefined,
            }),
          );
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [netlifyFunctionsDev()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
