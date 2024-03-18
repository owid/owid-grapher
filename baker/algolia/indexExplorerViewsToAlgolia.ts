import { Knex } from "knex"
import * as db from "../../db/db.js"
import { ExplorerBlockGraphers } from "./indexExplorersToAlgolia.js"
import { DecisionMatrix } from "../../explorer/ExplorerDecisionMatrix.js"
import { tsvFormat } from "d3-dsv"
import {
    ExplorerChoiceParams,
    ExplorerControlType,
} from "../../explorer/ExplorerConstants.js"
import { GridBoolean } from "../../gridLang/GridLangConstants.js"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { keyBy } from "lodash"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"

interface ExplorerViewEntry {
    viewTitle: string
    viewSubtitle: string
    viewSettings: string[]
    viewQueryParams: string

    viewGrapherId?: number

    // Potential ranking criteria
    viewIndexWithinExplorer: number
    titleLength: number
    numNonDefaultSettings: number
    // viewViews_7d: number
}

interface ExplorerViewEntryWithExplorerInfo extends ExplorerViewEntry {
    explorerSlug: string
    explorerTitle: string
    explorerViews_7d: number
    viewTitleAndExplorerSlug: string // used for deduplication: `viewTitle | explorerSlug`

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

const getExplorerViewRecordsForExplorerSlug = async (
    knex: Knex<any, any>,
    slug: string
): Promise<ExplorerViewEntry[]> => {
    const explorerConfig = await knex
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

            const record: ExplorerViewEntry = {
                viewTitle: explorerDecisionMatrix.selectedRow.title,
                viewSubtitle: explorerDecisionMatrix.selectedRow.subtitle,
                viewSettings: explorerChoiceToViewSettings(
                    choice,
                    explorerDecisionMatrix
                ),
                viewGrapherId: explorerDecisionMatrix.selectedRow.grapherId,
                viewQueryParams: explorerDecisionMatrix.toString(),

                viewIndexWithinExplorer: i,
                titleLength: explorerDecisionMatrix.selectedRow.title?.length,
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
            `Fetching grapher info from ${grapherIds.length} graphers for explorer ${slug}`
        )
        const grapherIdToTitle = await knex
            .table("charts")
            .select(
                "id",
                knex.raw("config->>'$.title' as title"),
                knex.raw("config->>'$.subtitle' as subtitle")
            )
            .whereIn("id", grapherIds)
            .andWhereRaw("config->>'$.isPublished' = 'true'")
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
                record.titleLength = grapherInfo.title?.length
            }
        }
    }

    // TODO: Handle indicator-based explorers

    return records
}

const getExplorerViewRecords = async (
    knex: Knex<any, any>
): Promise<ExplorerViewEntryWithExplorerInfo[]> => {
    // db.getPublishedExplorersBySlug(knex)

    const publishedExplorers = Object.values(
        await db.getPublishedExplorersBySlug(knex)
    )

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    let records = [] as ExplorerViewEntryWithExplorerInfo[]
    for (const explorerInfo of publishedExplorers) {
        const explorerViewRecords = await getExplorerViewRecordsForExplorerSlug(
            knex,
            explorerInfo.slug
        )

        const explorerPageviews =
            pageviews[`/explorers/${explorerInfo.slug}`]?.views_7d ?? 0
        records = records.concat(
            explorerViewRecords.map(
                (record, i): ExplorerViewEntryWithExplorerInfo => ({
                    ...record,
                    explorerSlug: explorerInfo.slug,
                    explorerTitle: explorerInfo.title,
                    explorerViews_7d: explorerPageviews,
                    viewTitleAndExplorerSlug: `${record.viewTitle} | ${explorerInfo.slug}`,
                    // Scoring function
                    score:
                        explorerPageviews * 10 -
                        record.numNonDefaultSettings * 50 -
                        record.titleLength,

                    objectID: `${explorerInfo.slug}-${i}`,
                })
            )
        )
    }

    return records
}

const indexExplorerViewsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing charts (Algolia client not initialized)`)
        return
    }

    const index = client.initIndex(getIndexName(SearchIndexName.ExplorerViews))

    await db.getConnection()
    const records = await getExplorerViewRecords(db.knexInstance())
    await index.replaceAllObjects(records)

    await db.closeTypeOrmAndKnexConnections()
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

indexExplorerViewsToAlgolia()
