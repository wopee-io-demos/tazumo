import { createHash, randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { apiBase, mailpit, oidc } from './env.mts';

type Client = { id: string; redirectUri: string };
export type Tokens = { access_token: string; id_token: string; expires_in: number };

export function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url'), state: randomBytes(16).toString('base64url') };
}

export function authorizeUrl(client: Client, params: Record<string, string>) {
  const url = new URL(oidc.authorize);
  url.search = new URLSearchParams({ response_type: 'code', client_id: client.id, redirect_uri: client.redirectUri, scope: 'openid', ...params }).toString();
  return url.toString();
}

export async function startSignIn(page: Page, client: Client, extra: Record<string, string> = {}) {
  const flow = pkce();
  await page.goto(authorizeUrl(client, { state: flow.state, code_challenge: flow.challenge, code_challenge_method: 'S256', ...extra }));
  return flow;
}

/** Waits until Keycloak has redirected to the app's callback (served by callback-server.mts) and the page has loaded. */
export async function callbackParams(page: Page, client: Client) {
  await page.waitForURL((url) => url.href.startsWith(`${client.redirectUri}?`));
  return new URL(page.url()).searchParams;
}

export async function exchange(client: Client, code: string, verifier: string) {
  return fetch(oidc.token, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.id, redirect_uri: client.redirectUri, code, code_verifier: verifier }),
  });
}

export async function completeSignIn(page: Page, client: Client, flow: ReturnType<typeof pkce>): Promise<Tokens> {
  const params = await callbackParams(page, client);
  if (params.get('state') !== flow.state) throw new Error(`state mismatch: ${params.toString()}`);
  const response = await exchange(client, params.get('code') ?? '', flow.verifier);
  if (!response.ok) throw new Error(`token exchange failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export const decode = (jwt: string, part: 0 | 1) => JSON.parse(Buffer.from(jwt.split('.')[part], 'base64url').toString());

export const callApi = (path: string, token?: string) =>
  fetch(`${apiBase}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

/** Polls Mailpit for the newest message to `to` whose subject matches, and returns its Keycloak action link. */
export async function mailedLink(to: string, subject: RegExp) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const message = search.messages.find((m: { Subject: string }) => subject.test(m.Subject));
    if (message) {
      const { Text } = await fetch(`${mailpit}/api/v1/message/${message.ID}`).then((r) => r.json());
      const link = Text.match(/https?:\/\/\S+\/login-actions\/action-token\?\S+/)?.[0];
      if (!link) throw new Error(`no action link in "${message.Subject}"`);
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no mail to ${to} matching ${subject}`);
}
