# ADR-0003: Do not simulate production checkout or live tracking

Status: Accepted, 2026-11-20

Context: Source proof of concept simulates order tracking; marketplace demo data is fictional.

Decision: Provide functional discovery, search, category filtering and local cart, but explicitly disable checkout and do not claim real-time delivery. Replace with genuine payment and fulfilment events in future releases.

Consequences: Prototype is honest and safe for demonstration; real operational flows require backend, PSP, delivery partnerships and security review.
