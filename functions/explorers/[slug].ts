import { loadRenderRoutes } from "../_common/loadRenderRoutes.js"
import type { Env } from "../_common/env.js"

// The handler is loaded on first use, see loadRenderRoutes.
export const onRequest: PagesFunction<Env> = async (context) => {
    const { handleExplorerRequest } = await loadRenderRoutes()
    return handleExplorerRequest(context)
}
