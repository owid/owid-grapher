// Library entry point for @ourworldindata/grapher-editor (see
// tsdown.config.ts): the public API plus the editor's styles.

// Polyfills must be loaded before all other code.
import "@ourworldindata/utils/src/polyfills.js"

import "./editor.scss"
export * from "./editor.public.js"
