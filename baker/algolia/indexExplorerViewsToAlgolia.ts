import * as db from "../../db/db.js"
import {
    ExplorerChoiceParams,
    ExplorerControlType,
    GridBoolean,
    DecisionMatrix,
    TableDef,
} from "@ourworldindata/explorer"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
    DATA_API_URL,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { at, get, groupBy, keyBy, mapValues, orderBy, partition } from "lodash"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { logErrorAndMaybeSendToBugsnag } from "../../serverUtils/errorLog.js"
import Bugsnag from "@bugsnag/js"
import { obtainAvailableEntitiesForAllGraphers } from "../updateChartEntities.js"
import { fetchS3MetadataByPath } from "../../db/model/Variable.js"
import { getVariableMetadataRoute } from "@ourworldindata/grapher"
import pMap from "p-map"
import { ExplorerAdminServer } from "../../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../../gitCms/GitCmsConstants.js"
import { parseDelimited } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    CoreRow,
    DbEnrichedVariable,
} from "@ourworldindata/types"

interface ExplorerViewEntry {
    viewTitle: string
    viewSubtitle: string
    viewSettings: string[]
    viewQueryParams: string
    availableEntities: string[]

    viewGrapherId?: number
    yVariableIds: Array<string | number> // Variable IDs or ETL paths
    tableSlug?: string
    ySlugs: string[]

    /**
     * We often have several views with the same title within an explorer, e.g. "Population".
     * In order to only display _one_ of these views in search results, we need a way to demote duplicates.
     * This attribute is used for that: The highest-scored such view will be given a value of 0, the second-highest 1, etc.
     */
    viewTitleIndexWithinExplorer: number

    // Potential ranking criteria
    viewIndexWithinExplorer: number
    titleLength: number
    numNonDefaultSettings: number
    // viewViews_7d: number
}

export interface ExplorerViewEntryWithExplorerInfo extends ExplorerViewEntry {
    explorerSlug: string
    explorerTitle: string
    explorerSubtitle: string
    explorerViews_7d: number
    viewTitleAndExplorerSlug: string // used for deduplication: `viewTitle | explorerSlug`
    numViewsWithinExplorer: number
    tags: string[]

    score: number

    objectID?: string
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

type ExplorerIndicatorMetadata = Record<
    string | number,
    {
        entityNames?: string[]
        display: DbEnrichedVariable["display"]
        titlePublic: DbEnrichedVariable["titlePublic"]
        descriptionShort: DbEnrichedVariable["descriptionShort"]
        name: DbEnrichedVariable["name"]
    }
>

async function fetchIndicatorMetadata(
    records: Omit<
        ExplorerViewEntry,
        "viewTitleIndexWithinExplorer" | "titleLength"
    >[],
    trx: db.KnexReadonlyTransaction
): Promise<ExplorerIndicatorMetadata> {
    function checkIsETLPath(idOrPath: string | number): idOrPath is string {
        return typeof idOrPath === "string"
    }

    const { etlPaths, ids } = records.reduce(
        ({ etlPaths, ids }, record) => {
            for (const yVariableId of record.yVariableIds) {
                if (checkIsETLPath(yVariableId)) {
                    etlPaths.add(yVariableId)
                } else {
                    ids.add(yVariableId)
                }
            }
            return { etlPaths, ids }
        },
        { etlPaths: new Set<string>(), ids: new Set<number>() }
    )

    const metadataFromDB = (
        await trx
            .table("variables")
            .select(
                "id",
                "catalogPath",
                "name",
                "titlePublic",
                "display",
                "name",
                "descriptionShort"
            )
            .whereIn("id", [...ids])
            .orWhereIn("catalogPath", [...etlPaths])
    ).map((row) => ({
        ...row,
        display: row.display ? JSON.parse(row.display) : {},
    })) as DbEnrichedVariable[]

    const indicatorMetadataByIdAndPath = {
        ...keyBy(metadataFromDB, "id"),
        ...keyBy(metadataFromDB, "catalogPath"),
    } as ExplorerIndicatorMetadata

    async function fetchEntitiesForId(id?: number) {
        if (id) {
            const metadata = await fetchS3MetadataByPath(
                getVariableMetadataRoute(DATA_API_URL, id)
            )
            const entityNames = get(metadata, "dimensions.entities.values", [])
                .map((value) => value.name)
                .filter((name): name is string => !!name)

            const idEntry = indicatorMetadataByIdAndPath[id]
            if (idEntry) {
                idEntry.entityNames = entityNames
            }
            const path = metadata.catalogPath
            if (path) {
                const pathEntry = indicatorMetadataByIdAndPath[path]
                if (pathEntry) {
                    pathEntry.entityNames = entityNames
                }
            }
        }
    }

    await pMap(
        metadataFromDB.map((meta) => meta.id),
        fetchEntitiesForId,
        { concurrency: 10 }
    )

    return indicatorMetadataByIdAndPath
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
                result[columnSlug].add(entityName)
            }
        })

        return result
    }
}

async function getEntitiesPerColumnPerTable(
    tableDefs: TableDef[]
): Promise<Record<string, Record<string, string[]>>> {
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
                    const entityNamesAsArray = mapValues(
                        entitiesPerColumn,
                        (set) => Array.from(set)
                    ) as Record<string, string[]>

                    // Return an object like `{ almonds: { population: ["United States", "Canada"], area_harvested__ha: ["United States"] } }`
                    return { [tableDef.slug!]: entityNamesAsArray }
                })
        },
        {
            concurrency: 5,
        }
        // Merge all these objects together
    ).then((results) => Object.assign({}, ...results))
}

const computeScore = (
    record: Omit<ExplorerViewEntry, "viewTitleIndexWithinExplorer"> &
        Partial<ExplorerViewEntryWithExplorerInfo>
) =>
    (record.explorerViews_7d ?? 0) * 10 -
    record.numNonDefaultSettings * 50 -
    record.titleLength

interface IndicatorMetadata {
    entityNames: string[]
    titlePublic?: string
    display?: { name: string }
    name: string
    descriptionShort?: string
}

interface GrapherInfo {
    id: number
    title: string
    subtitle: string
}

const parseYVariableIds = (matrixRow: CoreRow): (string | number)[] => {
    return (
        matrixRow.yVariableIds
            ?.trim()
            .split(" ")
            .map((idOrPath: string) =>
                isNaN(parseInt(idOrPath)) ? idOrPath : parseInt(idOrPath)
            ) || []
    )
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
    matrix: DecisionMatrix,
    index: number
): Partial<ExplorerViewEntry> => {
    matrix.setValuesFromChoiceParams(choice)
    const nonDefaultSettings = getNonDefaultSettings(choice, matrix)
    const yVariableIds = parseYVariableIds(matrix.selectedRow)

    return {
        viewTitle: matrix.selectedRow.title,
        viewSubtitle: matrix.selectedRow.subtitle,
        viewSettings: explorerChoiceToViewSettings(choice, matrix),
        availableEntities: [],
        viewGrapherId: matrix.selectedRow.grapherId,
        yVariableIds,
        viewQueryParams: matrix.toString(),
        viewIndexWithinExplorer: index,
        numNonDefaultSettings: nonDefaultSettings.length,
        tableSlug: matrix.selectedRow.tableSlug,
        ySlugs: matrix.selectedRow.ySlugs?.split(" ") || [],
    }
}

const createBaseRecords = (
    matrix: DecisionMatrix
): Partial<ExplorerViewEntry>[] => {
    return matrix
        .allDecisionsAsQueryParams()
        .map((choice: ExplorerChoiceParams, index: number) =>
            createBaseRecord(choice, matrix, index)
        )
}

const fetchGrapherInfo = async (
    trx: db.KnexReadonlyTransaction,
    grapherIds: number[]
): Promise<Record<number, GrapherInfo>> => {
    return await trx
        .select(
            trx.raw("charts.id as id"),
            trx.raw("chart_configs.full->>'$.title' as title"),
            trx.raw("chart_configs.full->>'$.subtitle' as subtitle")
        )
        .from("charts")
        .join("chart_configs", { "charts.configId": "chart_configs.id" })
        .whereIn("charts.id", grapherIds)
        .andWhereRaw("chart_configs.full->>'$.isPublished' = 'true'")
        .then((rows) => keyBy(rows, "id"))
}

const enrichRecordWithGrapherInfo = (
    record: Partial<ExplorerViewEntry>,
    grapherInfo: Record<number, GrapherInfo>,
    availableEntities: Map<number, { availableEntities: string[] }>,
    slug: string
): Partial<ExplorerViewEntry> => {
    if (!record.viewGrapherId) return record

    const grapher = grapherInfo[record.viewGrapherId]
    if (!grapher) {
        console.warn(
            `Grapher id ${record.viewGrapherId} not found for explorer ${slug}`
        )
        return record
    }

    return {
        ...record,
        availableEntities:
            availableEntities.get(record.viewGrapherId)?.availableEntities ??
            [],
        viewTitle: grapher.title,
        viewSubtitle: grapher.subtitle,
    }
}

const enrichWithGrapherData = async (
    records: Partial<ExplorerViewEntry>[],
    trx: db.KnexReadonlyTransaction,
    slug: string
): Promise<Partial<ExplorerViewEntry>[]> => {
    const grapherIds = records
        .filter((record) => record.viewGrapherId !== undefined)
        .map((record) => record.viewGrapherId as number)

    if (!grapherIds.length) return records

    console.log(
        `Fetching grapher configs from ${grapherIds.length} graphers for explorer ${slug}`
    )
    const grapherInfo = await fetchGrapherInfo(trx, grapherIds)
    const availableEntities = await obtainAvailableEntitiesForAllGraphers(
        trx,
        grapherIds
    )

    return records.map((record) =>
        enrichRecordWithGrapherInfo(
            record,
            grapherInfo,
            availableEntities,
            slug
        )
    )
}

const enrichRecordWithTableData = (
    record: Partial<ExplorerViewEntry>,
    entitiesPerColumnPerTable: Record<string, Record<string, string[]>>
): Partial<ExplorerViewEntry> => {
    const { tableSlug, ySlugs } = record
    if (!tableSlug || !ySlugs?.length) return record

    const availableEntities = ySlugs
        .flatMap((ySlug) => entitiesPerColumnPerTable[tableSlug][ySlug])
        .filter((name, i, array) => array.indexOf(name) === i)

    return { ...record, availableEntities }
}

const enrichRecordWithIndicatorData = (
    record: Partial<ExplorerViewEntry>,
    indicatorMetadata: Record<string | number, IndicatorMetadata>
): Partial<ExplorerViewEntry> => {
    if (!record.yVariableIds?.length) return record

    const allEntities = at(indicatorMetadata, record.yVariableIds)
        .flatMap((meta) => meta.entityNames)
        .filter(
            (name, i, array): name is string =>
                array.indexOf(name) === i && !!name
        )

    const result = { ...record, availableEntities: allEntities }

    const firstYIndicator = record.yVariableIds[0]
    if (firstYIndicator === undefined) return result

    const indicatorInfo = indicatorMetadata[firstYIndicator]
    if (!indicatorInfo) return result

    return {
        ...result,
        viewTitle:
            record.viewTitle ??
            indicatorInfo.titlePublic ??
            indicatorInfo.display?.name ??
            indicatorInfo.name,
        viewSubtitle: record.viewSubtitle ?? indicatorInfo.descriptionShort,
    }
}

const enrichWithMetadata = async (
    records: Partial<ExplorerViewEntry>[],
    indicatorMetadata: Record<string | number, IndicatorMetadata>,
    entitiesPerColumnPerTable: Record<string, Record<string, string[]>>
): Promise<Partial<ExplorerViewEntry>[]> => {
    return records.map((record) => {
        const withTableData = enrichRecordWithTableData(
            record,
            entitiesPerColumnPerTable
        )
        return enrichRecordWithIndicatorData(withTableData, indicatorMetadata)
    })
}

const cleanSubtitles = (
    records: Partial<ExplorerViewEntry>[]
): Partial<ExplorerViewEntry>[] => {
    return records.map((record) => ({
        ...record,
        viewSubtitle: record.viewSubtitle
            ? new MarkdownTextWrap({
                  text: record.viewSubtitle,
                  fontSize: 10,
              }).plaintext
            : undefined,
    }))
}

async function logMissingTitles(
    records: Partial<ExplorerViewEntry>[],
    slug: string
): Promise<void> {
    for (const record of records) {
        await logErrorAndMaybeSendToBugsnag({
            name: "ExplorerViewTitleMissing",
            message: `Explorer ${slug} has a view with no title: ${record.viewQueryParams}.`,
        })
    }
}

async function finalizeRecords(
    records: Partial<ExplorerViewEntry>[],
    slug: string
): Promise<ExplorerViewEntry[]> {
    const [withTitle, withoutTitle] = partition(
        records,
        (record) => record.viewTitle !== undefined
    )

    await logMissingTitles(withoutTitle, slug)

    const withCleanSubtitles = cleanSubtitles(withTitle)
    const withTitleLength = withCleanSubtitles.map((record) => ({
        ...record,
        titleLength: record.viewTitle!.length,
    })) as Omit<ExplorerViewEntry, "viewTitleIndexWithinExplorer">[]

    const sortedByScore = orderBy(
        withTitleLength,
        computeScore,
        "desc"
    ) as Omit<ExplorerViewEntry, "viewTitleIndexWithinExplorer">[]

    const groupedByTitle = groupBy(sortedByScore, "viewTitle")

    return Object.values(groupedByTitle).flatMap((group, i) =>
        group.map((record) => ({
            ...record,
            viewTitleIndexWithinExplorer: i,
        }))
    )
}

export const getExplorerViewRecordsForExplorerSlug = async (
    trx: db.KnexReadonlyTransaction,
    slug: string,
    explorerAdminServer: ExplorerAdminServer
): Promise<ExplorerViewEntry[]> => {
    // Get explorer program and table definitions
    const explorerProgram = await explorerAdminServer.getExplorerFromSlug(slug)
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

    // Create base records from decision matrix
    console.log(
        `Processing explorer ${slug} (${explorerProgram.decisionMatrix.numRows} rows)`
    )
    const baseRecords = createBaseRecords(explorerProgram.decisionMatrix)

    // Enrich with grapher data
    const recordsWithGrapherData = await enrichWithGrapherData(
        baseRecords,
        trx,
        slug
    )

    // Fetch and apply indicator metadata
    console.log("Fetching indicator metadata for explorer", slug)
    const indicatorMetadata = await fetchIndicatorMetadata(
        recordsWithGrapherData as any,
        trx
    )
    console.log("Fetched indicator metadata for explorer", slug)

    const enrichedRecords = await enrichWithMetadata(
        recordsWithGrapherData,
        indicatorMetadata as any,
        entitiesPerColumnPerTable
    )

    // Finalize records with titles, sorting, and grouping
    return finalizeRecords(enrichedRecords, slug)
}

async function getExplorersWithInheritedTags(trx: db.KnexReadonlyTransaction) {
    const explorersBySlug = await db.getPublishedExplorersBySlug(trx)
    const parentTags = await db.getParentTagsByChildName(trx)
    const publishedExplorersWithTags = Object.values(explorersBySlug).map(
        (explorer) => ({
            ...explorer,
            tags: explorer.tags
                .flatMap((tag) => [tag.name, ...parentTags[tag.name]])
                .filter(
                    (tag, index, array) => !!tag && array.indexOf(tag) === index
                ),
        })
    )
    return publishedExplorersWithTags
}

export const getExplorerViewRecords = async (
    trx: db.KnexReadonlyTransaction
): Promise<ExplorerViewEntryWithExplorerInfo[]> => {
    console.log("Fetching explorer views to index")
    const publishedExplorersWithTags = await getExplorersWithInheritedTags(trx)
    const pageviews = await getAnalyticsPageviewsByUrlObj(trx)

    const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)

    let records = [] as ExplorerViewEntryWithExplorerInfo[]
    for (const explorerInfo of publishedExplorersWithTags) {
        const explorerViewRecords = await getExplorerViewRecordsForExplorerSlug(
            trx,
            explorerInfo.slug,
            explorerAdminServer
        )

        const explorerPageviews = get(
            pageviews,
            [`/explorers/${explorerInfo.slug}`, "views_7d"],
            0
        )
        // These have a score for ranking purposes, but it doesn't yet factor in the explorer's pageviews
        const unscoredRecords = explorerViewRecords.map(
            (record, i): Omit<ExplorerViewEntryWithExplorerInfo, "score"> => ({
                ...record,
                explorerSlug: explorerInfo.slug,
                explorerTitle: explorerInfo.title,
                explorerSubtitle: explorerInfo.subtitle,
                explorerViews_7d: explorerPageviews,
                viewTitleAndExplorerSlug: `${record.viewTitle} | ${explorerInfo.slug}`,
                numViewsWithinExplorer: explorerViewRecords.length,
                tags: explorerInfo.tags,
                objectID: `${explorerInfo.slug}-${i}`,
            })
        )
        records = records.concat(
            unscoredRecords.map((record) => ({
                ...record,
                score: computeScore(record),
            }))
        )
    }

    return records
}

const indexExplorerViewsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    if (BUGSNAG_NODE_API_KEY) {
        Bugsnag.start({
            apiKey: BUGSNAG_NODE_API_KEY,
            context: "index-explorer-views-to-algolia",
            autoTrackSessions: false,
        })
    }
    const client = getAlgoliaClient()

    if (!client) {
        await logErrorAndMaybeSendToBugsnag(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
        return
    }

    try {
        const index = client.initIndex(
            getIndexName(SearchIndexName.ExplorerViews)
        )

        const records = await db.knexReadonlyTransaction(
            getExplorerViewRecords,
            db.TransactionCloseMode.Close
        )
        console.log(`Indexing ${records.length} explorer views to Algolia`)
        await index.replaceAllObjects(records)
        console.log(`Indexing complete`)
    } catch (e) {
        console.error(e)
        await logErrorAndMaybeSendToBugsnag({
            name: `IndexExplorerViewsToAlgoliaError`,
            message: `${e}`,
        })
    }
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexExplorerViewsToAlgolia()
