import { useQuery } from "@tanstack/react-query"
import {
    SearchChartsResponse,
    SearchChartHit,
    SearchResultType,
    FEATURED_METRICS_ID,
} from "@ourworldindata/types"
import { SearchChartHitComponent } from "./search/SearchChartHitComponent.js"
import {
    createDatasetNamespaceFilter,
    createDatasetProductsFilter,
    createDatasetVersionFilter,
    createTopicFilter,
    SEARCH_BASE_PATH,
} from "./search/searchUtils.js"
import { stateToSearchParams } from "./search/searchState.js"
import { queryCharts, searchQueryKeys } from "./search/queries.js"
import { getLiteSearchClient } from "./search/searchClients.js"
import { SearchDataResultsSkeleton } from "./search/SearchDataResultsSkeleton.js"
import { Button } from "@ourworldindata/components"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"

const MAX_MEDIUM_RESULTS = 4
const MAX_SMALL_RESULTS = 5

export type FeaturedMetricsProps = {
    topicName?: string
    datasetProducts?: string[]
    datasetNamespaces?: string[]
    datasetVersions?: string[]
    className?: string
}

export const FeaturedMetrics = ({
    topicName,
    datasetProducts = [],
    datasetNamespaces = [],
    datasetVersions = [],
    className,
}: FeaturedMetricsProps) => {
    const liteSearchClient = getLiteSearchClient()
    const filters = [
        ...(topicName ? [createTopicFilter(topicName)] : []),
        ...datasetProducts.map(createDatasetProductsFilter),
        ...datasetNamespaces.map(createDatasetNamespaceFilter),
        ...datasetVersions.map(createDatasetVersionFilter),
    ]
    const searchState = {
        query: "",
        filters,
        requireAllCountries: false,
        resultType: SearchResultType.DATA,
    }

    const { data, isLoading, isError } = useQuery<SearchChartsResponse>({
        // reusing the same query key function as search for simplicity but
        // would technically collide if using the same query client instance
        queryKey: searchQueryKeys.charts(searchState),
        queryFn: () => queryCharts(liteSearchClient, searchState, 0),
    })

    if (isError) return null

    const hits: SearchChartHit[] = (data?.hits ?? []).slice(
        0,
        MAX_MEDIUM_RESULTS + MAX_SMALL_RESULTS
    )

    if (!isLoading && hits.length === 0) return null

    const params = stateToSearchParams(searchState)
    const searchHref = `${SEARCH_BASE_PATH}?${params.toString()}`

    return (
        <section
            className={cx(className, "needs-dividers")}
            id={FEATURED_METRICS_ID}
        >
            <h1 className="h1-semibold">
                <span>
                    {topicName
                        ? `Featured Data on ${topicName}`
                        : "Featured Data"}
                </span>
                <a
                    className="deep-link"
                    aria-labelledby={FEATURED_METRICS_ID}
                    href={`#${FEATURED_METRICS_ID}`}
                />
            </h1>
            {isLoading ? (
                <SearchDataResultsSkeleton />
            ) : (
                <>
                    <ul className="search-data-results__list">
                        {hits.map((hit, hitIndex) => {
                            const variant =
                                hitIndex < MAX_MEDIUM_RESULTS
                                    ? "medium"
                                    : "small"

                            return (
                                <li
                                    className="search-data-results__hit"
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
                    <div className="article-block__featured-metrics__see-all">
                        <Button
                            theme="solid-vermillion"
                            text={
                                topicName
                                    ? `See all ${data?.nbHits ?? 0} charts on this topic`
                                    : `See all ${data?.nbHits ?? 0} charts`
                            }
                            href={searchHref}
                            dataTrackNote="featured-metrics-see-all"
                            icon={faMagnifyingGlass}
                            iconPosition="left"
                        />
                    </div>
                </>
            )}
        </section>
    )
}
