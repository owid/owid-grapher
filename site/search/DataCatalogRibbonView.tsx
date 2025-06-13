import { TagGraphRoot } from "@ourworldindata/types"
import { Region } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useQuery } from "@tanstack/react-query"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogRibbonViewSkeleton.js"
import { DataCatalogRibbonResult, SearchState } from "./searchTypes.js"
import { queryDataCatalogRibbons } from "./searchUtils.js"
import { searchQueryKeys } from "./searchQueryKeys.js"

export const DataCatalogRibbonView = ({
    addTopic,
    selectedCountries,
    topics,
    tagGraph,
    searchClient,
    searchState,
}: {
    addTopic: (x: string) => void
    selectedCountries: Region[]
    topics: Set<string>
    tagGraph: TagGraphRoot
    searchClient: SearchClient
    searchState: SearchState
}) => {
    const ribbonsQuery = useQuery<DataCatalogRibbonResult[], Error>({
        queryKey: searchQueryKeys.ribbons(searchState),
        queryFn: () =>
            queryDataCatalogRibbons(searchClient, searchState, tagGraph),
    })

    if (ribbonsQuery.isLoading) {
        return <DataCatalogRibbonViewSkeleton topics={topics} />
    }

    const resultsSortedByHitCount = ribbonsQuery.data?.sort(
        (a, b) => b.nbHits - a.nbHits
    )

    return (
        <>
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
