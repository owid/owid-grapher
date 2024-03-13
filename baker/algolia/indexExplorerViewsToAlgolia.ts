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

            // TODO: Handle grapherId and fetch title/subtitle
            // TODO: Handle indicator-based explorers

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

    return records
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
        console.error(
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
        console.log("Error indexing explorer views to Algolia:", e)
    }
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexExplorerViewsToAlgolia()
