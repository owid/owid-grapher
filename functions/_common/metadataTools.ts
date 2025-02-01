import { Grapher, GrapherState } from "@ourworldindata/grapher"
import {
    OwidTableSlugs,
    OwidOrigin,
    OwidColumnDef,
} from "@ourworldindata/types"
import {
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getCitationShort,
    getAttributionFragmentsFromVariable,
    getCitationLong,
} from "@ourworldindata/utils"
import { getGrapherFilters } from "./urlTools.js"

type MetadataColumn = {
    titleShort: string
    titleLong: string
    descriptionShort: string
    descriptionKey: string[]
    descriptionProcessing: string
    shortUnit: string
    unit: string
    timespan: string
    tolerance: number
    type: string
    conversionFactor: number
    owidVariableId: number
    shortName: string
    lastUpdated: string
    nextUpdate: string
    citationShort: string
    citationLong: string
    fullMetadata: string
}

export const getColumnsForMetadata = (grapherState: GrapherState) => {
    const columnsToIgnore = new Set(
        [
            OwidTableSlugs.entityId,
            OwidTableSlugs.time,
            OwidTableSlugs.entityColor,
            OwidTableSlugs.entityName,
            OwidTableSlugs.entityCode,
            OwidTableSlugs.year,
            OwidTableSlugs.day,
        ].map((slug) => slug.toString())
    )

    const colsToGet = grapherState.inputTable.columnSlugs.filter(
        (col) => !columnsToIgnore.has(col)
    )

    return grapherState.inputTable.getColumns(colsToGet)
}
export function assembleMetadata(
    grapherState: GrapherState,
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
) {
    const useShortNames = searchParams.get("useColumnShortNames") === "true"

    const metadataCols = getColumnsForMetadata(grapherState)

    const columns: [string, MetadataColumn][] = metadataCols.map((col) => {
        const {
            descriptionShort,
            descriptionKey,
            descriptionProcessing,
            shortUnit,
            unit,
            timespan,
            tolerance,
            type,
            origins,
            sourceLink,
            sourceName,
            owidVariableId,
            shortName,
        } = col.def as OwidColumnDef
        const lastUpdated = getLastUpdatedFromVariable(col.def)
        const nextUpdate = getNextUpdateFromVariable(col.def)

        let condensedOrigins:
            | Partial<
                  Pick<
                      OwidOrigin,
                      | "attribution"
                      | "attributionShort"
                      | "description"
                      | "urlDownload"
                      | "urlMain"
                  >
              >[]
            | undefined = origins?.map((origin) => {
            const {
                attribution,
                attributionShort,
                description,
                citationFull,
                urlDownload,
                urlMain,
                dateAccessed,
            } = origin
            return {
                attribution,
                attributionShort,
                description,
                urlDownload,
                urlMain,
                dateAccessed,
                citationFull,
            }
        })

        if (!condensedOrigins || condensedOrigins.length === 0) {
            condensedOrigins = [
                {
                    attribution: sourceName,
                    urlMain: sourceLink,
                },
            ]
        }

        const def = col.def as OwidColumnDef

        const citationShort = getCitationShort(
            condensedOrigins,
            getAttributionFragmentsFromVariable(def),
            def.owidProcessingLevel
        )

        const citationLong = getCitationLong(
            col.titlePublicOrDisplayName,
            def.origins ?? [],
            col.source ?? {},
            getAttributionFragmentsFromVariable(def),
            def.presentation?.attributionShort,
            def.presentation?.titleVariant,
            def.owidProcessingLevel,
            undefined
        )

        const titleShort = col.titlePublicOrDisplayName.title
        const attributionShort = col.titlePublicOrDisplayName.attributionShort
        const titleVariant = col.titlePublicOrDisplayName.titleVariant
        const attributionString =
            attributionShort && titleVariant
                ? `${attributionShort} – ${titleVariant}`
                : attributionShort || titleVariant
        const titleModifier = attributionString ? ` - ${attributionString}` : ""
        const titleLong = `${col.titlePublicOrDisplayName.title}${titleModifier}`

        return [
            useShortNames ? shortName : col.name,
            {
                titleShort,
                titleLong,
                descriptionShort,
                descriptionKey,
                descriptionProcessing,
                shortUnit,
                unit,
                timespan,
                tolerance,
                type,
                conversionFactor: col.display?.conversionFactor,
                owidVariableId,
                shortName,
                lastUpdated,
                nextUpdate,
                citationShort,
                citationLong,
                fullMetadata: `https://api.ourworldindata.org/v1/indicators/${owidVariableId}.metadata.json`,
            } satisfies MetadataColumn,
        ]
    })
    const dateDownloaded = new Date()

    const fullMetadata = {
        chart: {
            title: grapherState.title,
            subtitle: grapherState.subtitle,
            note: grapherState.note,
            xAxisLabel: grapherState.xAxis.label,
            yAxisLabel: grapherState.yAxis.label,
            citation: grapherState.sourcesLine,
            originalChartUrl: grapherState.canonicalUrl,
            selection: grapherState.selectedEntityNames,
        },
        columns: Object.fromEntries(columns),
        // date downloaded should be YYYY-MM-DD
        dateDownloaded: dateDownloaded.toISOString().split("T")[0],
        // NOTE: this is filtered by whitelisted grapher query params - if you want other params to be
        //       inlucded here (e.g. MDIM selection), add them to the whitelist inside getGrapherFilters
        activeFilters: getGrapherFilters(
            searchParams,
            multiDimAvailableDimensions
        ),
    }

    return fullMetadata
}
