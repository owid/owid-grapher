// The handlers of the routes that render charts. They pull in the grapher and
// explorer libraries and React SSR, most of the Functions bundle, so they're
// only loaded through loadRenderRoutes().
export { handleExplorerRequest } from "./explorerSlug.js"
export { handleGrapherByUuidRequest } from "./grapherByUuid.js"
export { handleGrapherRequest } from "./grapherSlug.js"
export { handleMultiDimRequest } from "./multiDimSlug.js"
