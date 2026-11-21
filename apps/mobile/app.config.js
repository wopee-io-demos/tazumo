/** Native build numbers come from CI (TAZUMO_BUILD_NUMBER, set to github.run_number) and are never committed. */
module.exports = ({ config }) => {
  const raw = process.env.TAZUMO_BUILD_NUMBER || '1';
  const build = Number(raw);
  if (!/^[1-9]\d{0,9}$/.test(raw) || build > 2100000000) throw new Error(`TAZUMO_BUILD_NUMBER must be a positive integer up to 2100000000, got "${raw}"`);
  return { ...config, ios: { ...config.ios, buildNumber: String(build) }, android: { ...config.android, versionCode: build } };
};
