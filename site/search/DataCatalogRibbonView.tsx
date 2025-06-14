import { TagGraphRoot } from "@ourworldindata/types"
import { SearchClient } from "algoliasearch"
import { useQuery } from "@tanstack/react-query"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogRibbonViewSkeleton.js"
import { DataCatalogRibbonResult } from "./searchTypes.js"
import { queryDataCatalogRibbons, searchQueryKeys } from "./useQueries.js"
import { useSearchContext } from "./SearchContext.js"

export const DataCatalogRibbonView = ({
    tagGraph,
    searchClient,
}: {
    tagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const { state } = useSearchContext()

    const query = useQuery<DataCatalogRibbonResult[], Error>({
        queryKey: searchQueryKeys.dataRibbons(state),
        queryFn: () => queryDataCatalogRibbons(searchClient, state, tagGraph),
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
