import * as db from "../../db/db.js"
import { tsvFormat } from "d3-dsv"
import {
    ExplorerChoiceParams,
    ExplorerControlType,
    GridBoolean,
    DecisionMatrix,
} from "@ourworldindata/explorer"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { groupBy, keyBy, orderBy, partition } from "lodash"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { DbRawVariable } from "@ourworldindata/utils"
import { logErrorAndMaybeSendToBugsnag } from "../../serverUtils/errorLog.js"
import Bugsnag from "@bugsnag/js"

export type ExplorerBlockGraphers = {
    type: "graphers"
    block: {
        title?: string
        subtitle?: string
        grapherId?: number
    }[]
}

interface ExplorerViewEntry {
    viewTitle: string
    viewSubtitle: string
    viewSettings: string[]
    viewQueryParams: string

    viewGrapherId?: number
    viewFirstYIndicator?: string | number // Variable ID or ETL path

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

interface ExplorerViewEntryWithExplorerInfo extends ExplorerViewEntry {
    explorerSlug: string
    explorerTitle: string
    explorerSubtitle: string
    explorerViews_7d: number
    viewTitleAndExplorerSlug: string // used for deduplication: `viewTitle | explorerSlug`
    numViewsWithinExplorer: number

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

const computeScore = (
    record: Omit<ExplorerViewEntry, "viewTitleIndexWithinExplorer"> &
        Partial<ExplorerViewEntryWithExplorerInfo>
) =>
    (record.explorerViews_7d ?? 0) * 10 -
    record.numNonDefaultSettings * 50 -
    record.titleLength

const getExplorerViewRecordsForExplorerSlug = async (
    trx: db.KnexReadonlyTransaction,
    slug: string
): Promise<ExplorerViewEntry[]> => {
    const explorerConfig = await trx
        .table("explorers")
        .select("config")
        .where({ slug })
        .first()
        .then((row) => JSON.parse(row.config) as any)

    const explorerGrapherBlock: ExplorerBlockGraphers =
        explorerConfig.blocks.filter(
            (block: any) => block.type === "graphers"
        )[0] as ExplorerBlockGraphers

    if (explorerGrapherBlock === undefined)
        throw new Error(`Explorer ${slug} has no grapher block`)

    // TODO: Maybe make DecisionMatrix accept JSON directly
    const tsv = tsvFormat(explorerGrapherBlock.block)
    const explorerDecisionMatrix = new DecisionMatrix(tsv)

    console.log(
        `Processing explorer ${slug} (${explorerDecisionMatrix.numRows} rows)`
    )

    const defaultSettings = explorerDecisionMatrix.defaultSettings

    const records = explorerDecisionMatrix
        .allDecisionsAsQueryParams()
        .map((choice, i) => {
            explorerDecisionMatrix.setValuesFromChoiceParams(choice)

            // Check which choices are non-default, i.e. are not the first available option in a dropdown/radio
            const nonDefaultSettings = Object.entries(
                explorerDecisionMatrix.availableChoiceOptions
            ).filter(([choiceName, choiceOptions]) => {
                // Keep only choices which are not the default, which is:
                // - either the options marked as `default` in the decision matrix
                // - or the first available option in the decision matrix
                return (
                    choiceOptions.length > 1 &&
                    !(defaultSettings[choiceName] !== undefined
                        ? defaultSettings[choiceName] === choice[choiceName]
                        : choice[choiceName] === choiceOptions[0])
                )
            })

            const record: Omit<
                ExplorerViewEntry,
                "viewTitleIndexWithinExplorer" | "titleLength"
            > = {
                viewTitle: explorerDecisionMatrix.selectedRow.title,
                viewSubtitle: explorerDecisionMatrix.selectedRow.subtitle,
                viewSettings: explorerChoiceToViewSettings(
                    choice,
                    explorerDecisionMatrix
                ),
                viewGrapherId: explorerDecisionMatrix.selectedRow.grapherId,
                viewFirstYIndicator:
                    explorerDecisionMatrix.selectedRow.yVariableIds
                        ?.trim()
                        .split(" ")
                        .at(0),
                viewQueryParams: explorerDecisionMatrix.toString(),

                viewIndexWithinExplorer: i,
                numNonDefaultSettings: nonDefaultSettings.length,
            }
            return record
        })

    // Enrich `grapherId`-powered views with title/subtitle
    const grapherIds = records
        .filter((record) => record.viewGrapherId !== undefined)
        .map((record) => record.viewGrapherId as number)

    if (grapherIds.length) {
        console.log(
            `Fetching grapher configs from ${grapherIds.length} graphers for explorer ${slug}`
        )
        const grapherIdToTitle = await trx
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

        for (const record of records) {
            if (record.viewGrapherId !== undefined) {
                const grapherInfo = grapherIdToTitle[record.viewGrapherId]
                if (grapherInfo === undefined) {
                    console.warn(
                        `Grapher id ${record.viewGrapherId} not found for explorer ${slug}`
                    )
                    continue
                }
                record.viewTitle = grapherInfo.title
                record.viewSubtitle = grapherInfo.subtitle
            }
        }
    }

    // Resolve the `yIndicatorIds` field
    const yIndicatorIds = records
        .map((record) => record.viewFirstYIndicator)
        .filter((id) => id !== undefined)
        .filter((id) => id !== "")

    if (yIndicatorIds.length) {
        console.log(
            `Fetching indicator metadata from ${yIndicatorIds.length} indicators for explorer ${slug}`
        )

        type IndicatorRecord = Pick<
            DbRawVariable,
            | "id"
            | "catalogPath"
            | "titlePublic"
            | "display"
            | "name"
            | "descriptionShort"
        >
        // The `yIndicatorId` can be a variable ID or a catalog path, and we want to resolve both
        const indicatorIdToTitle: IndicatorRecord[] = await trx
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
            .whereIn("id", yIndicatorIds)
            .orWhereIn("catalogPath", yIndicatorIds)

        const indicatorsKeyedByIdAndCatalogPath = indicatorIdToTitle.reduce(
            (acc, indicator) => {
                acc[indicator.id] = indicator
                if (indicator.catalogPath)
                    acc[indicator.catalogPath] = indicator
                return acc
            },
            {} as Record<string | number, IndicatorRecord>
        )

        for (const record of records) {
            if (record.viewFirstYIndicator !== undefined) {
                const indicatorInfo =
                    indicatorsKeyedByIdAndCatalogPath[
                        record.viewFirstYIndicator
                    ]
                if (indicatorInfo === undefined) {
                    console.warn(
                        `Indicator id ${record.viewFirstYIndicator} not found for explorer ${slug}`
                    )
                    continue
                }

                // This is the fallback chain for the grapher title. it's complicated.
                record.viewTitle =
                    record.viewTitle ??
                    indicatorInfo.titlePublic ??
                    (indicatorInfo.display
                        ? JSON.parse(indicatorInfo.display).name
                        : undefined) ??
                    indicatorInfo.name
                record.viewSubtitle =
                    record.viewSubtitle ?? indicatorInfo.descriptionShort
            }
        }
    }

    // Drop any views where we couldn't obtain a title, for whatever reason
    const [recordsWithViewTitle, recordsWithNoViewTitle] = partition(
        records,
        (record) => record.viewTitle !== undefined
    )

    for (const record of recordsWithNoViewTitle) {
        await logErrorAndMaybeSendToBugsnag({
            name: "ExplorerViewTitleMissing",
            message: `Explorer ${slug} has a view with no title: ${record.viewQueryParams}.`,
        })
    }

    // Remove Markdown from viewSubtitle; do this after fetching grapher info above, as it might also contain Markdown
    const recordsWithTitleLength = recordsWithViewTitle.map((record) => {
        if (record.viewSubtitle) {
            record.viewSubtitle = new MarkdownTextWrap({
                text: record.viewSubtitle,
                fontSize: 10, // doesn't matter, but is a mandatory field
            }).plaintext
        }
        return { ...record, titleLength: record.viewTitle.length }
    }) as Omit<ExplorerViewEntry, "viewTitleIndexWithinExplorer">[]

    // Compute viewTitleIndexWithinExplorer:
    // First, sort by score descending (ignoring views_7d, which is not relevant _within_ an explorer).
    // Then, group by viewTitle.
    // Finally, ungroup again, and keep track of the index of each element within the group.
    const recordsSortedByScore = orderBy(
        recordsWithTitleLength,
        (record) => computeScore(record),
        "desc"
    )
    const recordsGroupedByViewTitle = groupBy(recordsSortedByScore, "viewTitle")
    const recordsWithIndexWithinExplorer = Object.values(
        recordsGroupedByViewTitle
    ).flatMap((recordsGroup) =>
        recordsGroup.map((record, i) => ({
            ...record,
            viewTitleIndexWithinExplorer: i,
        }))
    )

    return recordsWithIndexWithinExplorer
}

const getExplorerViewRecords = async (
    trx: db.KnexReadonlyTransaction
): Promise<ExplorerViewEntryWithExplorerInfo[]> => {
    const publishedExplorers = Object.values(
        await db.getPublishedExplorersBySlug(trx)
    )

    const pageviews = await getAnalyticsPageviewsByUrlObj(trx)

    let records = [] as ExplorerViewEntryWithExplorerInfo[]
    for (const explorerInfo of publishedExplorers) {
        const explorerViewRecords = await getExplorerViewRecordsForExplorerSlug(
            trx,
            explorerInfo.slug
        )

        const explorerPageviews =
            pageviews[`/explorers/${explorerInfo.slug}`]?.views_7d ?? 0
        const unscoredRecords = explorerViewRecords.map(
            (record, i): Omit<ExplorerViewEntryWithExplorerInfo, "score"> => ({
                ...record,
                explorerSlug: explorerInfo.slug,
                explorerTitle: explorerInfo.title,
                explorerSubtitle: explorerInfo.subtitle,
                explorerViews_7d: explorerPageviews,
                viewTitleAndExplorerSlug: `${record.viewTitle} | ${explorerInfo.slug}`,
                numViewsWithinExplorer: explorerViewRecords.length,

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
        await index.replaceAllObjects(records)
    } catch (e) {
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
