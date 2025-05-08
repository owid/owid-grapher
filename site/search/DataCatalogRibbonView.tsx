import { TagGraphRoot } from "@ourworldindata/types"
import { Region } from "@ourworldindata/utils"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogRibbonViewSkeleton.js"
import { SearchTopicRefinementsHeading } from "./SearchTopicRefinementsHeading.js"
import { DataCatalogRibbonResult } from "./searchTypes.js"
import { TopicsRefinementList } from "./TopicsRefinementList.js"

export const DataCatalogRibbonView = ({
    addTopic,
    results,
    selectedCountries,
    topics,
    isLoading,
}: {
    addTopic: (x: string) => void
    removeTopic: (topic: string) => void
    results?: DataCatalogRibbonResult[]
    selectedCountries: Region[]
    topics: Set<string>
    tagGraph: TagGraphRoot
    isLoading: boolean
}) => {
    if (isLoading) {
        return <DataCatalogRibbonViewSkeleton topics={topics} />
    }

    const resultsSortedByHitCount = results?.sort((a, b) => b.nbHits - a.nbHits)

    const ribbonFacets = resultsSortedByHitCount
        ? Object.fromEntries(
              resultsSortedByHitCount.map((result) => [
                  result.title,
                  result.nbHits,
              ])
          )
        : {}

    return (
        <>
            <SearchTopicRefinementsHeading topics={topics} />
            <TopicsRefinementList
                topics={topics}
                facets={ribbonFacets}
                addTopic={addTopic}
            />
            <div className="span-cols-14 grid grid-cols-12-full-width data-catalog-ribbons">
                {resultsSortedByHitCount?.map((result) => (
                    <DataCatalogRibbon
                        key={result.title}
                        result={result}
                        addTopic={addTopic}
                        selectedCountries={selectedCountries}
                    />
                ))}
            </div>
        </>
    )
}
