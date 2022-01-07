import {
    ChartRecord,
    DocumentNode,
    GraphType,
} from "../../clientUtils/owidTypes"
import { getContentGraph, getParentTopicsTitle } from "../../db/contentGraph"
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
    const records = []

    const graph = await getContentGraph()

    const allDocumentNodes: DocumentNode[] = (
        await graph.find(GraphType.Document)
    ).payload.records

    const allChartRecords: ChartRecord[] = (await graph.find(GraphType.Chart))
        .payload.records

    for (const graphNode of [...allDocumentNodes, ...allChartRecords]) {
        const allParentTopicsTitle = await getParentTopicsTitle(
            graphNode,
            graph
        )

        let parentTopicsTrails = {}
        if (allParentTopicsTitle && allParentTopicsTitle.length !== 0) {
            parentTopicsTrails = formatParentTopicsTrails(allParentTopicsTitle)
        }

        records.push({
            // objectID: graphNode.id, // ID collision between documents and charts, do not use as-is
            id: graphNode.id,
            title: graphNode.title,
            type: graphNode.type,
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
        index.replaceAllObjects(records, {
            autoGenerateObjectIDIfNotExist: true,
        })
    }

    await wpdb.singleton.end()
}

if (require.main === module) indexContentGraphToAlgolia()
