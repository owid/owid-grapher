import {
    AlgoliaRecord,
    ChartRecord,
    DocumentNode,
    GraphDocumentType,
    GraphType,
    TopicId,
} from "../../clientUtils/owidTypes.js"
import { getContentGraph } from "../../db/contentGraph.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../../settings/clientSettings.js"
import { formatUrls } from "../../site/formatting.js"

interface TopicsTrailsByLevel {
    [facetLevelKey: string]: string[]
}
export const formatParentTopicsTrails = (
    parentTopicsTitle: string[][]
): TopicsTrailsByLevel => {
    const facetPrefix = "topics.lvl"
    const topicsFacets: TopicsTrailsByLevel = {}
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

export const getParentTopicsTitle = async (
    node: DocumentNode | ChartRecord,
    graph: any,
    childrenTopicsTitle: string[] = []
): Promise<string[][]> => {
    const currentTopicsTitle = [...childrenTopicsTitle]

    if (node.type === GraphDocumentType.Topic)
        currentTopicsTitle.unshift(node.title)

    if (!node.parentTopics || node.parentTopics.length === 0)
        return [currentTopicsTitle]

    const parentTopicsTitle = await Promise.all(
        node.parentTopics.map(async (parentTopicId: TopicId) => {
            const parentNode = (
                await graph.find(GraphType.Document, parentTopicId)
            ).payload.records[0]

            const grandParentTopicsTitle = await getParentTopicsTitle(
                parentNode,
                graph,
                currentTopicsTitle
            )
            return grandParentTopicsTitle
        })
    )

    return parentTopicsTitle.flat()
}
const getParentTopicsTrails = async (
    graphNode: DocumentNode | ChartRecord,
    graph: any
): Promise<TopicsTrailsByLevel> => {
    const allParentTopicsTitle = await getParentTopicsTitle(graphNode, graph)

    let parentTopicsTrails = {}
    if (allParentTopicsTitle && allParentTopicsTitle.length !== 0) {
        parentTopicsTrails = formatParentTopicsTrails(allParentTopicsTitle)
    }

    return parentTopicsTrails
}
export const getContentGraphRecords = async (): Promise<AlgoliaRecord[]> => {
    const records = []

    const graph = await getContentGraph()

    // Add document nodes
    const allDocumentNodes: DocumentNode[] = (
        await graph.find(GraphType.Document)
    ).payload.records
    for (const documentNode of allDocumentNodes) {
        const parentTopicsTrails = await getParentTopicsTrails(
            documentNode,
            graph
        )

        records.push({
            // objectID: graphNode.id, // ID collision between documents and charts, do not use as-is
            id: documentNode.id,
            title: documentNode.title,
            type: documentNode.type,
            ...(documentNode.image && {
                image: formatUrls(documentNode.image),
            }),
            ...parentTopicsTrails,
        })
    }

    // Add chart records
    const allChartRecords: ChartRecord[] = (await graph.find(GraphType.Chart))
        .payload.records
    for (const chartRecord of allChartRecords) {
        const parentTopicsTrails = await getParentTopicsTrails(
            chartRecord,
            graph
        )
        records.push({
            // objectID: graphNode.id, // ID collision between documents and charts, do not use as-is
            id: chartRecord.id,
            title: chartRecord.title,
            type: chartRecord.type,
            image: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chartRecord.slug}.svg`,
            ...parentTopicsTrails,
        })
    }

    return records
}
