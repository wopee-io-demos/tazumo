import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { accountText, type Language } from '@tazumo/core';
import { auth } from './instance.ts';
import './auth.css';

export function AccountControl({ lang }: { lang: Language }) {
  const state = useSyncExternalStore(auth.subscribe, auth.state);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const text = (key: Parameters<typeof accountText>[1]) => accountText(lang, key);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (state.status === 'unconfigured') {
    return <p className="authNote" data-testid="sut-auth-unavailable">{text('signInUnavailable')}</p>;
  }
  if (state.status === 'pending') {
    return <p className="authNote" role="status" data-testid="sut-auth-pending">{text('signingIn')}</p>;
  }
  if (state.status === 'signed-out') {
    return (
      <div className="account">
        {state.notice && <p className="authNotice" role="alert" data-testid="sut-auth-notice">{text(state.notice)}</p>}
        <button type="button" className="authButton" data-testid="sut-auth-sign-in" onClick={() => auth.signIn('sign-in')}>{text('signIn')}</button>
        <button type="button" className="authButton secondary" data-testid="sut-auth-sign-up" onClick={() => auth.signIn('sign-up')}>{text('signUp')}</button>
      </div>
    );
  }
  return (
    <div className="account" ref={root}>
      <button
        type="button"
        ref={toggle}
        className="authButton"
        data-testid="sut-auth-account"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">👤 </span>{text('account')}
      </button>
      <div id={menuId} className="accountMenu" data-testid="sut-auth-account-menu" hidden={!open}>
        <p data-testid="sut-auth-user">{state.email ? <>{text('signedInAs')} <strong>{state.email}</strong></> : text('signedIn')}</p>
        <button type="button" className="authButton" data-testid="sut-auth-sign-out" onClick={() => auth.signOut()}>{text('signOut')}</button>
      </div>
    </div>
  );
}
