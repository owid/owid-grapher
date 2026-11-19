import { loadRenderRoutes } from "../_common/loadRenderRoutes.js"
import type { Env } from "../_common/env.js"

// The handler is loaded on first use, see loadRenderRoutes.
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { handleMultiDimRequest } = await loadRenderRoutes()
    return handleMultiDimRequest(context)
}
