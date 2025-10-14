import * as _ from "lodash-es"
import {
    fetchInputTableForConfig,
    GrapherState,
    WORLD_ENTITY_NAME,
    getEntityNamesParam,
    generateSelectedEntityNamesParam,
} from "@ourworldindata/grapher"
import {
    OwidColumnDef,
    GRAPHER_TAB_QUERY_PARAMS,
    EntityName,
} from "@ourworldindata/types"
import { error, StatusError } from "itty-router"
import { createZip, File } from "littlezipper"
import { assembleMetadata, getColumnsForMetadata } from "./metadataTools.js"
import { Env } from "./env.js"
import {
    getDataApiUrl,
    getGrapherTableWithRelevantColumns,
    GrapherIdentifier,
    initGrapher,
} from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"
import { constructReadme } from "./readmeTools.js"
import { constructSearchResultDataTableContent } from "./search/constructSearchResultDataTableContent.js"
import { constructGrapherValuesJson } from "./grapherValuesJson.js"
import { match } from "ts-pattern"
import {
    constructSearchResultJson,
    pickDisplayEntities,
    RichDataVariant,
} from "./search/constructSearchResultJson.js"

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
    grapher.grapherState.inputTable = inputTable

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
    grapher.grapherState.inputTable = inputTable
    ensureDownloadOfDataAllowed(grapher.grapherState)
    const metadata = assembleMetadata(grapher.grapherState, searchParams)
    const readme = assembleReadme(grapher.grapherState, searchParams)
    const csv = assembleCsv(grapher.grapherState, searchParams)
    console.log("Fetched the parts, creating zip file")

    const zipContent: File[] = [
        {
            path: `${identifier.id}.metadata.json`,
            data: JSON.stringify(metadata, undefined, 2),
        },
        { path: `${identifier.id}.csv`, data: csv },
        { path: "readme.md", data: readme },
    ]
    const content = await createZip(zipContent)
    console.log("Generated content, returning response")
    return new Response(content, {
        headers: {
            "Content-Type": "application/zip",
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

    const table = getGrapherTableWithRelevantColumns(grapherState, {
        shouldUseFilteredTable,
    })

    return table.toPrettyCsv(shouldUseShortNames)
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
    grapher.grapherState.inputTable = inputTable
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
            (col) => (col.def as OwidColumnDef).nonRedistributable
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
    grapher.grapherState.inputTable = inputTable

    const readme = assembleReadme(
        grapher.grapherState,
        searchParams,
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

export async function fetchDataValuesForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams: URLSearchParams
) {
    const entityName = findEntityForExtractingDataValues(searchParams)
    prepareSearchParamsBeforeExtractingDataValues(searchParams, entityName)

    // Initialize Grapher and download its data
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams,
        env
    )
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    grapher.grapherState.inputTable = inputTable

    // Make sure the country query param is respected since Grapher ignores
    // the country param if entity selection is disabled
    const entityNames = getEntityNamesParam(
        searchParams.get("country") ?? undefined
    )
    if (entityNames?.length > 0)
        grapher.grapherState.selection.setSelectedEntities(entityNames)

    const dataValues = assembleDataValues(grapher.grapherState, entityName)

    return Response.json(dataValues)
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
    searchParams: URLSearchParams
) {
    const supportedVersions = [1]
    const version = parseVersionParam(
        searchParams.get("version"),
        supportedVersions.at(-1)
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
    const dataApiUrl = getDataApiUrl(env)
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl,
    })
    grapher.grapherState.inputTable = inputTable

    const searchResult = await assembleSearchResultData(grapher.grapherState, {
        variant,
        pickedEntities,
        numDataTableRowsPerColumn,
        dataApiUrl,
    })

    if (searchResult === undefined)
        return error(500, "Unable to generate search result data")

    return Response.json(searchResult)
}

export async function assembleSearchResultData(
    grapherState: GrapherState,
    args: {
        variant: RichDataVariant
        pickedEntities: EntityName[]
        numDataTableRowsPerColumn: number
        dataApiUrl: string
    }
) {
    // Choose the entities to display
    const displayEntities = await pickDisplayEntities(grapherState, args)

    return constructSearchResultJson(grapherState, { ...args, displayEntities })
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
