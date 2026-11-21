import test from 'node:test';
import assert from 'node:assert/strict';
import {languages} from './localization.ts';
import {accountMessageKeys,accountText} from './account.ts';
test('every language has every account message, and translations differ from English',()=>{
 for(const lang of languages)for(const key of accountMessageKeys)assert.ok(accountText(lang,key).trim(),`${lang}.${key}`);
 for(const lang of ['cs','de'] as const)for(const key of accountMessageKeys)assert.notEqual(accountText(lang,key),accountText('en',key),`${lang}.${key}`);
});
test('account copy never asks for a password',()=>{for(const lang of languages)for(const key of accountMessageKeys)assert.doesNotMatch(accountText(lang,key),/password|heslo|passwort/i)});
