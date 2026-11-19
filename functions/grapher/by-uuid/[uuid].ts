import { loadRenderRoutes } from "../../_common/loadRenderRoutes.js"

// The handler is loaded on first use, see loadRenderRoutes.
export const onRequest: PagesFunction = async (context) => {
    const { handleGrapherByUuidRequest } = await loadRenderRoutes()
    return handleGrapherByUuidRequest(context)
}
