import type * as RenderRoutes from "./lazyRoutes/index.js"

// Loads the chart-rendering handlers on first use, so that a new isolate
// serving any other route never evaluates them. Keep this the only import of
// lazyRoutes/: devTools/pagesWorker/buildPagesWorker.ts turns this exact
// import into a separately uploaded module, which a new isolate doesn't even
// parse until a render route needs it.
export const loadRenderRoutes = (): Promise<typeof RenderRoutes> =>
    import("./lazyRoutes/index.js")
