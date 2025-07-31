import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"

export const SearchDataInsightsResultsSkeleton = () => {
    return (
        <div className="grid span-cols-12 col-start-2">
            <section className="search-data-insights-results animate-pulse span-cols-12">
                <SearchResultHeaderSkeleton />
                <div className="search-data-insights-results__hits">
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                    <SearchDataInsightHitSkeleton />
                </div>
            </section>
        </div>
    )
}

const SearchDataInsightHitSkeleton = () => (
    <div className="search-data-insight-hit-skeleton">
        <div className="search-data-insight-hit__image-container">
            {/* Needs non-empty children to maintain aspect ratio. */}
            <div />
        </div>
        <div className="search-data-insight-hit-skeleton__date" />
        <div className="search-data-insight-hit-skeleton__title" />
        <div className="search-data-insight-hit-skeleton__title" />
        <div className="search-data-insight-hit-skeleton__title" />
    </div>
)
