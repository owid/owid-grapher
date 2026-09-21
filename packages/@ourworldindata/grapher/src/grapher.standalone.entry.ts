// Entry point for the standalone CDN bundle (see tsdown.config.ts): the
// CSS-free public API plus polyfills. The polyfills live in their own entry
// here (rather than in grapher.public.ts) because the types build shares
// grapher.public.ts and shouldn't see them.

// Polyfills must be loaded before all other code.
import "@ourworldindata/utils/src/polyfills.js"

export * from "./grapher.public.js"
