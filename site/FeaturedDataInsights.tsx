import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    SearchResultType,
    SearchState,
    FEATURED_DATA_INSIGHTS_ID,
} from "@ourworldindata/types"
import { createTopicFilter } from "./search/searchUtils.js"
import { queryDataInsights, searchQueryKeys } from "./search/queries.js"
import { SearchDataInsightsResultsSkeleton } from "./search/SearchDataInsightsResultsSkeleton.js"
import { SearchDataInsightHit } from "./search/SearchDataInsightHit.js"
import { Button } from "@ourworldindata/components"
import cx from "clsx"
import { buildLatestPagePath } from "./latest/latestUtils.js"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import {
    sentenceCaseIfNotTopicPage,
    getTopicPageHeading,
} from "@ourworldindata/utils"

// The most /api/search returns in one request; no topic has nearly as many
const MAX_DATA_INSIGHTS_RESULTS = 100

export type FeaturedDataInsightsProps = {
    topicName: string
    className?: string
}

export const FeaturedDataInsights = ({
    topicName,
    className,
}: FeaturedDataInsightsProps) => {
    const { gdocType } = useDocumentContext()
    const headingFragment = getTopicPageHeading("dataInsights", gdocType)
    const headingCaseCorrected = `${headingFragment} on ${sentenceCaseIfNotTopicPage(topicName, gdocType, false)}`

    const searchState = useMemo<SearchState>(
        () => ({
            query: "",
            filters: [createTopicFilter(topicName)],
            requireAllCountries: false,
            resultType: SearchResultType.WRITING,
        }),
        [topicName]
    )

    const { data, isError, isLoading } = useQuery({
        // reusing the same query key function as search for simplicity but
        // would technically collide if using the same query client instance
        queryKey: searchQueryKeys.dataInsights(searchState),
        queryFn: () =>
            queryDataInsights(searchState, 0, MAX_DATA_INSIGHTS_RESULTS),
        enabled: Boolean(topicName),
    })

    const hits = data?.hits ?? []
    const totalResults = data?.nbHits ?? 0

    if (isError || !topicName) return null
    if (!isLoading && totalResults === 0) return null

    return (
        <section
            className={cx(className, "needs-dividers")}
            id={FEATURED_DATA_INSIGHTS_ID}
        >
            <h1 className="h1-semibold">
                <span>{headingCaseCorrected}</span>
                <a
                    className="deep-link"
                    aria-labelledby={FEATURED_DATA_INSIGHTS_ID}
                    href={`#${FEATURED_DATA_INSIGHTS_ID}`}
                />
            </h1>
            {isLoading ? (
                <SearchDataInsightsResultsSkeleton />
            ) : (
                <>
                    <div className="article-block__featured-data-insights__hits">
                        {hits.map((hit) => (
                            <SearchDataInsightHit
                                key={hit.objectID}
                                className="article-block__featured-data-insights__hit"
                                hit={hit}
                                onClick={() => undefined}
                            />
                        ))}
                    </div>
                    <div className="article-block__featured-data-insights__see-all">
                        <Button
                            theme="solid-vermillion"
                            text="See all data insights"
                            href={buildLatestPagePath("data-insight")}
                            dataTrackNote="featured-data-insights-see-all"
                        />
                    </div>
                </>
            )}
        </section>
    )
}
