import type { Env } from "../_common/env.js"

// The handler's code (grapher library, React SSR) is imported lazily so that a
// new isolate doesn't evaluate it unless it serves this route.
export const onRequest: PagesFunction<Env> = async (context) => {
    const { handleGrapherRequest } =
        await import("../_common/lazyRoutes/grapherSlug.js")
    return handleGrapherRequest(context)
}
