import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {patchAppDelegate,sceneManifest}=require('../plugins/with-ui-scene.js');
const template=readFileSync(new URL('./fixtures/AppDelegate.expo53.swift',import.meta.url),'utf8');

test('the Expo 53 AppDelegate starts React Native from a SceneDelegate instead of a launch-time window',()=>{
  const patched=patchAppDelegate(template);
  assert.doesNotMatch(patched,/UIWindow\(frame: UIScreen\.main\.bounds\)/);
  assert.match(patched,/self\.launchOptions = launchOptions/);
  assert.match(patched,/class SceneDelegate: UIResponder, UIWindowSceneDelegate/);
  assert.match(patched,/UIWindow\(windowScene: windowScene\)/);
  assert.match(patched,/factory\.startReactNative\(withModuleName: "main", in: window, launchOptions: appDelegate\.launchOptions\)/);
  assert.equal(patchAppDelegate(patched),patched,'patching twice changes nothing');
});

test('an unexpected AppDelegate template fails prebuild instead of shipping without a scene',()=>{
  assert.throws(()=>patchAppDelegate(template.replace('UIWindow(frame: UIScreen.main.bounds)','UIWindow()')),/no longer matches/);
});

test('the scene manifest declares one application scene with the SceneDelegate',()=>{
  const [config]=sceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication;
  assert.equal(sceneManifest.UIApplicationSupportsMultipleScenes,false);
  assert.equal(config.UISceneDelegateClassName,'$(PRODUCT_MODULE_NAME).SceneDelegate');
});
