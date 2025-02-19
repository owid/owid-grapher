/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import { TaggableType } from "@ourworldindata/types"
import { DeployQueueServer } from "../baker/DeployQueueServer.js"
import {
    updateVariableAnnotations,
    getChartBulkUpdate,
    updateBulkChartConfigs,
    getVariableAnnotations,
} from "./apiRoutes/bulkUpdates.js"
import {
    getChartViews,
    getChartViewById,
    createChartView,
    updateChartView,
    deleteChartView,
    getChartViewReferences,
} from "./apiRoutes/chartViews.js"
import {
    getDatasets,
    getDataset,
    updateDataset,
    setArchived,
    setTags,
    deleteDataset,
    republishCharts,
} from "./apiRoutes/datasets.js"
import { addExplorerTags, deleteExplorerTags } from "./apiRoutes/explorer.js"
import {
    getAllGdocIndexItems,
    getIndividualGdoc,
    createOrUpdateGdoc,
    deleteGdoc,
    setGdocTags,
} from "./apiRoutes/gdocs.js"
import {
    getImagesHandler,
    postImageHandler,
    putImageHandler,
    patchImageHandler,
    deleteImageHandler,
    getImageUsageHandler,
} from "./apiRoutes/images.js"
import {
    handlePutMultiDim,
    handleGetMultiDims,
    handlePatchMultiDim,
} from "./apiRoutes/mdims.js"
import {
    fetchAllWork,
    fetchNamespaces,
    fetchSourceById,
} from "./apiRoutes/misc.js"
import {
    handleGetPostsJson,
    handleSetTagsForPost,
    handleGetPostById,
    handleCreateGdoc,
    handleUnlinkGdoc,
} from "./apiRoutes/posts.js"
import {
    handleGetSiteRedirects,
    handlePostNewSiteRedirect,
    handleDeleteSiteRedirect,
    handleGetRedirects,
    handlePostNewChartRedirect,
    handleDeleteChartRedirect,
} from "./apiRoutes/redirects.js"
import { triggerStaticBuild } from "./apiRoutes/routeUtils.js"
import { suggestGptTopics, suggestGptAltText } from "./apiRoutes/suggest.js"
import {
    handleGetFlatTagGraph,
    handlePostTagGraph,
} from "./apiRoutes/tagGraph.js"
import {
    getTagById,
    updateTag,
    createTag,
    getAllTags,
    deleteTag,
} from "./apiRoutes/tags.js"
import {
    getUsers,
    getUserByIdHandler,
    deleteUser,
    updateUserHandler,
    addUser,
    addImageToUser,
    removeUserImage,
} from "./apiRoutes/users.js"
import {
    getEditorVariablesJson,
    getVariableDataJson,
    getVariableMetadataJson,
    getVariablesJson,
    getVariablesUsagesJson,
    getVariablesGrapherConfigETLPatchConfigJson,
    getVariablesGrapherConfigAdminPatchConfigJson,
    getVariablesMergedGrapherConfigJson,
    getVariablesVariableIdJson,
    putVariablesVariableIdGrapherConfigETL,
    deleteVariablesVariableIdGrapherConfigETL,
    putVariablesVariableIdGrapherConfigAdmin,
    deleteVariablesVariableIdGrapherConfigAdmin,
    getVariablesVariableIdChartsJson,
} from "./apiRoutes/variables.js"
import { FunctionalRouter } from "./FunctionalRouter.js"
import {
    patchRouteWithRWTransaction,
    getRouteWithROTransaction,
    postRouteWithRWTransaction,
    putRouteWithRWTransaction,
    deleteRouteWithRWTransaction,
    getRouteNonIdempotentWithRWTransaction,
} from "./functionalRouterHelpers.js"
import {
    getChartsJson,
    getChartsCsv,
    getChartConfigJson,
    getChartParentJson,
    getChartPatchConfigJson,
    getChartLogsJson,
    getChartReferencesJson,
    getChartRedirectsJson,
    getChartPageviewsJson,
    createChart,
    setChartTagsHandler,
    updateChart,
    deleteChart,
    getChartTagsJson,
} from "./apiRoutes/charts.js"

const apiRouter = new FunctionalRouter()

// Bulk chart update routes
patchRouteWithRWTransaction(
    apiRouter,
    "/variable-annotations",
    updateVariableAnnotations
)
getRouteWithROTransaction(apiRouter, "/chart-bulk-update", getChartBulkUpdate)
patchRouteWithRWTransaction(
    apiRouter,
    "/chart-bulk-update",
    updateBulkChartConfigs
)
getRouteWithROTransaction(
    apiRouter,
    "/variable-annotations",
    getVariableAnnotations
)

// Chart routes
getRouteWithROTransaction(apiRouter, "/charts.json", getChartsJson)
getRouteWithROTransaction(apiRouter, "/charts.csv", getChartsCsv)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.config.json",
    getChartConfigJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.parent.json",
    getChartParentJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.patchConfig.json",
    getChartPatchConfigJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.logs.json",
    getChartLogsJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.references.json",
    getChartReferencesJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.redirects.json",
    getChartRedirectsJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.pageviews.json",
    getChartPageviewsJson
)
getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.tags.json",
    getChartTagsJson
)
postRouteWithRWTransaction(apiRouter, "/charts", createChart)
postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/setTags",
    setChartTagsHandler
)
putRouteWithRWTransaction(apiRouter, "/charts/:chartId", updateChart)
deleteRouteWithRWTransaction(apiRouter, "/charts/:chartId", deleteChart)

// Chart view routes
getRouteWithROTransaction(apiRouter, "/chartViews", getChartViews)
getRouteWithROTransaction(
    apiRouter,
    "/chartViews/:id.config.json",
    getChartViewById
)
postRouteWithRWTransaction(apiRouter, "/chartViews", createChartView)
putRouteWithRWTransaction(apiRouter, "/chartViews/:id", updateChartView)
deleteRouteWithRWTransaction(apiRouter, "/chartViews/:id", deleteChartView)
getRouteWithROTransaction(
    apiRouter,
    "/chartViews/:id.references.json",
    getChartViewReferences
)

// Dataset routes
getRouteWithROTransaction(apiRouter, "/datasets.json", getDatasets)
getRouteWithROTransaction(apiRouter, "/datasets/:datasetId.json", getDataset)
putRouteWithRWTransaction(apiRouter, "/datasets/:datasetId", updateDataset)
postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/setArchived",
    setArchived
)
postRouteWithRWTransaction(apiRouter, "/datasets/:datasetId/setTags", setTags)
deleteRouteWithRWTransaction(apiRouter, "/datasets/:datasetId", deleteDataset)
postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/charts",
    republishCharts
)

// explorer routes
postRouteWithRWTransaction(apiRouter, "/explorer/:slug/tags", addExplorerTags)
deleteRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    deleteExplorerTags
)

// Gdoc routes
getRouteWithROTransaction(apiRouter, "/gdocs", getAllGdocIndexItems)
getRouteNonIdempotentWithRWTransaction(
    apiRouter,
    "/gdocs/:id",
    getIndividualGdoc
)
putRouteWithRWTransaction(apiRouter, "/gdocs/:id", createOrUpdateGdoc)
deleteRouteWithRWTransaction(apiRouter, "/gdocs/:id", deleteGdoc)
postRouteWithRWTransaction(apiRouter, "/gdocs/:gdocId/setTags", setGdocTags)

// Images routes
getRouteNonIdempotentWithRWTransaction(
    apiRouter,
    "/images.json",
    getImagesHandler
)
postRouteWithRWTransaction(apiRouter, "/images", postImageHandler)
putRouteWithRWTransaction(apiRouter, "/images/:id", putImageHandler)
// Update alt text via patch
patchRouteWithRWTransaction(apiRouter, "/images/:id", patchImageHandler)
deleteRouteWithRWTransaction(apiRouter, "/images/:id", deleteImageHandler)
getRouteWithROTransaction(apiRouter, "/images/usage", getImageUsageHandler)

// Mdim routes
getRouteWithROTransaction(apiRouter, "/multi-dims.json", handleGetMultiDims)
putRouteWithRWTransaction(apiRouter, "/multi-dim/:slug", handlePutMultiDim)
patchRouteWithRWTransaction(apiRouter, "/multi-dims/:id", handlePatchMultiDim)

// Misc routes
getRouteWithROTransaction(apiRouter, "/all-work", fetchAllWork)
getRouteWithROTransaction(
    apiRouter,
    "/editorData/namespaces.json",
    fetchNamespaces
)
getRouteWithROTransaction(apiRouter, "/sources/:sourceId.json", fetchSourceById)

// Wordpress posts routes
getRouteWithROTransaction(apiRouter, "/posts.json", handleGetPostsJson)
postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/setTags",
    handleSetTagsForPost
)
getRouteWithROTransaction(apiRouter, "/posts/:postId.json", handleGetPostById)
postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/createGdoc",
    handleCreateGdoc
)
postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/unlinkGdoc",
    handleUnlinkGdoc
)

// Redirects routes
getRouteWithROTransaction(
    apiRouter,
    "/site-redirects.json",
    handleGetSiteRedirects
)
postRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/new",
    handlePostNewSiteRedirect
)
deleteRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/:id",
    handleDeleteSiteRedirect
)
getRouteWithROTransaction(apiRouter, "/redirects.json", handleGetRedirects)
postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/redirects/new",
    handlePostNewChartRedirect
)
deleteRouteWithRWTransaction(
    apiRouter,
    "/redirects/:id",
    handleDeleteChartRedirect
)

// GPT routes
getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-topics/${TaggableType.Charts}/:chartId.json`,
    suggestGptTopics
)
getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-alt-text/:imageId`,
    suggestGptAltText
)

// Tag graph routes
getRouteWithROTransaction(
    apiRouter,
    "/flatTagGraph.json",
    handleGetFlatTagGraph
)
postRouteWithRWTransaction(apiRouter, "/tagGraph", handlePostTagGraph)
getRouteWithROTransaction(apiRouter, "/tags/:tagId.json", getTagById)
putRouteWithRWTransaction(apiRouter, "/tags/:tagId", updateTag)
postRouteWithRWTransaction(apiRouter, "/tags/new", createTag)
getRouteWithROTransaction(apiRouter, "/tags.json", getAllTags)
deleteRouteWithRWTransaction(apiRouter, "/tags/:tagId/delete", deleteTag)

// User routes
getRouteWithROTransaction(apiRouter, "/users.json", getUsers)
getRouteWithROTransaction(apiRouter, "/users/:userId.json", getUserByIdHandler)
deleteRouteWithRWTransaction(apiRouter, "/users/:userId", deleteUser)
putRouteWithRWTransaction(apiRouter, "/users/:userId", updateUserHandler)
postRouteWithRWTransaction(apiRouter, "/users/add", addUser)
postRouteWithRWTransaction(
    apiRouter,
    "/users/:userId/images/:imageId",
    addImageToUser
)
deleteRouteWithRWTransaction(
    apiRouter,
    "/users/:userId/images/:imageId",
    removeUserImage
)

// Variable routes
getRouteWithROTransaction(
    apiRouter,
    "/editorData/variables.json",
    getEditorVariablesJson
)
getRouteWithROTransaction(
    apiRouter,
    "/data/variables/data/:variableStr.json",
    getVariableDataJson
)
getRouteWithROTransaction(
    apiRouter,
    "/data/variables/metadata/:variableStr.json",
    getVariableMetadataJson
)
getRouteWithROTransaction(apiRouter, "/variables.json", getVariablesJson)
getRouteWithROTransaction(
    apiRouter,
    "/variables.usages.json",
    getVariablesUsagesJson
)
getRouteWithROTransaction(
    apiRouter,
    "/variables/grapherConfigETL/:variableId.patchConfig.json",
    getVariablesGrapherConfigETLPatchConfigJson
)
getRouteWithROTransaction(
    apiRouter,
    "/variables/grapherConfigAdmin/:variableId.patchConfig.json",
    getVariablesGrapherConfigAdminPatchConfigJson
)
getRouteWithROTransaction(
    apiRouter,
    "/variables/mergedGrapherConfig/:variableId.json",
    getVariablesMergedGrapherConfigJson
)
// Used in VariableEditPage
getRouteWithROTransaction(
    apiRouter,
    "/variables/:variableId.json",
    getVariablesVariableIdJson
)
// inserts a new config or updates an existing one
putRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigETL",
    putVariablesVariableIdGrapherConfigETL
)
deleteRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigETL",
    deleteVariablesVariableIdGrapherConfigETL
)
// inserts a new config or updates an existing one
putRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigAdmin",
    putVariablesVariableIdGrapherConfigAdmin
)
deleteRouteWithRWTransaction(
    apiRouter,
    "/variables/:variableId/grapherConfigAdmin",
    deleteVariablesVariableIdGrapherConfigAdmin
)
getRouteWithROTransaction(
    apiRouter,
    "/variables/:variableId/charts.json",
    getVariablesVariableIdChartsJson
)

// Deploy helpers
apiRouter.get("/deploys.json", async () => ({
    deploys: await new DeployQueueServer().getDeploys(),
}))

apiRouter.put("/deploy", async (req, res) => {
    return triggerStaticBuild(res.locals.user, "Manually triggered deploy")
})

export { apiRouter }
