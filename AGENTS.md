# Development guidance

1. Start with the linked GitHub Issue. Include acceptance criteria and use one PR per coherent change.
2. Use OpenSpec's spec-driven flow in `openspec/changes/<slug>`: proposal, spec deltas, design, tasks. Update tasks to reflect tested work, not intentions.
3. Capture architectural trade-offs as numbered ADRs, status proposed/accepted/superseded.
4. Reuse `@tazumo/core` for domain logic and `@tazumo/brand` for independently changeable brand tokens. Do not couple user identity, currency or region to the brand name.
5. Do not ship mock courier positions, payments, fees or ETAs as real. The MVP is demonstrative.
6. Never commit secrets, customer data, .env files, EAS credentials or private repository tokens.
7. Require accessibility and language checks before marking customer-facing features complete. Prefer functional usability over mascot decoration.
8. Link pull requests and commits to relevant issues. Prefer draft PRs until CI and native builds have evidence.
