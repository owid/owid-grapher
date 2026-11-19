import type { Env } from "../_common/env.js"

// The handler's code (grapherTools pulls in the grapher library) is imported
// lazily so that a new isolate doesn't evaluate it unless it serves this route.
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { handleMultiDimRequest } =
        await import("../_common/lazyRoutes/multiDimSlug.js")
    return handleMultiDimRequest(context)
}
