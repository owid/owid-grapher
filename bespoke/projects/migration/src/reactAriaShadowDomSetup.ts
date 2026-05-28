// react-stately@3.46+ bundles its own private flag module with state that's
// separate from the standalone @react-stately/flags package — and the v1.17
// react-aria internals (which the migration vite.config aliases everything
// to) read from this bundled copy. We need to flip both flags.
import { enableShadowDOM } from "@react-stately/flags"
import { enableShadowDOM as enableShadowDOMBundled } from "react-stately/private/flags/flags"

// Must run before importing modules that create react-aria component trees.
enableShadowDOM() // TODO: drop this one?
enableShadowDOMBundled()
