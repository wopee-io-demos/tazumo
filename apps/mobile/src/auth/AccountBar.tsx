import React, { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { accountText, type AccountMessageKey, type Language } from '@tazumo/core';
import type { Colors } from '../screens/types';
import { nativeAuth } from './instance';

export function AccountBar({ lang, colors }: { lang: Language; colors: Colors }) {
  const state = useSyncExternalStore(nativeAuth.subscribe, nativeAuth.state);
  useEffect(() => void nativeAuth.start(), []);
  const text = (key: AccountMessageKey) => accountText(lang, key);
  const announcement =
    state.status === 'pending' ? text('signingIn')
    : state.status === 'signing-out' ? text('signingOut')
    : state.status === 'signed-out' && state.notice ? text(state.notice)
    : state.status === 'signed-in' ? (state.email ? `${text('signedInAs')} ${state.email}` : text('signedIn'))
    : null;
  useEffect(() => {
    if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  if (state.status === 'restoring') return null;
  if (state.status === 'unconfigured') return <Text testID="sut-auth-unavailable" style={styles.note}>{text('signInUnavailable')}</Text>;
  if (state.status === 'pending') return <Text testID="sut-auth-pending" style={styles.note}>{text('signingIn')}</Text>;
  if (state.status === 'signing-out') return <Text testID="sut-auth-signing-out" style={styles.note}>{text('signingOut')}</Text>;
  if (state.status === 'signed-out') {
    return (
      <View style={styles.bar}>
        {state.notice ? <Text testID="sut-auth-notice" accessibilityRole="alert" style={styles.notice}>{text(state.notice)}</Text> : null}
        <AuthButton testID="sut-auth-sign-in" label={text('signIn')} colors={colors} filled onPress={() => nativeAuth.signIn('sign-in')} />
        <AuthButton testID="sut-auth-sign-up" label={text('signUp')} colors={colors} onPress={() => nativeAuth.signIn('sign-up')} />
      </View>
    );
  }
  return (
    <View style={styles.bar}>
      <Text testID="sut-auth-user" style={[styles.user, { color: colors.ink }]}>{state.email ? `${text('signedInAs')} ${state.email}` : text('signedIn')}</Text>
      <AuthButton testID="sut-auth-sign-out" label={text('signOut')} colors={colors} onPress={() => nativeAuth.signOut()} />
    </View>
  );
}

function AuthButton({ testID, label, colors, filled = false, onPress }: { testID: string; label: string; colors: Colors; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.button, { borderColor: colors.primary, backgroundColor: filled ? colors.primary : 'transparent' }]}>
      <Text style={[styles.label, { color: filled ? 'white' : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  button: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  label: { fontWeight: '800' },
  note: { fontSize: 12, color: '#746E78', paddingHorizontal: 20, paddingBottom: 12 },
  notice: { flexBasis: '100%', fontSize: 13, fontWeight: '700', color: '#8a1c1c' },
  user: { flexShrink: 1, fontSize: 14 },
});
