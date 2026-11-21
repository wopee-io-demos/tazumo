## ADDED Requirements

### Requirement: Main deploys a labelled, non-indexed web preview
A push to `main` that changes the web app, its packages or the Pages workflow, or a manual dispatch, SHALL deploy the production web build to https://wopee-io-demos.github.io/tazumo/ and SHALL smoke-test the live URL after the deploy.

#### Scenario: Live smoke after deploy
- **WHEN** the deploy job finishes
- **THEN** the smoke job waits until the live URL serves this build's entry script and checks the visible demo labelling, search, add to cart, disabled checkout and a direct hash deep link, and uploads screenshots.

#### Scenario: Hash deep link on static hosting
- **WHEN** a browser opens `/tazumo/#/product/flowers` directly
- **THEN** the product page renders without a 404 fallback or page errors.

### Requirement: Base path only for the Pages build
The Vite `base` SHALL come from `TAZUMO_WEB_BASE` and SHALL default to `/`.

#### Scenario: Other builds keep the root base
- **WHEN** `pnpm build` or `pnpm dev:web` runs without `TAZUMO_WEB_BASE`
- **THEN** the built entry script is under `/assets/`.

### Requirement: Deploy permissions stay off pull requests
Only the deploy job SHALL hold `pages: write` and `id-token: write`; it SHALL NOT run on `pull_request`, SHALL deploy into the `github-pages` environment, and deploys SHALL queue in one concurrency group without cancelling.

#### Scenario: Pull request changes the workflow
- **WHEN** a pull request changes `pages.yml`
- **THEN** only the build job runs, with read-only permissions, and `node scripts/check-runner-guard.mjs` passes.
