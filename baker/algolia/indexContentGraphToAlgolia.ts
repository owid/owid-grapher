import { DocumentNode } from "../../clientUtils/owidTypes"
import {
    getContentGraph,
    getParentTopicsTitle,
    GraphType,
} from "../../db/contentGraph"
import * as wpdb from "../../db/wpdb"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings"
import {
    CONTENT_GRAPH_ALGOLIA_INDEX,
    getAlgoliaClient,
} from "./configureAlgolia"

export const formatParentTopicsTrails = (
    parentTopicsTitle: string[][]
): { [facetLevelKey: string]: string[] } => {
    const facetPrefix = "topics.lvl"
    const topicsFacets: any = {}
    parentTopicsTitle.forEach((topicsTitle) => {
        const allTopicsTitleFromRoot = topicsTitle.map((_, i) => {
            return topicsTitle.slice(0, i + 1)
        })

        allTopicsTitleFromRoot.forEach((topicsTitleFromRoot) => {
            const key = `${facetPrefix}${topicsTitleFromRoot.length - 1}`
            const topicsTitleTrail = topicsTitleFromRoot.join(" > ")
            if (topicsFacets.hasOwnProperty(key)) {
                topicsFacets[key] = [...topicsFacets[key], topicsTitleTrail]
            } else {
                topicsFacets[key] = [topicsTitleTrail]
            }
        })
    })
    return topicsFacets
}

const getContentGraphRecords = async () => {
    const store = await getContentGraph()

    const allDocumentNodes: DocumentNode[] = (
        await store.find(GraphType.Document)
    ).payload.records

    const records = []

    for (const documentNode of allDocumentNodes) {
        const parentTopicsTitle = await getParentTopicsTitle(
            documentNode,
            allDocumentNodes
        )

        if (!parentTopicsTitle || parentTopicsTitle.length === 0) continue
        if (!documentNode.title) continue

        const parentTopicsTrails = formatParentTopicsTrails(parentTopicsTitle)
        records.push({
            objectID: documentNode.id,
            title: documentNode.title,
            ...parentTopicsTrails,
        })
    }
    return records
}

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
        index.replaceAllObjects(records)
    }

    await wpdb.singleton.end()
}

if (require.main === module) indexContentGraphToAlgolia()
