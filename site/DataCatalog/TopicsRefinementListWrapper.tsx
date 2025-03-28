import { useEffect, useState } from "react"
import { TopicsRefinementList } from "./TopicsRefinementList.js"
import { LandingPageRefinementsHeading } from "./DataCatalogSkeletons.js"
import {
    DataCatalogSearchResult,
    DataCatalogRibbonResult,
} from "./DataCatalogUtils.js"
import {
    flattenNonTopicNodes,
    getAllChildrenOfArea,
} from "@ourworldindata/utils"

const extractFacetsFromResults = (
    results?: DataCatalogSearchResult | DataCatalogRibbonResult[]
): Record<string, number> => {
    if (!results) return {}

    // If results is an array, it's DataCatalogRibbonResult[]
    if (Array.isArray(results)) {
        return Object.fromEntries(
            results.map((result) => [result.title, result.nbHits])
        )
    }

    // Otherwise it's DataCatalogSearchResult
    return results.facets?.tags || {}
}

export const TopicsRefinementListWrapper = ({
    results,
    topics,
    addTopic,
}: {
    results?: DataCatalogSearchResult | DataCatalogRibbonResult[]
    topics: Set<string>
    addTopic: (topic: string) => void
}) => {
    const [allTopics, setAllTopics] = useState<Set<string>>(new Set())
    // Extract facets based on result type
    const facets = extractFacetsFromResults(results)

    useEffect(() => {
        const fetchTopicTagGraph = async () => {
            const response = await fetch("/topicTagGraph.json")
            const tagGraph = await response.json()
            const topicTagGraph = flattenNonTopicNodes(tagGraph)

            // Get all topics (top-level and children) from the topic graph
            const allTopics = new Set<string>(
                topicTagGraph.children.flatMap((area) => [
                    area.name,
                    ...getAllChildrenOfArea(area).map((node) => node.name),
                ])
            )
            setAllTopics(allTopics)
        }

        fetchTopicTagGraph().catch((err) => {
            throw new Error(`Failed to fetch tag graph: ${err}`)
        })
    }, [])

    // Filter out facets that are not topics
    const eligibleFacets = Object.fromEntries(
        Object.entries(facets).filter(([facetName]) => allTopics.has(facetName))
    )

    if (Object.keys(eligibleFacets).length === 0) {
        return null
    }

    return (
        <div className="span-cols-12 col-start-2" style={{ marginTop: 32 }}>
            <LandingPageRefinementsHeading topics={topics} />
            <TopicsRefinementList
                topics={topics}
                facets={eligibleFacets}
                addTopic={addTopic}
            />
        </div>
    )
}
