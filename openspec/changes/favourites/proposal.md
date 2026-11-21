# Change: Device-local favourite merchants (web)

Issue: [#95](https://github.com/wopee-io-demos/tazumo/issues/95)

## Why
Shoppers cannot save the merchants they like. The earlier prototype had favourites, but it coerced ids to numbers, so slug ids such as `piazza-local` could never be saved.

## What changes
- `@tazumo/core` (additive): `parseFavourites`, `toggleFavourite`, `serializeFavourites` (string ids, deduplicated, unknown ids dropped, corrupted input gives `[]`), and EN/CS/DE keys.
- `apps/web/src/discovery/favourites.tsx`: a `useFavourites` hook (`localStorage` key `tazumo.favourites`, `storage` event sync across tabs, in-memory fallback) and a `FavouriteButton` with `aria-pressed`, the issue's add/remove labels and `sut-favourite-<merchantId>`.
- Heart buttons on merchant cards and the merchant page. A Favourites filter button (`sut-favourites-filter`) next to the categories narrows products and merchants. Its empty state reuses the reset control.
- `tests/e2e/favourites.spec.ts`.
- SUT contract v0.3.0 (minor): favourite selectors and template, `web.storage`, `web.urlParameters`, journey `favourites-filter`.

## Out of scope
Native favourites, account sync, favourite products.
