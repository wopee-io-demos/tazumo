// Serves the web client's redirect origin during the IdP suite, so Keycloak's redirects end on a loaded page.
import { createServer } from 'node:http';
import { clients } from './env.mts';

const { hostname, port } = new URL(clients.web.redirectUri);
createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  res.end('<!doctype html><html lang="en"><title>Callback</title></html>');
}).listen(Number(port), hostname, () => console.log(`callback stub on ${hostname}:${port}`));
