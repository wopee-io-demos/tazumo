import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { brandName, palettes, preferredPalette } from '@tazumo/brand';
import { ApiError, backOfficeRoles, createApi, hasRole, staffMerchantIds, type Api, type Me } from './api.ts';
import { AuthError, createOidcProvider, type AuthProvider } from './auth.ts';
import { Lookup, RoleGrants, StaffList, useMerchants } from './pages.tsx';
import './style.css';

type Route = { name: 'home' } | { name: 'staff'; merchantId: string } | { name: 'grants' } | { name: 'lookup' };

function parseRoute(hash: string): Route {
  const staff = /^#\/merchants\/([^/]+)\/staff$/.exec(hash);
  if (staff) return { name: 'staff', merchantId: decodeURIComponent(staff[1]) };
  if (hash === '#/grants') return { name: 'grants' };
  if (hash === '#/lookup') return { name: 'lookup' };
  return { name: 'home' };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return route;
}

type Session =
  | { status: 'starting' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'unavailable' }
  | { status: 'ready'; me: Me };

const describe = (error: unknown) =>
  error instanceof AuthError || error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

function Shell({ auth, api, me, onSignOut }: { auth: AuthProvider; api: Api; me: Me; onSignOut: () => void }) {
  const route = useRoute();
  const isAdmin = hasRole(me, 'admin');
  const canLookup = isAdmin || hasRole(me, 'support');
  const ownMerchants = staffMerchantIds(me);
  const merchants = useMerchants(api, true);
  const nameOf = (id: string) => merchants.data?.find((m) => m.id === id)?.name ?? id;
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else main.current?.focus();
  }, [route]);

  let page: React.ReactNode;
  if (route.name === 'staff') page = <StaffList api={api} merchantId={route.merchantId} merchantName={nameOf(route.merchantId)} />;
  else if (route.name === 'grants') page = isAdmin ? <RoleGrants api={api} merchants={merchants} /> : <NotForRole />;
  else if (route.name === 'lookup') page = canLookup ? <Lookup merchants={merchants} /> : <NotForRole />;
  else page = <h1 data-testid="sut-backoffice-home">Back office</h1>;

  return (
    <>
      <nav aria-label="Back office" className="nav" data-testid="sut-backoffice-nav">
        <ul>
          {isAdmin && (
            <li>
              <a href="#/grants" data-testid="sut-backoffice-nav-grants">Role grants</a>
            </li>
          )}
          {canLookup && (
            <li>
              <a href="#/lookup" data-testid="sut-backoffice-nav-lookup">Staff lookup</a>
            </li>
          )}
          {ownMerchants.length > 0 && (
            <li>
              <span id="my-merchants">My merchants</span>
              <ul aria-labelledby="my-merchants">
                {ownMerchants.map((id) => (
                  <li key={id}>
                    <a href={`#/merchants/${encodeURIComponent(id)}/staff`} data-testid={`sut-backoffice-nav-merchant-${id}`}>
                      {nameOf(id)}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
        <span className="user">
          Signed in as <code data-testid="sut-backoffice-user">{me.userId}</code>
        </span>
        <button
          type="button"
          data-testid="sut-backoffice-sign-out"
          onClick={() => {
            auth.signOut();
            onSignOut();
          }}
        >
          Sign out
        </button>
      </nav>
      <main id="main" tabIndex={-1} ref={main}>
        {page}
      </main>
    </>
  );
}

const NotForRole = () => (
  <section>
    <h1>Not available</h1>
    <p role="alert" data-testid="sut-backoffice-not-for-role">
      This page is not available for your role.
    </p>
  </section>
);

function App({ auth, startup }: { auth: AuthProvider; startup: Promise<boolean> }) {
  const [session, setSession] = useState<Session>({ status: 'starting' });
  const api = useMemo(
    () =>
      createApi(auth, () => {
        auth.signOut();
        setSession({ status: 'signed-out', notice: 'Your session has expired. Please sign in again.' });
      }),
    [auth],
  );

  useEffect(() => {
    let active = true;
    startup
      .then(async (signedIn) => {
        if (!signedIn) return { status: 'signed-out' } as Session;
        return { status: 'ready', me: await api<Me>('/v1/me') } as Session;
      })
      .catch((error: unknown): Session =>
        error instanceof ApiError && error.status === 503 ? { status: 'unavailable' } : { status: 'signed-out', notice: describe(error) },
      )
      .then((next) => active && setSession(next));
    return () => {
      active = false;
    };
  }, [api, startup]);

  let body: React.ReactNode;
  if (session.status === 'starting')
    body = (
      <main id="main" tabIndex={-1} className="center">
        <p role="status">Loading…</p>
      </main>
    );
  else if (session.status === 'unavailable')
    body = (
      <main id="main" tabIndex={-1} className="center">
        <h1>Back office unavailable</h1>
        <p role="alert" data-testid="sut-backoffice-unavailable">
          The back office is unavailable right now. No data is shown. Please try again later.
        </p>
      </main>
    );
  else if (session.status === 'signed-out')
    body = (
      <main id="main" tabIndex={-1} className="center">
        <h1>Sign in to the back office</h1>
        {session.notice && (
          <p role="alert" data-testid="sut-backoffice-auth-error">
            {session.notice}
          </p>
        )}
        <button
          type="button"
          data-testid="sut-backoffice-sign-in"
          onClick={() => auth.signIn(location.hash || '#/').catch((e) => setSession({ status: 'signed-out', notice: describe(e) }))}
        >
          Sign in
        </button>
      </main>
    );
  else if (!session.me.roles.some((g) => backOfficeRoles.includes(g.role)))
    body = (
      <main id="main" tabIndex={-1} className="center">
        <h1 data-testid="sut-backoffice-no-access">No back-office access</h1>
        <p>Your account has no merchant staff, support or admin role.</p>
      </main>
    );
  else body = <Shell auth={auth} api={api} me={session.me} onSignOut={() => setSession({ status: 'signed-out' })} />;

  const theme = palettes[preferredPalette];
  return (
    <div className="app" style={{ '--primary': theme.primary, '--tint': theme.background, '--ink': theme.ink } as React.CSSProperties}>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="top">
        <strong>{brandName} back office</strong>
        <span className="badge" data-testid="sut-backoffice-prototype">
          Prototype · synthetic data
        </span>
      </header>
      {body}
    </div>
  );
}

const env = import.meta.env;
const auth = createOidcProvider({
  issuer: env.VITE_OIDC_ISSUER ?? '',
  clientId: env.VITE_OIDC_CLIENT_ID ?? '',
  scope: env.VITE_OIDC_SCOPE ?? 'openid',
  resource: env.VITE_OIDC_RESOURCE,
});
const startup = env.VITE_OIDC_ISSUER && env.VITE_OIDC_CLIENT_ID
  ? auth.completeSignIn()
  : Promise.reject(new AuthError('Sign-in is not configured for this build.'));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App auth={auth} startup={startup} />
  </React.StrictMode>,
);
