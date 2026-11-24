import { liteClient, type LiteClient } from "algoliasearch/lite"
import type { BakedAllChartsBlockResults } from "@ourworldindata/types"
import { getAlgoliaHostClientOptions } from "@ourworldindata/utils"
import type { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import {
    ALGOLIA_HOST,
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../settings/clientSettings.mjs"
import { queryAllChartsBlock } from "../site/search/queries.js"

let searchClient: LiteClient | undefined

function getSearchClient(): LiteClient {
    searchClient ??= liteClient(
        ALGOLIA_ID,
        ALGOLIA_SEARCH_KEY,
        getAlgoliaHostClientOptions(ALGOLIA_HOST)
    )
    return searchClient
}

export async function fetchAllChartsBlockResults(
    gdoc: Pick<GdocPost, "hasAllChartsBlock" | "tags" | "slug">
): Promise<BakedAllChartsBlockResults | undefined> {
    if (!gdoc.hasAllChartsBlock || !gdoc.tags?.length) return undefined

    try {
        const page = await queryAllChartsBlock(
            getSearchClient(),
            gdoc.tags.map((tag) => tag.name),
            { textQuery: "", countries: [] },
            0
        )
        return { page, fetchedAtMs: Date.now() }
    } catch (error) {
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                `Failed to fetch the all-charts block results for "${gdoc.slug}": ${error}`
            )
        )
        return undefined
    }
}
