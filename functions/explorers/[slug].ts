import type { Env } from "../_common/env.js"

// The handler's code (explorer and grapher libraries, React SSR) is imported
// lazily so that a new isolate doesn't evaluate it unless it serves this route.
export const onRequest: PagesFunction<Env> = async (context) => {
    const { handleExplorerRequest } =
        await import("../_common/lazyRoutes/explorerSlug.js")
    return handleExplorerRequest(context)
}
