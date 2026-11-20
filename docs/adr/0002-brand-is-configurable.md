# ADR-0002: Separate brand naming, mascot and colors

Status: Accepted, 2026-11-20

Context: Name-conflict evidence remains inconclusive. User wants to select palettes independently of naming.

Decision: Centralize provisional brand identity and named palette tokens in @tazumo/brand. Provide UI theme switchers in web and mobile prototypes. No logo or mascot illustration embedded as a fixed dependency. Fox emoji is a temporary concept only.

Consequences: Brand pivots are low-cost before launch. Accessibility must be tested for every candidate. Persist web palette client-side; native preference persistence is a future task.
