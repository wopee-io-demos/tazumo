import { clients } from '../idp/env.mts';

/** The web app is served where the realm's `tazumo-web` client allows redirects (`http://127.0.0.1:5173/*`). */
export const webApp = new URL('/', clients.web.redirectUri).href;
export const webClientId = clients.web.id;
