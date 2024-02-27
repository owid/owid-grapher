import cheerio from "cheerio"
import { isArray } from "lodash"
import { match } from "ts-pattern"
import {
    checkIsPlainObjectWithGuard,
    identity,
    keyBy,
} from "@ourworldindata/utils"
import { getAlgoliaClient } from "./configureAlgolia.js"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { chunkParagraphs } from "../chunk.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { Chart } from "../../db/model/Chart.js"
import { Knex } from "knex"

type ExplorerBlockColumns = {
    type: "columns"
    block: { name: string; additionalInfo?: string }[]
}

type ExplorerBlockGraphers = {
    type: "graphers"
    block: {
        title?: string
        subtitle?: string
        grapherId?: number
    }[]
}

type ExplorerEntry = {
    slug: string
    title: string
    subtitle: string
    views_7d: number
    blocks: string // (ExplorerBlockLineChart | ExplorerBlockColumns | ExplorerBlockGraphers)[]
}

type ExplorerRecord = {
    slug: string
    title: string
    subtitle: string
    views_7d: number
    text: string
}

function extractTextFromExplorer(
    blocksString: string,
    graphersUsedInExplorers: Record<number, Chart | null>
): string {
    const blockText = new Set<string>()
    const blocks = JSON.parse(blocksString)

    if (isArray(blocks)) {
        for (const block of blocks) {
            if (checkIsPlainObjectWithGuard(block) && "type" in block) {
                match(block)
                    .with(
                        { type: "columns" },
                        (columns: ExplorerBlockColumns) => {
                            columns.block.forEach(
                                ({ name = "", additionalInfo = "" }) => {
                                    blockText.add(name)
                                    blockText.add(additionalInfo)
                                }
                            )
                        }
                    )
                    .with(
                        { type: "graphers" },
                        (graphers: ExplorerBlockGraphers) => {
                            graphers.block.forEach(
                                ({
                                    title = "",
                                    subtitle = "",
                                    grapherId = undefined,
                                }) => {
                                    blockText.add(title)
                                    blockText.add(subtitle)

                                    if (grapherId !== undefined) {
                                        const chartConfig =
                                            graphersUsedInExplorers[grapherId]
                                                ?.config

                                        if (chartConfig) {
                                            blockText.add(
                                                chartConfig.title ?? ""
                                            )
                                            blockText.add(
                                                chartConfig.subtitle ?? ""
                                            )
                                        }
                                    }
                                }
                            )
                        }
                    )
                    .otherwise(() => {
                        // type: "tables"
                        // do nothing
                    })
            }
        }
    }

    return [...blockText].filter(identity).join(" ")
}

function getNullishJSONValueAsPlaintext(value: string): string {
    return value !== "null" ? cheerio.load(value)("body").text() : ""
}

const getExplorerRecords = async (
    knex: Knex<any, any[]>
): Promise<ExplorerRecord[]> => {
    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    // Fetch info about all charts used in explorers, as linked by the explorer_charts table
    const graphersUsedInExplorers = await db
        .knexRaw<{ chartId: number }>(
            `
        SELECT DISTINCT chartId
        FROM explorer_charts
        `,
            knex
        )
        .then((results: { chartId: number }[]) =>
            results.map(({ chartId }) => chartId)
        )
        .then((ids) => Promise.all(ids.map((id) => Chart.findOneBy({ id }))))
        .then((charts) => keyBy(charts, "id"))

    const explorerRecords = await db
        .knexRaw<Omit<ExplorerEntry, "views_7d">>(
            `
    SELECT slug,
        COALESCE(config->>"$.explorerSubtitle", "null")     AS subtitle,
        COALESCE(config->>"$.explorerTitle", "null")        AS title,
        COALESCE(config->>"$.blocks", "null")               AS blocks
    FROM explorers
    WHERE isPublished = true
    `,
            knex
        )
        .then((results) =>
            results.flatMap(({ slug, title, subtitle, blocks }) => {
                const textFromExplorer = extractTextFromExplorer(
                    blocks,
                    graphersUsedInExplorers
                )
                const uniqueTextTokens = new Set([
                    ...textFromExplorer.split(" "),
                ])
                const textChunks = chunkParagraphs(
                    [...uniqueTextTokens].join(" "),
                    1000
                )

                // In case we don't have any text for this explorer, we still want to index it
                const textChunksForIteration = textChunks.length
                    ? textChunks
                    : [""]

                const formattedTitle = `${getNullishJSONValueAsPlaintext(
                    title
                )} Data Explorer`

                return textChunksForIteration.map((chunk, i) => ({
                    slug,
                    title: formattedTitle,
                    subtitle: getNullishJSONValueAsPlaintext(subtitle),
                    views_7d: pageviews[`/explorers/${slug}`]?.views_7d ?? 0,
                    text: chunk,
                    objectID: `${slug}-${i}`,
                }))
            })
        )

    return explorerRecords
}

const indexExplorersToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed indexing explorers (Algolia client not initialized)`
        )
        return
    }

    try {
        const index = client.initIndex(SearchIndexName.Explorers)

        const knex = db.knexInstance()
        const records = await getExplorerRecords(knex)
        await index.replaceAllObjects(records)

        await db.closeTypeOrmAndKnexConnections()
    } catch (e) {
        console.log("Error indexing explorers to Algolia: ", e)
    }
}

indexExplorersToAlgolia()
