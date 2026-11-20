# Design

- **Routing:** hash routes parsed by a pure `parseRoute` in `apps/web/src/discovery/route.ts` (ADR-0012). Malformed percent-encoding falls back to home. The page scrolls to the top for detail routes only.
- **Focus:** detail and not-found pages focus their `h1` (`tabIndex=-1`) when the route id changes. After in-app navigation back to home, the Merchants `h2` receives focus. The cart drawer focuses its heading when a line disappears, so focus never drops to `<body>`. Focus rings use the `ink` token for 3:1 contrast on every palette.
- **State:** cart, language, palette, query and category stay in `App` (`main.tsx`), so navigation keeps them. The cart dialog moved to `CartDrawer.tsx`, keeping existing aria labels, `data-cart-close` and the `sut-cart-dialog` id.
- **Merchant join:** merchants are synthetic fixtures joined to existing products by the `merchant` display name, so product fixtures are not changed. A unit test enforces exactly one merchant per product. A follow-up can add `merchantId` to `Product` together with the SUT contract version bump.
- **Test ids:** product add buttons reuse `sut-add-<id>` on every route. Product-page elements use `sut-detail-*`, so they cannot collide with `sut-product-<id>` card ids.
