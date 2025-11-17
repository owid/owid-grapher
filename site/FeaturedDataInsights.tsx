import { useMemo } from "react"
import { QueryClientProvider, useQuery } from "@tanstack/react-query"
import {
    DataInsightHit,
    SearchDataInsightResponse,
    SearchResultType,
    SearchState,
} from "@ourworldindata/types"
import { createTopicFilter } from "./search/searchUtils.js"
import { queryDataInsights, searchQueryKeys } from "./search/queries.js"
import {
    getLiteSearchClient,
    getSearchQueryClient,
} from "./search/searchClients.js"
import { SearchDataInsightsResultsSkeleton } from "./search/SearchDataInsightsResultsSkeleton.js"
import { SearchDataInsightHit } from "./search/SearchDataInsightHit.js"
import { Button } from "@ourworldindata/components"

const MAX_DATA_INSIGHTS_RESULTS = 1000 // setting to maximum allowed to get all results

type FeaturedDataInsightsProps = {
    topicName: string
}

const FeaturedDataInsights = ({ topicName }: FeaturedDataInsightsProps) => {
    const liteSearchClient = getLiteSearchClient()

    const searchState = useMemo<SearchState>(
        () => ({
            query: "",
            filters: [createTopicFilter(topicName)],
            requireAllCountries: false,
            resultType: SearchResultType.WRITING,
        }),
        [topicName]
    )

    const { data, isError, isLoading } = useQuery<
        SearchDataInsightResponse,
        Error
    >({
        // reusing the same query key function as search for simplicity but
        // would technically collide if using the same query client instance
        queryKey: searchQueryKeys.dataInsights(searchState),
        queryFn: () =>
            queryDataInsights(
                liteSearchClient,
                searchState,
                0,
                MAX_DATA_INSIGHTS_RESULTS
            ),
        enabled: Boolean(topicName),
    })

    const hits = data?.hits ?? []
    const totalResults = data?.nbHits ?? 0

    if (isError || !topicName) return null
    if (!isLoading && totalResults === 0) return null

    return (
        <section className="featured-data-insights col-start-2 span-cols-12">
            <h1 className="featured-data-insights__title h1-semibold">
                Data insights on {topicName}
            </h1>
            {isLoading ? (
                <SearchDataInsightsResultsSkeleton />
            ) : (
                <>
                    <div className="featured-data-insights__hits">
                        {hits.map((hit: DataInsightHit) => (
                            <SearchDataInsightHit
                                key={hit.objectID}
                                className="featured-data-insights__hit"
                                hit={hit}
                                onClick={() => undefined}
                            />
                        ))}
                    </div>
                    <div className="featured-data-insights__see-all">
                        <Button
                            theme="solid-vermillion"
                            text="See all data insights"
                            href="/data-insights"
                            dataTrackNote="featured-data-insights-see-all"
                        />
                    </div>
                </>
            )}
        </section>
    )
}

export const FeaturedDataInsightsWrapper = (
    props: FeaturedDataInsightsProps
) => {
    const queryClient = getSearchQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            <FeaturedDataInsights {...props} />
        </QueryClientProvider>
    )
}
