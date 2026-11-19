import { loadRenderRoutes } from "../_common/loadRenderRoutes.js"
import type { Env } from "../_common/env.js"

// The handler is loaded on first use, see loadRenderRoutes.
export const onRequest: PagesFunction<Env> = async (context) => {
    const { handleGrapherRequest } = await loadRenderRoutes()
    return handleGrapherRequest(context)
}
