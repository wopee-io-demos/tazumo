# Brand, voice and UX writing guidelines

Scope: web and mobile Tazumo apps in English (EN), Czech (CS) and German (DE). The name "Tazumo" is provisional and not legally cleared ([#6](https://github.com/wopee-io-demos/tazumo/issues/6)). Name, palette and mascot are independent settings ([ADR-0002](../adr/0002-brand-independent-tokens.md), [ADR-0011](../adr/0011-design-system-tokens.md)), so copy never depends on any of them.

## 1. Design tokens in practice

All values come from `@tazumo/brand`. Do not hard-code colours, spacing or shadows in apps.

| Need | Token | Rule |
| --- | --- | --- |
| Page and card colours | `themes[palette][mode].background`, `.surface`, `.tint` | `tint` is the soft brand area (hero, image wells, empty states). |
| Body copy | `.text` on `background`, `surface` or `tint` | Secondary copy uses `.textMuted`, never a lighter grey. |
| Buttons | `.primary` fill with `.onPrimary` label | `accent` is a decorative or highlight fill: text on it is `.onAccent`. A control that has only an accent fill and no text label also needs a `.border` outline, because on light themes accent can be under 3:1 against white. |
| Focus ring | `.focus`, 2-3px outline **with a 2px offset, always** | The ring is tested against `background`, `surface` and `tint`. Without the offset it can disappear on a `primary` button, because in light themes `focus` equals `primary`. Never use `accent` as the focus indicator: coral, emerald and midnight accents are under 3:1 on white. |
| Input and control borders | `.border` | Meets 3:1 against every background role. |
| Errors and confirmations | `.danger`, `.success` | Always pair with text or an icon; never colour alone. |
| Spacing, radius | `spacing.*`, `radius.*` | 4px grid; `pill` for chips and counters. |
| Type | `typography.*` with `fontFamily.*` | Body copy is 16/24. Nothing below 12px. |
| Raised surfaces | `elevation[0-4]` | `css` on web, `native` on React Native. Pair with a border or tint; a shadow alone does not separate surfaces. |
| Touch targets | `touchTarget.minimum` (24), `.recommended` (44) | Primary actions use 44. |

Only the foreground/background pairs listed in `contrastPairings` are approved. `pnpm test` checks each one in every palette and in light and dark mode against WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and UI. Adding a colour role without a pairing fails the test.

Dark mode follows the system setting by default and is not a separate brand.

## 2. Mascot and app icon

- The fox is optional decoration. Every screen must make sense with `mascot: 'none'`. Never put information only in the mascot, and give it an empty `alt` (web) or `accessibilityElementsHidden` (mobile) when it is purely decorative.
- Use the mark (`assets/brand/fox-mark.svg`) at 32px and up, because the eyes become too small below that. At smaller sizes, use the app name as text.
- On a coloured background, use the cream-outlined version from `assets/brand/app-icon/`. The outline is tested at 3:1 or more against every palette's `primary`; the bare fox orange is not.
- With `mascot: 'none'` there is no app-icon variant yet. A wordmark icon is a follow-up ([#47](https://github.com/wopee-io-demos/tazumo/issues/47)).
- Do not recolour the fox to follow the palette. The fox keeps its own orange, cream and ink, so palette changes never touch the mascot.
- The app-icon background is the palette's `primary`. Regenerate it with `pnpm --filter @tazumo/brand export:icons <palette>`.
- Do not add the fox to error, payment or legal messages. Usefulness comes before decoration.

## 3. Voice

Warm, local, plain. We sound like a helpful neighbour who knows the good shops, not like a bank or a game.

| We are | We are not |
| --- | --- |
| Clear: one idea per sentence | Clever at the cost of meaning |
| Warm: "Let's find something good." | Gushing: "OMG, amazing deals!!!" |
| Honest about the prototype | Promising real delivery, payment, ETAs or couriers |
| Specific: "2 items, €15.40" | Vague: "Some stuff in your cart" |

Honesty rules (also in [AGENTS.md](../../AGENTS.md)):
- Never imply that orders, payments, tracking, ETAs or merchants are real. Use "preview", "illustrative", "coming later".
- Never claim the name or mascot is a registered trademark.

## 4. UX writing rules (all languages)

1. **Buttons are verbs**: "Add", "Remove one", "Close cart". Use one or two words where you can.
2. **Sentence case** for headings and buttons. Upper case only for short eyebrow labels, set in CSS rather than typed in capitals, so screen readers do not spell them out.
3. **Errors** say what happened and what to do next, in one or two sentences, without blame: "No matching products. Try another word or category."
4. **Empty states** give a next step.
5. **Accessible names** match the visible label and add state or quantity: "Cart, 3 items". Icon-only buttons always have a label.
6. **No emoji as the only content** of a control. Emoji are decorative and hidden from assistive tech.
7. **Numbers, prices and dates** come from `Intl` with the language locale (`formatLocalizedPrice`). Never concatenate a currency symbol by hand.
8. **Allow 35% text expansion** for German and Czech. Do not truncate buttons. Let labels wrap.
9. **One term per concept.** The checkout container is "cart" in EN (the app currently mixes "cart" and "basket"; standardise on "cart"), "košík" in CS and "Warenkorb" in DE.

## 5. Language guidance

### English (EN)
- Locale `en-IE` for formatting (EUR, day-month order). Use British/Irish spelling: "favourites", "colour", "catalogue".
- Contractions are fine ("Let's", "you're").

### Czech (CS)
- Address the user formally (**vykání**): "Objevte své město", "Co hledáte?". Do not mix in tykání.
- Locale `cs-CZ`: the price format is `11,90 €` with a non-breaking space before the symbol.
- Czech inflects nouns after numbers: 1 položka, 2–4 položky, 5+ položek. Use `Intl.PluralRules('cs')` (categories `one`, `few`, `many`, `other`). Never write "položka(y)".
- Keep diacritics in UI copy. They are required for correct Czech and must never be stripped.
- Imperatives for buttons: "Přidat", "Zavřít košík".

### German (DE)
- Address the user informally (**du**), matching the current app: "Entdecke deine Stadt", "Wonach suchst du?". Switching to "Sie" is a product decision that changes every string, so do it in one place and not piecemeal.
- Locale `de-DE`: `11,90 €`.
- Nouns are capitalised. Compound nouns get long ("Warenkorbzusammenfassung"), so prefer short wording and let it wrap.
- Use infinitives for buttons: "Hinzufügen", "Warenkorb schließen".
- Use German quotation marks („…“) in body copy.

### Example strings

| Purpose | EN | CS | DE |
| --- | --- | --- | --- |
| Add to cart | Add | Přidat | Hinzufügen |
| Cart with count | Cart, 3 items | Košík, 3 položky | Warenkorb, 3 Artikel |
| Empty search | No matching products. Try another word. | Nic jsme nenašli. Zkuste jiné slovo. | Nichts gefunden. Versuch ein anderes Wort. |
| Prototype notice | Preview catalogue. Prices are illustrative. | Ukázkový katalog. Ceny jsou ilustrativní. | Demo-Katalog. Preise sind Beispiele. |
| Checkout disabled | Checkout is coming later. | Pokladna bude dostupná později. | Zur Kasse geht es bald. |

The Czech and German strings still need review by native speakers before launch ([#11](https://github.com/wopee-io-demos/tazumo/issues/11)).

## 6. Pre-release checklist for customer-facing copy
- [ ] Strings live in the shared dictionary for EN, CS and DE, with none hard-coded.
- [ ] Plurals use `Intl.PluralRules`, and prices use `Intl.NumberFormat`.
- [ ] The layout is checked at 200% text size and with German strings.
- [ ] No claim of real orders, payments, couriers, ETAs or trademark status.
- [ ] Colours come from `@tazumo/brand` themes, and only approved pairings are used.
