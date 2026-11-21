// iOS 27 SDK: apps must adopt the UIScene life cycle or UIKit asserts at launch
// (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo SDK 53's template creates the window in
// AppDelegate.didFinishLaunching and has no scene manifest. This plugin adds a single-scene manifest, keeps the
// React Native factory in AppDelegate, and starts React Native from a SceneDelegate in the window scene instead.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const MARKER = '// tazumo: UIScene life cycle';

const WINDOW_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: appDelegate.launchOptions)
    if let url = connectionOptions.urlContexts.first?.url {
      _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function patchAppDelegate(contents) {
  if (contents.includes(MARKER)) return contents;
  if (!WINDOW_BLOCK.test(contents)) {
    throw new Error('with-ui-scene: AppDelegate.swift no longer matches the Expo SDK 53 template; update the plugin');
  }
  return contents
    .replace('  var window: UIWindow?\n', '  var window: UIWindow?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n')
    .replace(WINDOW_BLOCK, '    self.launchOptions = launchOptions\n')
    + SCENE_DELEGATE;
}

const sceneManifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

module.exports = function withUiScene(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = sceneManifest;
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') throw new Error('with-ui-scene: expected a Swift AppDelegate');
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.patchAppDelegate = patchAppDelegate;
module.exports.sceneManifest = sceneManifest;
