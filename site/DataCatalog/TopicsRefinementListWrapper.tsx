import { useMemo } from "react"
import { TopicsRefinementList } from "./TopicsRefinementList.js"
import { LandingPageRefinementsHeading } from "./DataCatalogSkeletons.js"
import {
    DataCatalogSearchResult,
    DataCatalogRibbonResult,
} from "./DataCatalogUtils.js"

export const TopicsRefinementListWrapper = ({
    results,
    topics,
    addTopic,
}: {
    results?: DataCatalogSearchResult | DataCatalogRibbonResult[]
    topics: Set<string>
    addTopic: (topic: string) => void
}) => {
    // Extract facets based on result type
    const facets = useMemo(() => {
        if (!results) return {}

        // If results is an array, it's DataCatalogRibbonResult[]
        if (Array.isArray(results)) {
            return Object.fromEntries(
                results.map((result) => [result.title, result.nbHits])
            )
        }

        // Otherwise it's DataCatalogSearchResult
        return results.facets?.tags || {}
    }, [results])

    return (
        <div className="span-cols-12 col-start-2" style={{ marginTop: 32 }}>
            <LandingPageRefinementsHeading topics={topics} />
            <TopicsRefinementList
                topics={topics}
                facets={facets}
                addTopic={addTopic}
            />
        </div>
    )
}
