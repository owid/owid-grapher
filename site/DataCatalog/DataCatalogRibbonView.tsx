import { TagGraphRoot } from "@ourworldindata/types"
import { Region } from "@ourworldindata/utils"
import * as React from "react"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogSkeletons.js"
import { DataCatalogRibbonResult } from "./DataCatalogUtils.js"
import { TopicsRefinementListWrapper } from "./TopicsRefinementListWrapper.js"

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

    // const resultsSortedByHitCount = results?.sort((a, b) => b.nbHits - a.nbHits)
    return (
        <>
            <TopicsRefinementListWrapper
                topics={topics}
                results={results}
                addTopic={addTopic}
            />
            <div className="span-cols-14 grid grid-cols-12-full-width data-catalog-ribbons">
                {results?.map((result) => (
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
