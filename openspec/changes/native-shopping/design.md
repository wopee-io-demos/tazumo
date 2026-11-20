# Design

- `src/shopping.ts`: a typed route stack (`catalogue`, `product`, `cart`) with `pushRoute`/`popRoute`, plus `cartLines` and `removeLine` built on `@tazumo/core` `changeQuantity`. Pure functions, unit-tested with `node --test`.
- `src/screens/ProductScreen.tsx`, `src/screens/CartScreen.tsx`, `src/screens/ScreenHeader.tsx`: new screens. `App.tsx` keeps the catalogue and owns cart, language and palette state, so every screen sees the same cart.
- `src/messages.ts`: mobile-only copy in en/cs/de for the new controls. Existing core copy (`basket`, `subtotal`, `checkoutLater`, `removeOne`, `addOne`, `emptyBasket`) is reused.
- No navigation library (see ADR-0013).

## New test identifiers

| testID | Element |
| --- | --- |
| `sut-open-product-<id>` | Catalogue row button that opens the detail screen |
| `sut-cart-view` | Mini-cart button that opens the cart screen |
| `sut-nav-back`, `sut-nav-cart` | Screen header back and cart buttons |
| `sut-detail-screen`, `sut-detail-title`, `sut-detail-price`, `sut-detail-add`, `sut-detail-quantity` | Product detail screen |
| `sut-cart-screen`, `sut-cart-empty`, `sut-cart-subtotal`, `sut-cart-prototype-note`, `sut-cart-checkout-disabled` | Cart screen |
| `sut-cart-line-<id>`, `sut-cart-increase-<id>`, `sut-cart-decrease-<id>`, `sut-cart-quantity-<id>`, `sut-cart-remove-<id>` | Cart screen line controls |

New identifiers avoid the `sut-product-`, `sut-add-`, `sut-category-` and `sut-language-` prefixes so prefix-based queries for catalogue rows keep matching only products.
