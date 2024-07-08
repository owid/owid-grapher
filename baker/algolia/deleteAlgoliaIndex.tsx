import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { ALGOLIA_INDEX_PREFIX } from "../../settings/clientSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"

const deleteAlgoliaIndex = async () => {
    if (!ALGOLIA_INDEXING) return

    if (ALGOLIA_INDEX_PREFIX === "") {
        console.error(
            "ALGOLIA_INDEX_PREFIX is not set, refusing to delete production indexes"
        )
        return
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed to remove index (Algolia client not initialized)`)
        return
    }

    for (const suffix of [
        SearchIndexName.Pages,
        SearchIndexName.Charts,
        SearchIndexName.ExplorerViews,
    ]) {
        const indexName = getIndexName(suffix)
        const index = client.initIndex(indexName)
        try {
            await index.delete()
            console.log(`Index '${indexName}' removed successfully`)
        } catch (error) {
            console.error(`Error removing index '${indexName}':`, error)
        }
    }

    process.exit(0)
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void deleteAlgoliaIndex()
