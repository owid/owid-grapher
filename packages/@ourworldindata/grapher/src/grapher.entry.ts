// Library entry point for @ourworldindata/grapher (see tsdown.config.ts).
// This bundles everything needed for external consumers:
// the full JS API plus grapher styles.

// Base styles for the Tippy tooltips grapher themes in grapher.scss.
// The site and the admin import this in their own stylesheets, so
// the package has to bring its own copy.
// Imported here rather than from grapher.scss because Sass passes `.css`
// imports through as plain `@import` rules that the CSS build doesn't resolve.
import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"

import "./core/grapher.scss"
export * from "./grapher.public.js"
