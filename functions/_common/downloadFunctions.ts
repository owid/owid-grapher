import {
    fetchInputTableForConfig,
    Grapher,
    GrapherState,
    WORLD_ENTITY_NAME,
    getEntityNamesParam,
    generateSelectedEntityNamesParam,
    makeChartState,
    MapChartState,
} from "@ourworldindata/grapher"
import { omitUndefinedValues, excludeUndefined } from "@ourworldindata/utils"
import {
    OwidColumnDef,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_QUERY_PARAMS,
    Time,
} from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { StatusError } from "itty-router"
import { createZip, File } from "littlezipper"
import { assembleMetadata, getColumnsForMetadata } from "./metadataTools.js"
import { Env } from "./env.js"
import {
    getDataApiUrl,
    GrapherIdentifier,
    initGrapher,
} from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"
import { constructReadme } from "./readmeTools.js"

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

    const inputTable = await fetchInputTableForConfig(
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors,
        getDataApiUrl(env),
        undefined
    )
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
    const inputTable = await fetchInputTableForConfig(
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors,
        getDataApiUrl(env),
        undefined
    )
    grapher.grapherState.inputTable = inputTable
    ensureDownloadOfDataAllowed(grapher.grapherState)
    const metadata = assembleMetadata(grapher.grapherState, searchParams)
    const readme = assembleReadme(grapher, searchParams)
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
function assembleCsv(
    grapherState: GrapherState,
    searchParams: URLSearchParams
): string {
    const useShortNames = searchParams.get("useColumnShortNames") === "true"
    const fullTable = grapherState.inputTable
    const filteredTable = grapherState.isOnTableTab
        ? grapherState.tableForDisplay
        : grapherState.transformedTable
    const table =
        searchParams.get("csvType") === "filtered" ? filteredTable : fullTable
    return table.toPrettyCsv(useShortNames)
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
    const inputTable = await fetchInputTableForConfig(
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors,
        getDataApiUrl(env),
        undefined
    )
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

function ensureDownloadOfDataAllowed(grapherState: GrapherState) {
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

    const inputTable = await fetchInputTableForConfig(
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors,
        getDataApiUrl(env),
        undefined
    )
    grapher.grapherState.inputTable = inputTable

    const readme = assembleReadme(
        grapher,
        searchParams,
        multiDimAvailableDimensions
    )
    return new Response(readme, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
        },
    })
}

function assembleReadme(
    grapher: Grapher,
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
): string {
    const metadataCols = getColumnsForMetadata(grapher.grapherState)
    return constructReadme(
        grapher.grapherState,
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
    // This endpoint returns data for a single entity/country. If the 'country'
    // query param is provided, the first entity is used. It defaults to 'World'
    // when no entity is provided.
    const entityNames = getEntityNamesParam(
        searchParams.get("country") ?? undefined
    )
    const entityName = entityNames?.[0] ?? WORLD_ENTITY_NAME

    // We update the search params to ensure the entity is selected, which is
    // necessary for it to be included in the chart's `transformedTable` that is
    // later used to retrieve the data.
    searchParams.set("country", generateSelectedEntityNamesParam([entityName]))

    // If no tab param is specified, default to the chart tab
    const tab = searchParams.get("tab") ?? GRAPHER_TAB_QUERY_PARAMS.chart
    searchParams.set("tab", tab)

    // Initialize Grapher and download its data
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams,
        env
    )
    const inputTable = await fetchInputTableForConfig(
        grapher.grapherState.dimensions,
        grapher.grapherState.selectedEntityColors,
        getDataApiUrl(env),
        undefined
    )
    grapher.grapherState.inputTable = inputTable

    const { grapherState } = grapher

    // If the entity is invalid or not included in the chart, we can't return
    // any data, so we return the source only
    if (!grapherState.availableEntityNames.includes(entityName))
        return Response.json({ source: grapherState.sourcesLine })

    // Find the relevant times
    const endTime = grapherState.endTime
    const startTime =
        grapherState.startTime !== grapherState.endTime
            ? grapherState.startTime
            : undefined

    // Create a map chart state to access custom label formatting.
    // When `map.tooltipUseCustomLabels` is enabled, this allows us to display
    // custom color scheme labels (e.g. "Low", "Medium", "High") instead of
    // the numeric values
    const mapChartState = makeChartState(
        GRAPHER_MAP_TYPE,
        grapherState
    ) as MapChartState

    /**
     * Returns the transformed column for the given slug.
     *
     * Note that the chart's transformed table is used, rather than
     * grapherState.transformedTable, because in rare cases the
     * chart's transformed table includes transformations that are not
     * applied to grapherState.transformedTable (e.g. relative mode in
     * line charts).
     */
    const getTransformedColumn = (grapherState: GrapherState, slug: string) =>
        grapherState.chartState.transformedTable.get(slug)

    const makeDimensionValueForColumnAndTime = (
        column: CoreColumn,
        time: Time
    ) => {
        if (column.isMissing) return undefined

        const owidRow = column.owidRowByEntityNameAndTime
            .get(entityName)
            ?.get(time)

        const value = owidRow?.value
        if (value === undefined) return { columnSlug: column.def.slug }

        return omitUndefinedValues({
            columnSlug: column.def.slug,

            value,
            formattedValue: column.formatValue(value),
            formattedValueShort: column.formatValueShort(value),
            formattedValueShortWithAbbreviations:
                column.formatValueShortWithAbbreviations(value),

            valueLabel: mapChartState.formatTooltipValueIfCustom(value),

            time: owidRow.originalTime,
            formattedTime: column.formatTime(owidRow.originalTime),
        })
    }

    const makeDimensionValuesForTime = (
        grapherState: GrapherState,
        time?: Time
    ) => {
        if (time === undefined) return undefined

        const ySlugs = grapherState.yColumnSlugs
        const xSlug = grapherState.xColumnSlug

        return omitUndefinedValues({
            y: ySlugs.map((ySlug) =>
                makeDimensionValueForColumnAndTime(
                    getTransformedColumn(grapherState, ySlug),
                    time
                )
            ),
            x: makeDimensionValueForColumnAndTime(
                getTransformedColumn(grapherState, xSlug),
                time
            ),
        })
    }

    const makeColumnInfo = (column: CoreColumn) => {
        if (column.isMissing) return undefined

        return omitUndefinedValues({
            name: column.titlePublicOrDisplayName.title,
            unit: column.unit,
            shortUnit: column.shortUnit,
            isProjection: column.isProjection ? true : undefined,
        })
    }

    const makeColumnInfoForRelevantSlugs = (grapherState: GrapherState) => {
        const targetSlugs = excludeUndefined([
            ...grapherState.yColumnSlugs,
            grapherState.xColumnSlug,
        ])

        const dimInfo = {}
        for (const slug of targetSlugs) {
            if (dimInfo[slug] !== undefined) continue
            const column = getTransformedColumn(grapherState, slug)
            const info = makeColumnInfo(column)
            if (info !== undefined) dimInfo[slug] = info
        }

        return dimInfo
    }

    const result = omitUndefinedValues({
        entityName,
        columns: makeColumnInfoForRelevantSlugs(grapherState),
        startTime: makeDimensionValuesForTime(grapherState, startTime),
        endTime: makeDimensionValuesForTime(grapherState, endTime),
        source: grapherState.sourcesLine,
    })

    return Response.json(result)
}
