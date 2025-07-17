import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"

export const SearchDataInsightsResultsSkeleton = () => {
    return (
        <SearchAsDraft
            name="Data Insights"
            className="grid span-cols-12 col-start-2"
        >
            <section className="search-data-insights-results animate-pulse span-cols-12">
                <SearchResultHeaderSkeleton />
                <div className="search-data-insights-results__hits grid">
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                </div>
            </section>
        </SearchAsDraft>
    )
}

const SearchDataInsightHitSkeleton = () => (
    <div className="search-data-insight-hit-skeleton span-cols-3">
        <div className="search-data-insight-hit-skeleton__image" />
        <div className="search-data-insight-hit-skeleton__date" />
        <div className="search-data-insight-hit-skeleton__title" />
        <div className="search-data-insight-hit-skeleton__title" />
        <div className="search-data-insight-hit-skeleton__title" />
    </div>
)
