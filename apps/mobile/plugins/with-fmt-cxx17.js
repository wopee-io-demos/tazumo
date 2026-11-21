// Xcode 26+ clang rejects the consteval format strings in the fmt Pod that React Native 0.79 bundles
// ("call to consteval function ... is not a constant expression"). Compiling only the fmt target as C++17
// turns fmt's consteval off; every other target keeps its own language standard.
const { withPodfile } = require('expo/config-plugins');

const MARKER = '# tazumo: fmt as C++17';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end`;

module.exports = function withFmtCxx17(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    const hook = /post_install do \|installer\|/;
    if (!hook.test(podfile)) throw new Error('with-fmt-cxx17: no post_install hook in the generated Podfile');
    cfg.modResults.contents = podfile.replace(hook, (line) => `${line}${SNIPPET}`);
    return cfg;
  });
};
