import { Grapher } from "@ourworldindata/grapher"
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

export const getColumnsForMetadata = (grapher: Grapher) => {
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

    const colsToGet = grapher.inputTable.columnSlugs.filter(
        (col) => !columnsToIgnore.has(col)
    )

    return grapher.inputTable.getColumns(colsToGet)
}
export function assembleMetadata(
    grapher: Grapher,
    searchParams: URLSearchParams
) {
    const useShortNames = searchParams.get("useColumnShortNames") === "true"
    console.log("useShortNames", useShortNames)

    const metadataCols = getColumnsForMetadata(grapher)

    const columns: [
        string,
        {
            title: string
            titleProducer: string
            titleVariant: string
            descriptionShort: string
            descriptionFromProducer: string
            descriptionKey: string[]
            descriptionProcessing: string
            shortUnit: string
            unit: string
            timespan: string
            tolerance: number
            type: string
            conversionFactor: number
            owidVariableId: number
            catalogPath: string
            sources: Partial<
                Pick<
                    OwidOrigin,
                    | "attribution"
                    | "attributionShort"
                    | "description"
                    | "urlDownload"
                    | "urlMain"
                >
            >[]
            shortName: string
        },
    ][] = metadataCols.map((col) => {
        console.log("mapping col", col.name)
        const {
            descriptionShort,
            descriptionKey,
            descriptionProcessing,
            additionalInfo,
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
            def.origins,
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
                additionalInfo,
                lastUpdated,
                nextUpdate,
                citationShort,
                citationLong,
                fullMetadata: `https://api.ourworldindata.org/v1/indicators/${owidVariableId}.metadata.json`,
            },
        ]
    })
    const dateDownloaded = new Date()

    const fullMetadata = {
        chart: {
            title: grapher.title,
            subtitle: grapher.subtitle,
            note: grapher.note,
            xAxisLabel: grapher.xAxis.label,
            yAxisLabel: grapher.yAxis.label,
            citation: grapher.sourcesLine,
            originalChartUrl: grapher.canonicalUrl,
            selection: grapher.selectedEntityNames,
        },
        columns: Object.fromEntries(columns),
        // date downloaded should be YYYY-MM-DD
        dateDownloaded: dateDownloaded.toISOString().split("T")[0],
    }

    return fullMetadata
}
