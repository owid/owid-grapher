// Library entry point for @ourworldindata/grapher-editor (see tsdown.config.ts):
// the public API plus the editor's styles. React and @ourworldindata/grapher
// stay external.

// Polyfills must be loaded before all other code.
import "@ourworldindata/utils/src/polyfills.js"

// Plain CSS the editor's stylesheet relies on. Imported here rather than from
// the scss because Sass passes `.css` imports through as `@import` rules that
// the CSS build doesn't resolve.
import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"

import "./editor.scss"
export * from "./index.js"
