import { useQuery } from "@tanstack/react-query"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogRibbonViewSkeleton.js"
import { DataCatalogRibbonResult } from "./searchTypes.js"
import { queryDataCatalogRibbons, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"

export const DataCatalogRibbonView = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<DataCatalogRibbonResult[], Error>({
        queryKey: searchQueryKeys.dataRibbons(state),
        queryFn: () =>
            queryDataCatalogRibbons(
                searchClient,
                state,
                topicTagGraph,
                selectedTopic
            ),
    })

    if (query.isLoading) {
        return <DataCatalogRibbonViewSkeleton />
    }

    const resultsSortedByHitCount = query.data?.sort(
        (a, b) => b.nbHits - a.nbHits
    )

    return (
        <>
            <div className="span-cols-14 grid grid-cols-12-full-width data-catalog-ribbons">
                {resultsSortedByHitCount?.map((result) => (
                    <DataCatalogRibbon key={result.title} result={result} />
                ))}
            </div>
        </>
    )
}
