import { liteClient, LiteClient } from "algoliasearch/lite"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"

let liteSearchClient: LiteClient | null = null

export const getLiteSearchClient = (): LiteClient => {
    if (!liteSearchClient) {
        liteSearchClient = liteClient(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    }
    return liteSearchClient
}
