// Library entry point for @ourworldindata/grapher (see tsdown.config.ts).
// This bundles everything needed for external consumers:
// the full JS API plus grapher styles.

// Base styles for the Tippy tooltips grapher themes in grapher.scss; without
// them tooltips have no padding, corner radius or arrow. The site and the admin
// import this in their own stylesheets (site/owid.scss, adminSiteClient/
// admin.scss), so the standalone package has to bring its own copy.
// Imported here rather than from grapher.scss because Sass passes `.css`
// imports through as plain `@import` rules that the CSS build doesn't resolve.
import "tippy.js/dist/tippy.css"

import "./core/grapher.scss"
export * from "./grapher.public.js"
