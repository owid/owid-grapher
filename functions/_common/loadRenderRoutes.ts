import type * as RenderRoutes from "./lazyRoutes/index.js"

// Loads the chart-rendering handlers on first use, so that a new isolate
// serving any other route doesn't evaluate them. They're still part of the
// Worker script, which every isolate parses.
export const loadRenderRoutes = (): Promise<typeof RenderRoutes> =>
    import("./lazyRoutes/index.js")
