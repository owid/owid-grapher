import * as _ from "lodash-es"
import {
    fetchInputTableForConfig,
    GrapherState,
    WORLD_ENTITY_NAME,
    getEntityNamesParam,
    generateSelectedEntityNamesParam,
    constructGrapherValuesJson,
    constructGrapherValuesJsonFromTable,
    prepareCalloutTable,
} from "@ourworldindata/grapher"
import {
    GRAPHER_TAB_QUERY_PARAMS,
    EntityName,
    GrapherSearchResultJson,
    GrapherValuesJson,
} from "@ourworldindata/types"
import { error, StatusError } from "itty-router"
import { createZip, UncompressedFile } from "littlezipper"
import { assembleMetadata, getColumnsForMetadata } from "./metadataTools.js"
import { Env, extensions } from "./env.js"
import {
    getDataApiUrl,
    GrapherIdentifier,
    initGrapher,
} from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"
import { constructReadme } from "./readmeTools.js"
import { constructPageMarkdown } from "./pageMarkdownTools.js"
import { constructSearchResultDataTableContent } from "./search/constructSearchResultDataTableContent.js"
import { match } from "ts-pattern"
import {
    configureGrapherStateTab,
    constructSearchResultJson,
    getSortedGrapherTabsForChartHit,
    pickDisplayEntities,
    RichDataVariant,
} from "./search/constructSearchResultJson.js"
import { checkCache } from "./reusableHandlers.js"
import { slugify } from "@ourworldindata/utils"

export async function fetchMetadataForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("Initializing grapher")
    const { grapher, multiDimAvailableDimensions } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )

    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable

    const fullMetadata = assembleMetadata(
        grapher.grapherState,
        searchParams ?? new URLSearchParams(""),
        multiDimAvailableDimensions
    )

    return Response.json(fullMetadata)
}

export async function fetchZipForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("preparing to generate zip file")
    const { grapher, identifierType: effectiveIdentifierType } =
        await initGrapher(
            identifier,
            TWITTER_OPTIONS,
            searchParams ?? new URLSearchParams(""),
            env
        )
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable
    ensureDownloadOfDataAllowed(grapher.grapherState)
    const effectiveSearchParams = searchParams ?? new URLSearchParams("")
    const metadata = assembleMetadata(
        grapher.grapherState,
        effectiveSearchParams
    )
    const readme = assembleReadme(grapher.grapherState, effectiveSearchParams)
    const csv = assembleCsv(grapher.grapherState, effectiveSearchParams)
    console.log("Fetched the parts, creating zip file")

    // Use the slugified display title as filename for multi-dims
    let filename = identifier.id
    if (effectiveIdentifierType === "multi-dim-slug") {
        filename = slugify(grapher.grapherState.effectiveTitle)
    }

    const zipContent: UncompressedFile[] = [
        {
            path: `${filename}.metadata.json`,
            data: JSON.stringify(metadata, undefined, 2),
        },
        { path: `${filename}.csv`, data: csv },
        { path: "readme.md", data: readme },
    ]
    const content = await createZip(zipContent)
    console.log("Generated content, returning response")
    return new Response(content, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${filename}.zip"`,
        },
    })
}

export function assembleCsv(
    grapherState: GrapherState,
    searchParams: URLSearchParams
): string {
    const shouldUseShortNames =
        searchParams.get("useColumnShortNames") === "true"
    const shouldUseFilteredTable = searchParams.get("csvType") === "filtered"

    const table = shouldUseFilteredTable
        ? grapherState.filteredTableForDownload
        : grapherState.tableForDownload

    return table.toPrettyCsv({ useShortNames: shouldUseShortNames })
}

export async function fetchCsvForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable
    console.log("checking if download is allowed")
    ensureDownloadOfDataAllowed(grapher.grapherState)
    console.log("data download is allowed")
    const csv = assembleCsv(
        grapher.grapherState,
        searchParams ?? new URLSearchParams("")
    )
    return new Response(csv, {
        headers: {
            "Content-Type": "text/csv",
        },
    })
}

export function ensureDownloadOfDataAllowed(grapherState: GrapherState) {
    if (
        grapherState.inputTable.columnsAsArray.some(
            (col) => col.def.nonRedistributable
        )
    ) {
        throw new StatusError(
            403,
            "This chart contains non-redistributable data that we are not allowed to re-share and it therefore cannot be downloaded as a CSV."
        )
    }
}

export async function fetchReadmeForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("Initializing grapher")
    const { grapher, multiDimAvailableDimensions } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )

    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable

    const readme = assembleReadme(
        grapher.grapherState,
        searchParams ?? new URLSearchParams(""),
        multiDimAvailableDimensions
    )
    return new Response(readme, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
        },
    })
}

export function assembleReadme(
    grapherState: GrapherState,
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
): string {
    const metadataCols = getColumnsForMetadata(grapherState)
    return constructReadme(
        grapherState,
        metadataCols,
        searchParams,
        multiDimAvailableDimensions
    )
}

export async function fetchMarkdownForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams,
    ctx?: EventContext<unknown, any, Record<string, unknown>>
) {
    const params = searchParams ?? new URLSearchParams("")

    // Assembling the markdown means fetching the indicator's full data and
    // building the table, about a second; cache it for an hour like
    // `.values.json`. The key is the `.md` URL for this view, so the page URL
    // negotiated to markdown and the explicit `.md` URL share one entry, and the
    // HTML page's own cache entry is never confused with it (the edge cache
    // ignores `Vary`).
    const shouldCache = ctx !== undefined && params.get("nocache") === null
    // `nocache` asks this handler to skip its cache; it selects no view, so it
    // belongs in neither the cache key nor the data URLs the document prints.
    const viewParams = new URLSearchParams(params)
    viewParams.delete("nocache")
    const viewSearch = viewParams.size > 0 ? `?${viewParams.toString()}` : ""
    const cacheKey = new Request(
        `${env.url.origin}/grapher/${identifier.id}${extensions.markdown}${viewSearch}`
    )
    if (shouldCache) {
        const cached = await checkCache(cacheKey, true)
        if (cached) return cached
    }

    console.log("Initializing grapher")
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        params,
        env
    )
    const { grapherState } = grapher

    const inputTable = await fetchInputTableForConfig({
        dimensions: grapherState.dimensions,
        selectedEntityColors: grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapherState.inputTable = inputTable
    // The per-entity table below is a full data extract, so it falls under the same
    // licensing restriction as the CSV and zip downloads.
    ensureDownloadOfDataAllowed(grapherState)

    // Grapher ignores the country param when entity selection is disabled, so read
    // it back explicitly; with no country param the chart's own default selection is
    // what a reader arriving at this URL sees.
    const requestedEntities = getEntityNamesParam(
        params.get("country") ?? undefined
    )
    const entityNames = (
        requestedEntities?.length
            ? requestedEntities
            : // Snapshot: assembleDataValues reassigns the selection per entity.
              [...grapherState.selection.selectedEntityNames]
    ).filter((entityName) =>
        grapherState.availableEntityNames.includes(entityName)
    )

    // `constructGrapherValuesJson` reassigns the chart's selection to the one
    // entity it reports on, which invalidates Grapher's computed chain and
    // re-runs the transform pipeline over the whole table — 44% of the time
    // spent assembling this document on a chart with seven selected entities.
    // The batch form prepares the table once and then does a lookup per entity.
    // It reads the input table rather than the chart-transformed one, so a chart
    // whose values are transformed for display keeps the slower path: in
    // relative mode the table would otherwise print absolutes where the chart
    // shows percentages.
    //
    // Neither form is given the `time` param: initGrapher applied the query
    // string, so grapherState's bounds are already resolved against the data,
    // and passing the raw value through would replace those snapped bounds with
    // an exact lookup and blank out every cell on a series that has no
    // observation in precisely that year.
    let valuesByEntity: GrapherValuesJson[]
    if (entityNames.length === 0) {
        // A chart with no entity selected — a scatter plot, typically — has no
        // values block to build, and preparing a table for it is pure cost.
        valuesByEntity = []
    } else if (grapherState.isRelativeMode) {
        valuesByEntity = entityNames.map((entityName) =>
            assembleDataValues(grapherState, entityName)
        )
    } else {
        const prepared = prepareCalloutTable(grapherState.inputTable, {
            ...grapherState.object,
            minTime: grapherState.startTime,
            maxTime: grapherState.endTime,
        })
        valuesByEntity = entityNames.map((entityName) =>
            constructGrapherValuesJsonFromTable(prepared, entityName)
        )
    }

    const markdown = constructPageMarkdown(
        grapherState,
        getColumnsForMetadata(grapherState),
        valuesByEntity,
        viewSearch
    )
    const response = new Response(markdown, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": shouldCache ? "max-age=3600" : "no-cache",
        },
    })
    if (shouldCache)
        ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
    return response
}

export async function fetchDataValuesForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams: URLSearchParams,
    ctx: EventContext<unknown, any, Record<string, unknown>>
) {
    // Check cache
    const shouldCache = searchParams.get("nocache") === null
    const cachedResponse = await checkCache(ctx.request, shouldCache)
    if (cachedResponse) return cachedResponse

    const entityName = findEntityForExtractingDataValues(searchParams)
    prepareSearchParamsBeforeExtractingDataValues(searchParams, entityName)

    // Initialize Grapher and download its data
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams,
        env
    )

    // Optionally ignore projected data if requested
    const shouldIgnoreProjections = searchParams.has("ignoreProjections")
    if (shouldIgnoreProjections) dropProjectionColumns(grapher.grapherState)

    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable

    // Make sure the country query param is respected since Grapher ignores
    // the country param if entity selection is disabled
    const entityNames = getEntityNamesParam(
        searchParams.get("country") ?? undefined
    )
    if (entityNames && entityNames.length > 0)
        grapher.grapherState.selection.setSelectedEntities(entityNames)

    const dataValues = assembleDataValues(grapher.grapherState, entityName)

    const cacheControl = shouldCache ? "max-age=3600" : "no-cache"
    const response = Response.json(dataValues, {
        headers: { "Cache-Control": cacheControl },
    })

    // Cache the response
    if (shouldCache)
        ctx.waitUntil(caches.default.put(ctx.request, response.clone()))

    return response
}

export function assembleDataValues(
    grapherState: GrapherState,
    entityName: EntityName
) {
    // If the entity is invalid or not included in the chart, we can't return
    // any data, so we return the source only
    if (!grapherState.availableEntityNames.includes(entityName))
        return { source: grapherState.sourcesLine }

    return constructGrapherValuesJson(grapherState, entityName)
}

export async function fetchSearchResultDataForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams: URLSearchParams,
    ctx: EventContext<unknown, any, Record<string, unknown>>
) {
    // Check cache
    const shouldCache = searchParams.get("nocache") === null
    const cachedResponse = await checkCache(ctx.request, shouldCache)
    if (cachedResponse) return cachedResponse

    const supportedVersions = [1]
    const version = parseVersionParam(
        searchParams.get("version"),
        supportedVersions.at(-1)!
    )

    // Validate version
    if (!supportedVersions.includes(version)) {
        return error(
            400,
            `Unsupported version: ${version}. Supported versions: ${supportedVersions.join(
                ", "
            )}`
        )
    }

    // Entities selected by the user
    const pickedEntities =
        getEntityNamesParam(searchParams.get("entities") ?? undefined) ?? []

    // Parse options
    const variant = parseVariantParam(searchParams.get("variant"))
    const numDataTableRowsPerColumn = parseNumDataTableRowsPerColumnParam(
        searchParams.get("numDataTableRowsPerColumn")
    )

    // Initialize Grapher and download its data
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams,
        env
    )

    // Optionally ignore projected data if requested
    const shouldIgnoreProjections = searchParams.has("ignoreProjections")
    if (shouldIgnoreProjections) dropProjectionColumns(grapher.grapherState)

    const dataApiUrl = getDataApiUrl(env)
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl,
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable

    const catalogUrl = env.CATALOG_URL
    const searchResult = await assembleSearchResultData(grapher.grapherState, {
        variant,
        pickedEntities,
        numDataTableRowsPerColumn,
        catalogUrl,
    })

    if (searchResult === undefined)
        return error(500, "Unable to generate search result data")

    const cacheControl = shouldCache ? "max-age=3600" : "no-cache"
    const response = Response.json(searchResult, {
        headers: { "Cache-Control": cacheControl },
    })

    // Cache the response
    if (shouldCache)
        ctx.waitUntil(caches.default.put(ctx.request, response.clone()))

    return response
}

export async function assembleSearchResultData(
    grapherState: GrapherState,
    args: {
        variant: RichDataVariant
        pickedEntities: EntityName[]
        numDataTableRowsPerColumn: number
        catalogUrl: string
    }
): Promise<GrapherSearchResultJson | undefined> {
    // Find Grapher tabs to display and bring them in the right order
    const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)

    // Ensure the primary tab is currently active
    configureGrapherStateTab(grapherState, { tab: sortedTabs[0] })

    // Choose the entities to display
    const displayEntities = await pickDisplayEntities(grapherState, args)

    return constructSearchResultJson(grapherState, {
        ...args,
        sortedTabs,
        displayEntities,
    })
}

export function assembleSearchResultDataTable(grapherState: GrapherState) {
    return constructSearchResultDataTableContent({ grapherState })
}

export function findEntityForExtractingDataValues(
    searchParams: URLSearchParams
): string {
    // This endpoint returns data for a single entity/country. If the 'country'
    // query param is provided, the first entity is used. It defaults to 'World'
    // when no entity is provided.
    const entityNames = getEntityNamesParam(
        searchParams.get("country") ?? undefined
    )
    const entityName = entityNames?.[0] ?? WORLD_ENTITY_NAME
    return entityName
}

export function prepareSearchParamsBeforeExtractingDataValues(
    searchParams: URLSearchParams,
    entityName: EntityName
): void {
    // We update the search params to ensure the entity is selected, which is
    // necessary for it to be included in the chart's `transformedTable` that is
    // later used to retrieve the data.
    searchParams.set("country", generateSelectedEntityNamesParam([entityName]))

    // If no tab param is specified, default to the chart tab
    const tab = searchParams.get("tab") ?? GRAPHER_TAB_QUERY_PARAMS.chart
    searchParams.set("tab", tab)
}

export function parseVariantParam(variant: string | null): RichDataVariant {
    const { Large, Medium } = RichDataVariant
    return match(variant?.toLocaleLowerCase())
        .with(Large, () => Large)
        .with(Medium, () => Medium)
        .otherwise(() => Medium)
}

export function parseNumDataTableRowsPerColumnParam(
    num: string | null
): number {
    const numDataTableRowsPerColumn = parseInt(num ?? "", 10)
    if (isNaN(numDataTableRowsPerColumn)) return 4
    return numDataTableRowsPerColumn
}

export function parseVersionParam(
    version: string | null,
    defaultVersion: number
): number {
    const numDataTableRowsPerColumn = parseInt(version ?? "", 10)
    if (isNaN(numDataTableRowsPerColumn)) return defaultVersion
    return numDataTableRowsPerColumn
}

export function dropProjectionColumns(grapherState: GrapherState) {
    grapherState.dimensions = grapherState.dimensions.filter(
        (dim) => !dim.display.isProjection
    )
}
