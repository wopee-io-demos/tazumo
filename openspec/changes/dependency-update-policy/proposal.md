# Dependabot proposes grouped patch and minor updates only

## Why
Issue [#149](https://github.com/wopee-io-demos/tazumo/issues/149). The first weekly Dependabot run opened 15 PRs: TypeScript 7, Vite 8 and `@types/node` 26 once per directory, plus duplicate patch groups. Majors need changelog review and code changes; a bot PR per directory cannot carry them and each one runs the full CI matrix.

## What Changes
- `.github/dependabot.yml`: npm and github-actions ignore `version-update:semver-major`. Patch and minor updates stay in one group per ecosystem, spanning every configured directory. Schedule, cooldown, open-PR limits and the Expo patch-only rules are unchanged.
- ADR-0020 gains a dated update with the decision and alternatives. `docs/SECURITY.md` describes the policy.

## Impact
- Major updates become deliberate PRs (issue #149 tracks TypeScript 7, Vite 8 and `@types/node` 26; #100 the Expo SDK).
- Security updates keep the `npm-security` group and GitHub's separate limit.
