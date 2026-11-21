import { defineConfig, type Plugin } from 'vite';
import { buildInfo } from '../../scripts/build-info.mjs';

function buildIdentity(): Plugin {
  const info = buildInfo();
  const json = `${JSON.stringify(info, null, 2)}\n`;
  let base = '/';
  return {
    name: 'tazumo-build-identity',
    configResolved: (config) => { base = config.base; },
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'tazumo-version', content: info.version }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'tazumo-commit', content: info.commit }, injectTo: 'head' }
    ],
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== `${base}version.json`) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(json);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: json });
    }
  };
}

const proxy = process.env.TAZUMO_API_URL ? { '/v1': { target: process.env.TAZUMO_API_URL } } : undefined;

export default defineConfig({ base: process.env.TAZUMO_WEB_BASE || '/', plugins: [buildIdentity()], server: { proxy }, preview: { proxy } });
