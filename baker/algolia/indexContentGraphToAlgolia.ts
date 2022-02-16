import * as wpdb from "../../db/wpdb.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import {
    CONTENT_GRAPH_ALGOLIA_INDEX,
    getAlgoliaClient,
} from "./configureAlgolia.js"
import { getContentGraphRecords } from "./contentGraphToAlgolia"

const indexContentGraphToAlgolia = async () => {
    const dryRun = false
    if (!ALGOLIA_INDEXING) return

    const records = await getContentGraphRecords()

    if (!dryRun) {
        const client = getAlgoliaClient()
        if (!client) {
            console.error(
                `Failed indexing graph (Algolia client not initialized)`
            )
            return
        }

        const index = client.initIndex(CONTENT_GRAPH_ALGOLIA_INDEX)
        index.replaceAllObjects(records, {
            autoGenerateObjectIDIfNotExist: true,
        })
    }

    await wpdb.singleton.end()
}

indexContentGraphToAlgolia()
