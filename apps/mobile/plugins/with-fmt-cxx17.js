// Xcode 26+ clang rejects the consteval format strings in the fmt Pod that React Native 0.79 bundles
// ("call to consteval function ... is not a constant expression"). Compiling only the fmt target as C++17
// turns fmt's consteval off; every other target keeps its own language standard.
// The loop must run after react_native_post_install(...), which resets every Pod target to C++20.
const { withPodfile } = require('expo/config-plugins');

const MARKER = '# tazumo: fmt as C++17';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

// Index just past the line that closes the react_native_post_install(...) call, or -1.
function afterReactNativePostInstall(podfile) {
  const start = podfile.indexOf('react_native_post_install(');
  if (start === -1) return -1;
  let depth = 0;
  for (let i = podfile.indexOf('(', start); i < podfile.length; i++) {
    if (podfile[i] === '(') depth++;
    else if (podfile[i] === ')' && --depth === 0) {
      const eol = podfile.indexOf('\n', i);
      return eol === -1 ? podfile.length : eol + 1;
    }
  }
  return -1;
}

module.exports = function withFmtCxx17(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    const at = afterReactNativePostInstall(podfile);
    if (at !== -1) {
      cfg.modResults.contents = podfile.slice(0, at) + SNIPPET + podfile.slice(at);
      return cfg;
    }
    const hook = /post_install do \|installer\|\n/;
    if (!hook.test(podfile)) throw new Error('with-fmt-cxx17: no post_install hook in the generated Podfile');
    cfg.modResults.contents = podfile.replace(hook, (line) => `${line}${SNIPPET}`);
    return cfg;
  });
};
