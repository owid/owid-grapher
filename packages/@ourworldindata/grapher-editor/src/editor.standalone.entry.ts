// Entry point for the standalone bundle (see tsdown.config.ts): the CSS-free
// public API with React and grapher bundled in, for plain HTML pages.

// Polyfills must be loaded before all other code.
import "@ourworldindata/utils/src/polyfills.js"

export * from "./index.js"
