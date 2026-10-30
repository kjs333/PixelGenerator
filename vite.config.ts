import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

declare const process: { env: Record<string, string | undefined> };

/**
 * `npm run dev`에서도 /.netlify/functions/* 를 쓸 수 있게 netlify/functions/의 함수를 대신 실행한다.
 * .env의 PIXELLAB_* 값은 이 개발 서버(Node)에만 넣는다. envPrefix가 VITE_라서 브라우저 번들에는 들어가지 않는다.
 * 지금은 GET만 전달한다(요청 본문 전달은 POST 함수를 만들 때 추가).
 */
function netlifyFunctionsDev(): Plugin {
  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, 'PIXELLAB_'));
      server.middlewares.use('/.netlify/functions', async (rawReq, res) => {
        // @types/node 없이 쓰는 필드만 타입을 붙인다
        const req = rawReq as unknown as { url?: string; originalUrl?: string; method?: string };
        const name = (req.url ?? '').split('?')[0]!.replace(/^\//, '');
        if (!/^[a-z0-9-]+$/.test(name)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const mod = await server.ssrLoadModule(`/netlify/functions/${name}.ts`);
          const response: Response = await mod.default(
            new Request(`http://localhost${req.originalUrl ?? req.url}`, { method: req.method }),
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
