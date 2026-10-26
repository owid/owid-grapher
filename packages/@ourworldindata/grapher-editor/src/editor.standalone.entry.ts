// Entry point for the standalone CDN bundle (see tsdown.config.ts): the
// CSS-free public API plus polyfills, with React bundled in.

// Polyfills must be loaded before all other code.
import "@ourworldindata/utils/src/polyfills.js"

export * from "./editor.public.js"
