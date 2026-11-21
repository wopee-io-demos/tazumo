import test from 'node:test';
import assert from 'node:assert/strict';
import {languages,languageNames,t,categoryLabel,formatLocalizedPrice} from './localization.ts';
test('every language has translated core UI copy',()=>{for(const lang of languages){assert.ok(t(lang,'section'));assert.ok(t(lang,'disabled'));assert.ok(categoryLabel(lang,'Groceries'))}});
test('locale-aware EUR formatting never changes underlying price',()=>{assert.match(formatLocalizedPrice(1190,'en'),/11\.90/);assert.match(formatLocalizedPrice(1190,'de'),/11,90/);assert.match(formatLocalizedPrice(1190,'cs'),/11,90/)});
test('every language has a native display name',()=>{for(const lang of languages)assert.ok(languageNames[lang])});
