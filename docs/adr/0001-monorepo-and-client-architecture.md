# ADR-0001: TypeScript monorepo with Next.js and Expo

Status: Accepted, 2026-11-20

Context: A Europe-wide marketplace needs rapid web delivery, native iOS/Android applications and reusable domain logic. Existing Foodora proof-of-concept is a standalone Vite/React web project with Supabase integration and simulated order tracking.

Decision: Use pnpm workspace with Next.js web, Expo Router React Native mobile, shared framework-neutral TypeScript domain and theme packages. Do not import web DOM components into React Native.

Consequences: Shared catalog/cart logic reduces drift; native UI remains idiomatic. Two platform implementations require parity tests. Expo simplifies Android/iOS builds but does not remove store signing and native testing obligations.
