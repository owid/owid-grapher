import { QueryClientProvider, useQuery } from "@tanstack/react-query"
import {
    SearchChartsResponse,
    SearchChartHit,
    SearchResultType,
} from "@ourworldindata/types"
import { SearchChartHitComponent } from "./search/SearchChartHitComponent.js"
import { createTopicFilter } from "./search/searchUtils.js"
import { queryCharts, searchQueryKeys } from "./search/queries.js"
import {
    getLiteSearchClient,
    getSearchQueryClient,
} from "./search/searchClients.js"
import { SearchDataResultsSkeleton } from "./search/SearchDataResultsSkeleton.js"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"

const MAX_MEDIUM_RESULTS = 4
const MAX_SMALL_RESULTS = 5

type FeaturedMetricsProps = {
    topicName: string
}

const FeaturedMetrics = ({ topicName }: FeaturedMetricsProps) => {
    const liteSearchClient = getLiteSearchClient()

    const searchState = {
        query: "",
        filters: [createTopicFilter(topicName)],
        requireAllCountries: false,
        resultType: SearchResultType.DATA,
    }

    const { data, isLoading, isError } = useQuery<SearchChartsResponse>({
        // reusing the same query key function as search for simplicity but
        // would technically collide if using the same query client instance
        queryKey: searchQueryKeys.charts(searchState),
        queryFn: () => queryCharts(liteSearchClient, searchState, 0),
        enabled: Boolean(topicName),
    })

    if (isError || !topicName) return null

    const hits: SearchChartHit[] = (data?.hits ?? []).slice(
        0,
        MAX_MEDIUM_RESULTS + MAX_SMALL_RESULTS
    )

    if (!isLoading && hits.length === 0) return null

    return (
        <section className="featured-metrics col-start-2 span-cols-12">
            <h1 className="featured-metrics__title h1-semibold">
                Featured data on {topicName}
            </h1>
            {isLoading ? (
                <SearchDataResultsSkeleton />
            ) : (
                <ul className="featured-metrics__list search-data-results__list">
                    {hits.map((hit, hitIndex) => {
                        const variant =
                            hitIndex < MAX_MEDIUM_RESULTS ? "medium" : "small"

                        return (
                            <li
                                className="featured-metrics__list-item search-data-results__hit"
                                key={hit.objectID}
                            >
                                <SearchChartHitComponent
                                    hit={hit}
                                    variant={variant}
                                    selectedRegionNames={[]}
                                    onClick={() => undefined}
                                />
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

export const FeaturedMetricsWrapper = (props: FeaturedMetricsProps) => {
    const queryClient = getSearchQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            <FeaturedMetrics {...props} />
        </QueryClientProvider>
    )
}
