# Native shopping delta specification

## ADDED Requirements

### Requirement: Product detail navigation
The native app SHALL open a product detail screen when a catalogue product is activated, showing name, merchant, category, description, illustrative price and the quantity already in the cart.

#### Scenario: Open a product and add it
- **WHEN** a user taps the Margherita pizza row and then "Add to cart"
- **THEN** the detail screen shows quantity 1 and the header cart count shows 1

### Requirement: Cart screen
The native app SHALL provide a cart screen that lists every cart line with increase, decrease and remove controls and a subtotal calculated by `@tazumo/core`.

#### Scenario: Change and remove quantities
- **WHEN** a user increases a line to 2, decreases it to 1 and then removes it
- **THEN** the subtotal follows each change and the empty-basket message is shown after removal

#### Scenario: Quantity never goes negative
- **WHEN** a user decreases a line with quantity 1
- **THEN** the line disappears and no negative quantity is shown

### Requirement: Disabled prototype checkout
The cart screen SHALL show a checkout control that is disabled for touch and assistive technology and SHALL state that it is a prototype in which no order is placed and no payment is taken.

#### Scenario: Attempt checkout
- **WHEN** a user or screen reader activates the checkout control
- **THEN** nothing happens and the control reports a disabled state

### Requirement: Back navigation preserves state
The native app SHALL return to the previous screen from the on-screen back button and from the Android hardware back button without changing the cart, language or palette.

#### Scenario: Back from cart
- **WHEN** a user goes catalogue -> product -> cart and presses back twice
- **THEN** the catalogue is shown with the same cart count

### Requirement: Accessible, stable native identifiers
Every new interactive element SHALL have an accessibility role and a localized label, and a stable `sut-` testID. Existing testIDs and the app ID `io.wopee.demos.tazumo` SHALL NOT change.

#### Scenario: Screen reader on the catalogue
- **WHEN** VoiceOver focuses a catalogue row
- **THEN** it announces the product name, price and a hint that it opens product details
