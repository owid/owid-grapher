import * as _ from "lodash-es"
import {
    ExplorerChoiceParams,
    ExplorerControlType,
    GridBoolean,
    DecisionMatrix,
    TableDef,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { obtainAvailableEntitiesForGraphers } from "../../updateChartEntities.js"
import { GrapherState } from "@ourworldindata/grapher"
import pMap from "p-map"
import { ExplorerAdminServer } from "../../../explorerAdminServer/ExplorerAdminServer.js"
import { OwidTable, parseDelimited } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    CoreRow,
    DimensionProperty,
    MinimalExplorerInfo,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidVariableWithSourceAndDimensionById,
} from "@ourworldindata/types"

import * as db from "../../../db/db.js"
import {
    excludeUndefined,
    getUniqueNamesFromTopicHierarchies,
    parseIntOrUndefined,
} from "@ourworldindata/utils"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import {
    CsvUnenrichedExplorerViewRecord,
    EnrichedExplorerRecord,
    EntitiesByColumnDictionary,
    ExplorerViewBaseRecord,
    ExplorerViewGrapherInfo,
    GrapherEnrichedExplorerViewRecord,
    GrapherUnenrichedExplorerViewRecord,
    IndicatorEnrichedExplorerViewRecord,
    IndicatorUnenrichedExplorerViewRecord,
    CsvEnrichedExplorerViewRecord,
    FinalizedExplorerRecord,
    DimensionSlug,
} from "./types.js"
import {
    getVariableIdsFromChartConfig,
    makeGrapherStateWithMetadata,
    MAX_NON_FM_RECORD_SCORE,
    processAvailableEntities as processRecordAvailableEntities,
    scaleRecordScores,
} from "./shared.js"
import {
    ChartRecord,
    ChartRecordType,
} from "../../../site/search/searchTypes.js"
import { transformExplorerProgramToResolveCatalogPaths } from "../../ExplorerBaker.js"
import { getMetadataForMultipleVariables } from "../../../db/model/Variable.js"

/**
 * Matches "duplicate 1234", to catch the (hacky) rows that are using the `duplicate` transformation to create
 * different views of the same indicator in indicator-based explorers
 */
const TRANSFORM_DUPLICATE_ID_REGEX = /duplicate (\d+)$/

function getDuplicateTransformationRows(columnDefs: OwidColumnDef[]) {
    return columnDefs.filter((row) =>
        row.transform?.match(TRANSFORM_DUPLICATE_ID_REGEX)
    )
}

/**
 * Each explorer has a default view (whichever is defined first in the decision matrix)
 * We scale these default view scores between 0 and 10000, but the rest we scale between 0 and 1000
 * to bury them under the (higher quality) grapher views in the data catalog.
 */
export function scaleExplorerRecordScores(
    explorerViews: FinalizedExplorerRecord[]
): ChartRecord[] {
    const [firstViews, rest] = _.partition(
        explorerViews,
        (view) => view.isFirstExplorerView
    )
    return [
        ...scaleRecordScores(firstViews, [1000, MAX_NON_FM_RECORD_SCORE]),
        ...scaleRecordScores(rest, [0, 1000]),
    ]
}

// Creates a search-ready string from a choice.
// Special handling is pretty much only necessary for checkboxes: If they are not ticked, then their name is not included.
// Imagine a "Per capita" checkbox, for example. If it's not ticked, then we don't want searches for "per capita" to wrongfully match it.
const explorerChoiceToViewSettings = (
    choices: ExplorerChoiceParams,
    decisionMatrix: DecisionMatrix
): string[] => {
    return Object.entries(choices).map(([choiceName, choiceValue]) => {
        const choiceControlType =
            decisionMatrix.choiceNameToControlTypeMap.get(choiceName)
        if (choiceControlType === ExplorerControlType.Checkbox)
            return choiceValue === GridBoolean.true ? choiceName : ""
        else return choiceValue
    })
}

async function fetchIndicatorMetadata(
    records: IndicatorUnenrichedExplorerViewRecord[]
): Promise<OwidVariableWithSourceAndDimensionById> {
    const variableIds = records.flatMap((record) =>
        getVariableIdsFromChartConfig(record.chartConfig)
    )
    const variableMetadataById =
        await getMetadataForMultipleVariables(variableIds)
    return variableMetadataById
}

/** Almost always `"country"`, but sometimes things like `"location"` */
function getEntityNameSlug(tableDef: TableDef): string {
    return (
        tableDef.columnDefinitions?.find(
            (col) => col.type === ColumnTypeNames.EntityName
        )?.slug || "country"
    )
}

/**
 * Returns an aggregator function that can be used to aggregate entities per column in a parsed CSV
 * e.g. if there's a column named "gdp", this will return an object like `{ gdp: Set<string> }`
 * containing all the entities that have any data for gdp.
 */
function makeAggregator(entityNameSlug: string) {
    return (
        result: Record<string, Set<string>>,
        row: Record<string, string>
    ) => {
        const entityName = row[entityNameSlug]
        Object.keys(row).forEach((columnSlug) => {
            if (columnSlug === entityNameSlug || columnSlug === "year") return

            const value = row[columnSlug]
            if (value) {
                if (!result[columnSlug]) {
                    result[columnSlug] = new Set()
                }
                if (entityName) {
                    result[columnSlug].add(entityName)
                }
            }
        })

        return result
    }
}

/**
 * Fetches the CSVs for all of an explorer's tables, parses them, and aggregates their entities per column.
 * Returns an object like:
 * ```
 * {
 *   almonds: { population: ["United States", "Canada"], food__tonnes: ["United States"] },
 *   olives: { population: ["United States", "Canada"], food__tonnes: ["United States", "Greece"] },
 * }
 * ```
 */
async function getEntitiesPerColumnPerTable(
    tableDefs: TableDef[]
): Promise<EntitiesByColumnDictionary> {
    return pMap(
        tableDefs,
        (tableDef) => {
            console.log("Fetching CSV table data from", tableDef.url)
            return fetch(tableDef.url!)
                .then((res) => res.text())
                .then((csv) => parseDelimited(csv))
                .then((parsed) => {
                    const entityNameSlug = getEntityNameSlug(tableDef)
                    const aggregateEntities = makeAggregator(entityNameSlug)
                    const entitiesPerColumn = parsed.reduce(
                        aggregateEntities,
                        {}
                    )

                    // Convert sets to arrays
                    const entityNamesAsArray = _.mapValues(
                        entitiesPerColumn,
                        (set) => Array.from(set)
                    ) as Record<string, string[]>

                    return { [tableDef.slug!]: entityNamesAsArray }
                })
        },
        {
            concurrency: 5,
        }
        // Merge all these objects together
    ).then((results) => Object.assign({}, ...results))
}

const computeExplorerViewScore = (record: {
    views_7d: number
    numNonDefaultSettings: number
    titleLength: number
}) =>
    (record.views_7d || 0) * 10 -
    record.numNonDefaultSettings * 50 -
    record.titleLength

const parseSpaceSeparatedValues = (value?: string): string[] =>
    value?.trim().split(" ") || []

const parseYVariableIds = (matrixRow: CoreRow): number[] => {
    return excludeUndefined(
        parseSpaceSeparatedValues(matrixRow.yVariableIds).map(
            (variableId: string) => parseIntOrUndefined(variableId)
        )
    )
}

const parseYSlugs = (matrixRow: CoreRow): string[] => {
    return parseSpaceSeparatedValues(matrixRow.ySlugs)
}

const makeDimensionsArray = (
    matrixRow: CoreRow,
    slugToVariableId: Map<string, number>
): OwidChartDimensionInterface[] => {
    // Some indicator explorers have their variable IDs defined in the transforms column rather than
    // directly in yVariableIds. (e.g. https://github.com/owid/owid-content/commit/6f17c705d331a13380e9a52f3d319c9a51054625)
    const ySlugs = parseYSlugs(matrixRow)
    const yVariableIdsFromTransforms = ySlugs
        .map((slug) => slugToVariableId.get(slug))
        .filter((id): id is number => !!id)
    const yVariableIds = _.uniq([
        ...yVariableIdsFromTransforms,
        ...parseYVariableIds(matrixRow),
    ])

    const dimensions: OwidChartDimensionInterface[] = []

    // Add y dimensions
    for (const variableId of yVariableIds)
        dimensions.push({
            variableId,
            property: DimensionProperty.y,
        })

    // Add x dimension if present
    if (matrixRow.xVariableId)
        dimensions.push({
            variableId: matrixRow.xVariableId,
            property: DimensionProperty.x,
        })

    // Add color dimension if present
    if (matrixRow.colorVariableId)
        dimensions.push({
            variableId: matrixRow.colorVariableId,
            property: DimensionProperty.color,
        })

    // Add size dimension if present
    if (matrixRow.sizeVariableId)
        dimensions.push({
            variableId: matrixRow.sizeVariableId,
            property: DimensionProperty.size,
        })

    return dimensions
}

const makeDimensionSlugs = (matrixRow: CoreRow): DimensionSlug[] => {
    const dimensionSlugs: DimensionSlug[] = []

    // Add Y slugs
    const ySlugs = parseYSlugs(matrixRow)
    for (const slug of ySlugs)
        dimensionSlugs.push({
            slug,
            property: DimensionProperty.y,
        })

    // Add X slug if present
    if (matrixRow.xSlug)
        dimensionSlugs.push({
            slug: matrixRow.xSlug,
            property: DimensionProperty.x,
        })

    // Add color slug if present
    if (matrixRow.colorSlug)
        dimensionSlugs.push({
            slug: matrixRow.colorSlug,
            property: DimensionProperty.color,
        })

    // Add size slug if present
    if (matrixRow.sizeSlug)
        dimensionSlugs.push({
            slug: matrixRow.sizeSlug,
            property: DimensionProperty.size,
        })

    return dimensionSlugs
}

const getNonDefaultSettings = (
    choice: ExplorerChoiceParams,
    matrix: DecisionMatrix
): [string, any][] => {
    const defaultSettings = matrix.defaultSettings
    return Object.entries(matrix.availableChoiceOptions).filter(
        ([choiceName, choiceOptions]) => {
            return (
                choiceOptions.length > 1 &&
                !(defaultSettings[choiceName] !== undefined
                    ? defaultSettings[choiceName] === choice[choiceName]
                    : choice[choiceName] === choiceOptions[0])
            )
        }
    )
}

const createBaseRecord = (
    choice: ExplorerChoiceParams,
    program: ExplorerProgram,
    index: number,
    explorerInfo: MinimalExplorerInfo,
    slugToVariableId: Map<string, number>
): ExplorerViewBaseRecord => {
    const matrix = program.decisionMatrix
    matrix.setValuesFromChoiceParams(choice)
    const row = matrix.selectedRow

    const nonDefaultSettings = getNonDefaultSettings(choice, matrix)

    const grapherConfig = program.grapherConfig

    // Add the dimensions array to the Grapher config if necessary.
    // This is relevant for indicator-based explorers.
    grapherConfig.dimensions =
        grapherConfig.dimensions ?? makeDimensionsArray(row, slugToVariableId)

    const grapherState = new GrapherState(grapherConfig)

    const numYVariables = grapherConfig.dimensions.filter(
        (dimension) => dimension.property === DimensionProperty.y
    ).length

    return {
        availableEntities: [],
        viewTitle: matrix.selectedRow.title,
        viewSubtitle: matrix.selectedRow.subtitle,
        viewAvailableTabs: grapherState.availableTabs,
        viewSettings: explorerChoiceToViewSettings(choice, matrix),
        viewGrapherId: grapherConfig.id,
        viewQueryParams: matrix.toString(),
        viewIndexWithinExplorer: index,
        numNonDefaultSettings: nonDefaultSettings.length,
        tableSlug: matrix.selectedRow.tableSlug,
        dimensionSlugs: makeDimensionSlugs(row),
        explorerSlug: explorerInfo.slug,
        numYVariables,
        isFirstExplorerView: index === 0,
        chartConfig: grapherConfig,
    }
}

const createBaseRecords = (
    explorerInfo: MinimalExplorerInfo,
    explorerProgram: ExplorerProgram
): ExplorerViewBaseRecord[] => {
    const duplicateTransforms = getDuplicateTransformationRows(
        explorerProgram.columnDefsWithoutTableSlug
    )
    // Maps explorer slugs to variable IDs, e.g. { "gdp" => 1234 }
    const slugToVariableId = duplicateTransforms.reduce(
        (map, { slug, transform }) => {
            const match = transform?.match(TRANSFORM_DUPLICATE_ID_REGEX)
            if (match) {
                map.set(slug, parseInt(match[1]))
            }
            return map
        },
        new Map<string, number>()
    )

    return explorerProgram.decisionMatrix
        .allDecisionsAsQueryParams()
        .map((choice: ExplorerChoiceParams, index: number) =>
            createBaseRecord(
                choice,
                explorerProgram,
                index,
                explorerInfo,
                slugToVariableId
            )
        )
}

const fetchGrapherInfo = async (
    trx: db.KnexReadonlyTransaction,
    grapherIds: number[]
): Promise<Record<number, ExplorerViewGrapherInfo>> => {
    return await trx
        .select(
            trx.raw("charts.id as id"),
            trx.raw("chart_configs.full->>'$.title' as title"),
            trx.raw("chart_configs.full->>'$.subtitle' as subtitle"),
            trx.raw("chart_configs.full->>'$.sourceDesc' as source")
        )
        .from("charts")
        .join("chart_configs", { "charts.configId": "chart_configs.id" })
        .whereIn("charts.id", grapherIds)
        .andWhereRaw("chart_configs.full->>'$.isPublished' = 'true'")
        .then((rows) => _.keyBy(rows, "id"))
}

async function enrichRecordWithGrapherInfo(
    record: GrapherUnenrichedExplorerViewRecord,
    grapherInfo: Record<number, ExplorerViewGrapherInfo>,
    availableEntities: Map<number, { availableEntities: string[] }>,
    explorerInfo: MinimalExplorerInfo
): Promise<GrapherEnrichedExplorerViewRecord | undefined> {
    const grapher = grapherInfo[record.viewGrapherId]
    if (!grapher) {
        await logErrorAndMaybeCaptureInSentry({
            name: "ExplorerViewGrapherMissing",
            message: `Explorer with slug "${explorerInfo.slug}" has a view with a missing grapher: ${record.viewQueryParams}.`,
        })
        return
    }

    return {
        ...record,
        availableEntities:
            availableEntities.get(record.viewGrapherId)?.availableEntities ??
            [],
        viewTitle: grapher.title,
        viewSubtitle: grapher.subtitle,
        viewSource: grapher.source ?? "",
        titleLength: grapher.title.length,
    }
}

const enrichWithGrapherData = async (
    trx: db.KnexReadonlyTransaction,
    records: GrapherUnenrichedExplorerViewRecord[],
    explorerInfo: MinimalExplorerInfo
): Promise<GrapherEnrichedExplorerViewRecord[]> => {
    if (!records.length) return []
    const grapherIds = records.map((record) => record.viewGrapherId as number)

    console.log(
        `Fetching grapher configs from ${grapherIds.length} graphers for explorer ${explorerInfo.slug}`
    )
    const grapherInfo = await fetchGrapherInfo(trx, grapherIds)
    const availableEntities = await obtainAvailableEntitiesForGraphers(
        trx,
        grapherIds
    )

    const enrichedRecords: GrapherEnrichedExplorerViewRecord[] = []
    for (const record of records) {
        const enrichedRecord = await enrichRecordWithGrapherInfo(
            record,
            grapherInfo,
            availableEntities,
            explorerInfo
        )
        if (enrichedRecord) enrichedRecords.push(enrichedRecord)
    }
    return enrichedRecords
}

async function enrichRecordWithTableData(
    record: CsvUnenrichedExplorerViewRecord,
    entitiesPerColumnPerTable: EntitiesByColumnDictionary,
    columnDefsByTableSlug: Map<string | undefined, OwidColumnDef[]>
): Promise<CsvEnrichedExplorerViewRecord | undefined> {
    const { tableSlug, dimensionSlugs, viewTitle } = record

    const ySlugs = dimensionSlugs
        .filter((d) => d.property === DimensionProperty.y)
        .map((d) => d.slug)

    if (!tableSlug || !ySlugs?.length || !viewTitle) {
        await logErrorAndMaybeCaptureInSentry({
            name: "ExplorerViewMissingData",
            message: `Explorer with slug "${record.explorerSlug}" has a view with missing data: ${record.viewQueryParams}.`,
        })
        return
    }

    const availableEntities = _.uniq(
        ySlugs.flatMap((ySlug) => entitiesPerColumnPerTable[tableSlug][ySlug])
    ).filter((name): name is string => !!name)

    // Construct Grapher's input table with all relevant metadata (but without data values)
    const tableColDefs = columnDefsByTableSlug.get(tableSlug) ?? []
    const slugs = new Set(dimensionSlugs.map((dimension) => dimension.slug))
    const colDefs = tableColDefs.filter((colDef) => slugs.has(colDef.slug))
    const inputTable = new OwidTable([], colDefs)

    // Construct GrapherState enriched with metadata
    const grapherState = new GrapherState(record.chartConfig)
    if (inputTable) grapherState.inputTable = inputTable

    return {
        ...record,
        availableEntities,
        titleLength: viewTitle.length,
        viewSource: grapherState.sourcesLine,
    }
}

async function enrichWithTableData(
    records: CsvUnenrichedExplorerViewRecord[],
    entitiesPerColumnPerTable: EntitiesByColumnDictionary,
    columnDefsByTableSlug: Map<string | undefined, OwidColumnDef[]>
): Promise<CsvEnrichedExplorerViewRecord[]> {
    const enrichedRecords: CsvEnrichedExplorerViewRecord[] = []

    for (const record of records) {
        const enrichedRecord = await enrichRecordWithTableData(
            record,
            entitiesPerColumnPerTable,
            columnDefsByTableSlug
        )
        if (enrichedRecord) {
            enrichedRecords.push(enrichedRecord)
        }
    }
    return enrichedRecords
}

async function enrichRecordWithIndicatorData(
    record: IndicatorUnenrichedExplorerViewRecord,
    indicatorMetadataDictionary: OwidVariableWithSourceAndDimensionById
): Promise<IndicatorEnrichedExplorerViewRecord | undefined> {
    const yVariableIds = getVariableIdsFromChartConfig(record.chartConfig)
    const allEntityNames = yVariableIds.flatMap(
        (variableId) =>
            indicatorMetadataDictionary
                .get(variableId)
                ?.dimensions.entities.values?.map((entity) => entity.name) ?? []
    )

    const uniqueNonEmptyEntityNames = _.uniq(allEntityNames).filter(
        (name): name is string => !!name
    )

    // Construct GrapherState enriched with metadata
    const grapherState = makeGrapherStateWithMetadata(
        record.chartConfig,
        indicatorMetadataDictionary
    )

    const firstYIndicator = yVariableIds[0]

    const indicatorInfo = indicatorMetadataDictionary.get(firstYIndicator)
    if (!indicatorInfo) {
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                `Explorer with slug "${record.explorerSlug}" has a view ` +
                    `with missing indicator metadata: ${record.viewQueryParams}.`
            )
        )
        return
    }

    const viewTitle = record.viewTitle || grapherState.displayTitle
    const viewSubtitle = record.viewSubtitle || grapherState.currentSubtitle
    const viewSource = grapherState.sourcesLine

    return {
        ...record,
        availableEntities: uniqueNonEmptyEntityNames,
        viewTitle,
        viewSubtitle,
        viewSource,
        titleLength: viewTitle.length,
    }
}

async function enrichWithIndicatorMetadata(
    indicatorBaseRecords: IndicatorUnenrichedExplorerViewRecord[],
    indicatorMetadataDictionary: OwidVariableWithSourceAndDimensionById
): Promise<IndicatorEnrichedExplorerViewRecord[]> {
    return pMap(indicatorBaseRecords, (indicatorBaseRecord) =>
        enrichRecordWithIndicatorData(
            indicatorBaseRecord,
            indicatorMetadataDictionary
        )
    ).then((r) => r.filter(Boolean) as IndicatorEnrichedExplorerViewRecord[])
}

function processSubtitles(
    records: EnrichedExplorerRecord[]
): EnrichedExplorerRecord[] {
    return records.map((record) => {
        // Remove markdown links from text
        const viewSubtitle = record.viewSubtitle
            ? new MarkdownTextWrap({
                  text: record.viewSubtitle,
                  fontSize: 10,
              }).plaintext
            : undefined
        return {
            ...record,
            viewSubtitle,
        } as EnrichedExplorerRecord
    })
}

async function processAvailableEntities(
    records: EnrichedExplorerRecord[]
): Promise<EnrichedExplorerRecord[]> {
    const processedRecords: EnrichedExplorerRecord[] = []
    for (const record of records) {
        const availableEntities = processRecordAvailableEntities(
            record.availableEntities
        )
        if (!availableEntities) {
            await logErrorAndMaybeCaptureInSentry({
                name: "ExplorerViewMissingData",
                message: `Explorer with slug "${record.explorerSlug}" has a view with missing entities: ${record.viewQueryParams}.`,
            })
        } else {
            processedRecords.push({
                ...record,
                availableEntities,
            })
        }
    }
    return processedRecords
}

async function finalizeRecords(
    records: EnrichedExplorerRecord[],
    slug: string,
    pageviews: Record<string, { views_7d: number }>,
    explorerInfo: MinimalExplorerInfo
): Promise<FinalizedExplorerRecord[]> {
    const withCleanSubtitles = processSubtitles(records)

    const withCleanEntities = await processAvailableEntities(withCleanSubtitles)

    const withPageviews = withCleanEntities.map((record) => ({
        ...record,
        views_7d: _.get(pageviews, [`/explorers/${slug}`, "views_7d"], 0),
    }))

    const unsortedFinalRecords = withPageviews.map(
        (record, i) =>
            ({
                type: ChartRecordType.ExplorerView,
                chartId: record.viewGrapherId,
                variantName: record.viewTitle,
                // remap createdAt -> publishedAt
                publishedAt: explorerInfo.createdAt.toISOString(),
                updatedAt: explorerInfo.updatedAt.toISOString(),
                keyChartForTags: [],
                numDimensions: record.numYVariables,
                numRelatedArticles: 0,
                title: record.viewTitle as string,
                subtitle: record.viewSubtitle!,
                source: record.viewSource,
                slug: explorerInfo.slug,
                queryParams: record.viewQueryParams,
                availableTabs: record.viewAvailableTabs,
                tags: explorerInfo.tags,
                objectID: `${explorerInfo.slug}-${i}`,
                id: `explorer/${explorerInfo.slug}${record.viewQueryParams}`,
                score: computeExplorerViewScore(record),
                views_7d: record.views_7d,
                availableEntities: record.availableEntities,
                titleLength: record.titleLength,
                isFirstExplorerView: record.isFirstExplorerView,
                isIncomeGroupSpecificFM: false,
            }) as Omit<FinalizedExplorerRecord, "viewTitleIndexWithinExplorer">
    )

    const sortedByScore = _.orderBy(
        unsortedFinalRecords,
        computeExplorerViewScore,
        "desc"
    ) as Omit<FinalizedExplorerRecord, "viewTitleIndexWithinExplorer">[]

    const groupedByTitle = _.groupBy(sortedByScore, "title")

    const indexedExplorerViewData = Object.values(groupedByTitle).flatMap(
        (records) =>
            records.map((record, i) => ({
                ...record,
                viewTitleIndexWithinExplorer: i,
            })) as FinalizedExplorerRecord[]
    )

    return indexedExplorerViewData
}

export const getExplorerViewRecordsForExplorer = async (
    trx: db.KnexReadonlyTransaction,
    explorerInfo: MinimalExplorerInfo,
    pageviews: Record<string, { views_7d: number }>,
    explorerAdminServer: ExplorerAdminServer,
    skipGrapherViews: boolean
): Promise<FinalizedExplorerRecord[]> => {
    const { slug } = explorerInfo
    const rawExplorerProgram = await explorerAdminServer.getExplorerFromSlug(
        trx,
        slug
    )

    // Map catalog paths to indicator ids if necessary
    const transformResult = await transformExplorerProgramToResolveCatalogPaths(
        rawExplorerProgram,
        trx
    )
    const explorerProgram = transformResult.program

    console.log(
        `Creating ${explorerProgram.decisionMatrix.numRows} base records for explorer ${slug}`
    )

    const baseRecords = createBaseRecords(explorerInfo, explorerProgram)

    const [grapherBaseRecords, nonGrapherBaseRecords] = _.partition(
        baseRecords,
        (record) => record.viewGrapherId !== undefined
    ) as [GrapherUnenrichedExplorerViewRecord[], ExplorerViewBaseRecord[]]

    let enrichedGrapherRecords: GrapherEnrichedExplorerViewRecord[] = []
    if (!skipGrapherViews) {
        enrichedGrapherRecords = await enrichWithGrapherData(
            trx,
            grapherBaseRecords,
            explorerInfo
        )
    }

    const [indicatorBaseRecords, csvBaseRecords] = _.partition(
        nonGrapherBaseRecords,
        (record) => record.numYVariables > 0
    ) as [
        IndicatorUnenrichedExplorerViewRecord[],
        CsvUnenrichedExplorerViewRecord[],
    ]

    // Fetch and apply indicator metadata
    console.log("Fetching indicator metadata for explorer", slug)
    const indicatorMetadataDictionary =
        await fetchIndicatorMetadata(indicatorBaseRecords)

    console.log("Fetched indicator metadata for explorer", slug)

    const enrichedIndicatorRecords = await enrichWithIndicatorMetadata(
        indicatorBaseRecords,
        indicatorMetadataDictionary
    )

    const tableDefs = explorerProgram.tableSlugs
        .map((tableSlug) => explorerProgram.getTableDef(tableSlug))
        .filter((x) => x && x.url && x.slug) as TableDef[]

    // Fetch and process CSV table data
    console.log(
        `Fetching CSV table data for ${slug} and aggregating entities by column`
    )
    const entitiesPerColumnPerTable =
        await getEntitiesPerColumnPerTable(tableDefs)
    console.log(
        "Finished fetching CSV table data and aggregating entities by column"
    )

    const enrichedCsvRecords = await enrichWithTableData(
        csvBaseRecords,
        entitiesPerColumnPerTable,
        explorerProgram.columnDefsByTableSlug
    )

    const enrichedRecords = [
        ...enrichedGrapherRecords,
        ...enrichedIndicatorRecords,
        ...enrichedCsvRecords,
    ]

    // Finalize records with titles, sorting, and grouping
    return finalizeRecords(enrichedRecords, slug, pageviews, explorerInfo)
}

async function getExplorersWithInheritedTags(trx: db.KnexReadonlyTransaction) {
    const explorersBySlug = await db.getPublishedExplorersBySlug(trx)
    // The DB query gets the tags for the explorer, but we need to add the parent tags as well.
    // This isn't done in the query because it would require a recursive CTE.
    // It's easier to write that query once, separately, and reuse it.
    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(trx)
    const publishedExplorersWithTags = []

    for (const explorer of Object.values(explorersBySlug)) {
        if (!explorer.tags.length) {
            await logErrorAndMaybeCaptureInSentry({
                name: "ExplorerTagMissing",
                message: `Explorer "${explorer.slug}" has no tags.`,
            })
        }
        const topicTags = getUniqueNamesFromTopicHierarchies(
            explorer.tags,
            topicHierarchiesByChildName
        )

        publishedExplorersWithTags.push({
            ...explorer,
            tags: topicTags,
        })
    }

    return publishedExplorersWithTags
}

export const getExplorerViewRecords = async (
    trx: db.KnexReadonlyTransaction,
    skipGrapherViews = false
): Promise<FinalizedExplorerRecord[]> => {
    console.log("Getting explorer view records")
    if (skipGrapherViews) {
        console.log("(Skipping grapher views)")
    }
    const publishedExplorersWithTags = await getExplorersWithInheritedTags(trx)
    const pageviews = await getAnalyticsPageviewsByUrlObj(trx)

    const explorerAdminServer = new ExplorerAdminServer()

    const records = await pMap(
        publishedExplorersWithTags,
        (explorerInfo) =>
            getExplorerViewRecordsForExplorer(
                trx,
                explorerInfo,
                pageviews,
                explorerAdminServer,
                skipGrapherViews
            ),
        { concurrency: 1 }
    ).then((records) => records.flat())

    return records
}
