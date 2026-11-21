import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, loadMerchants, type Api, type Merchant, type StaffMember } from './api.ts';

type Load<T> = { data?: T; error?: ApiError | Error };

export function useMerchants(api: Api, enabled: boolean): Load<Merchant[]> {
  const [state, setState] = useState<Load<Merchant[]>>({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadMerchants(api).then(
      (data) => active && setState({ data }),
      (error: Error) => active && setState({ error }),
    );
    return () => {
      active = false;
    };
  }, [api, enabled]);
  return state;
}

const roleLabel = (role: string) => (role === 'merchant_staff' ? 'Merchant staff' : role === 'support' ? 'Support' : role);

export function StaffList({ api, merchantId, merchantName }: { api: Api; merchantId: string; merchantName: string }) {
  const [state, setState] = useState<Load<StaffMember[]>>({});
  useEffect(() => {
    let active = true;
    setState({});
    api<StaffMember[]>(`/v1/merchants/${encodeURIComponent(merchantId)}/staff`).then(
      (data) => active && setState({ data }),
      (error: Error) => active && setState({ error }),
    );
    return () => {
      active = false;
    };
  }, [api, merchantId]);

  if (state.error instanceof ApiError && state.error.status === 403)
    return (
      <section>
        <h1 data-testid="sut-backoffice-forbidden">Access denied</h1>
        <p>You do not have access to this merchant's staff list.</p>
      </section>
    );
  if (state.error instanceof ApiError && state.error.status === 404)
    return (
      <section>
        <h1 data-testid="sut-backoffice-not-found">Merchant not found</h1>
      </section>
    );
  return (
    <section>
      <h1>Staff of {merchantName}</h1>
      {state.error && (
        <p role="alert" data-testid="sut-backoffice-staff-error">
          The staff list could not be loaded. Please try again.
        </p>
      )}
      {!state.data && !state.error && <p role="status">Loading staff…</p>}
      {state.data && (
        <table data-testid="sut-backoffice-staff-table">
          <caption className="visually-hidden">Staff of {merchantName}</caption>
          <thead>
            <tr>
              <th scope="col">User ID</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((member) => (
              <tr key={`${member.userId}-${member.role}`} data-testid="sut-backoffice-staff-row">
                <td>
                  <code>{member.userId}</code>
                </td>
                <td>{roleLabel(member.role)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {state.data?.length === 0 && <p>No staff are assigned to this merchant.</p>}
    </section>
  );
}

function MerchantSelect({ id, merchants, value, onChange }: { id: string; merchants: Load<Merchant[]>; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required disabled={!merchants.data}>
      <option value="">{merchants.data ? 'Choose a merchant' : merchants.error ? 'Merchants could not be loaded' : 'Loading merchants…'}</option>
      {merchants.data?.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

export function Lookup({ merchants }: { merchants: Load<Merchant[]> }) {
  const [merchantId, setMerchantId] = useState('');
  return (
    <section>
      <h1>Staff lookup</h1>
      <p>Read-only. Opening a staff list is recorded in the audit log.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          location.hash = `#/merchants/${encodeURIComponent(merchantId)}/staff`;
        }}
      >
        <label htmlFor="lookup-merchant">Merchant</label>
        <MerchantSelect id="lookup-merchant" merchants={merchants} value={merchantId} onChange={setMerchantId} />
        <button type="submit" data-testid="sut-backoffice-lookup-submit">
          Show staff
        </button>
      </form>
    </section>
  );
}

const grantMessages: Record<string, string> = {
  invalid_request: 'The request was not valid. Check the user ID, and choose a merchant for merchant staff.',
  forbidden: 'You are not allowed to change roles for this user. Admins cannot change their own roles.',
  user_not_found: 'No user with this ID exists. Users appear after their first sign-in.',
  merchant_not_found: 'That merchant does not exist.',
};

function grantError(error: unknown) {
  if (!(error instanceof ApiError)) return 'The change could not be sent. Please try again.';
  if (grantMessages[error.code]) return grantMessages[error.code];
  if (error.status === 400) return grantMessages.invalid_request;
  if (error.status === 403) return grantMessages.forbidden;
  if (error.status === 404) return 'The user or merchant was not found.';
  if (error.status === 401) return 'Your session has expired. Sign out and sign in again.';
  if (error.status === 429) return 'Too many requests. Wait a moment and try again.';
  if (error.status === 503) return 'The back office is unavailable right now.';
  return 'The change failed. Please try again.';
}

export function RoleGrants({ api, merchants }: { api: Api; merchants: Load<Merchant[]> }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'merchant_staff' | 'support'>('merchant_staff');
  const [merchantId, setMerchantId] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'revoke' ? 'revoke' : 'grant';
    const query = role === 'merchant_staff' ? `?merchantId=${encodeURIComponent(merchantId)}` : '';
    const merchantName = merchants.data?.find((m) => m.id === merchantId)?.name;
    const what = role === 'merchant_staff' ? `Merchant staff of ${merchantName ?? merchantId}` : 'Support';
    setBusy(true);
    setResult(null);
    try {
      const path = `/v1/admin/users/${encodeURIComponent(userId.trim())}/roles/${role}${query}`;
      if (action === 'grant') {
        const status = await api.status(path, { method: 'PUT' });
        setResult({
          ok: true,
          text: status === 201 ? `Granted: ${what} for user ${userId.trim()}.` : `No change: user ${userId.trim()} already has ${what}.`,
        });
      } else {
        await api.status(path, { method: 'DELETE' });
        setResult({ ok: true, text: `Revoked: ${what} for user ${userId.trim()} (if it was granted).` });
      }
    } catch (error) {
      setResult({ ok: false, text: grantError(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Role grants</h1>
      <p>Grant or revoke merchant staff and support roles. Admin and courier roles cannot be granted here.</p>
      <form onSubmit={submit} className="form">
        <label htmlFor="grant-user">User ID</label>
        <input id="grant-user" value={userId} onChange={(e) => setUserId(e.target.value)} required autoComplete="off" spellCheck={false} />
        <label htmlFor="grant-role">Role</label>
        <select id="grant-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="merchant_staff">Merchant staff</option>
          <option value="support">Support</option>
        </select>
        {role === 'merchant_staff' && (
          <>
            <label htmlFor="grant-merchant">Merchant</label>
            <MerchantSelect id="grant-merchant" merchants={merchants} value={merchantId} onChange={setMerchantId} />
          </>
        )}
        <div className="actions">
          <button type="submit" name="action" value="grant" aria-disabled={busy} data-testid="sut-backoffice-grant-submit">
            Grant
          </button>
          <button type="submit" name="action" value="revoke" aria-disabled={busy} data-testid="sut-backoffice-revoke-submit">
            Revoke
          </button>
        </div>
      </form>
      <div aria-live="polite" data-testid="sut-backoffice-grant-result">
        {result && <p className={result.ok ? 'ok' : 'error'}>{result.text}</p>}
      </div>
    </section>
  );
}
