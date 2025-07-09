import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"

export const SearchDataResultsSkeleton = () => {
    return (
        <SearchAsDraft name="Data Results" className="span-cols-12 col-start-2">
            <div className="search-data-results__hits animate-pulse">
                <SearchResultHeaderSkeleton />
                <ul className="search-data-results__list">
                    <li className="search-data-results__hit">
                        <SearchChartHitSkeleton />
                    </li>
                    <li className="search-data-results__hit">
                        <SearchChartHitSkeleton />
                    </li>
                    <li className="search-data-results__hit">
                        <SearchChartHitSkeleton />
                    </li>
                    <li className="search-data-results__hit">
                        <SearchChartHitSkeleton />
                    </li>
                </ul>
            </div>
        </SearchAsDraft>
    )
}

const SearchChartHitSkeleton = () => (
    <div className="search-chart-hit-skeleton">
        <div className="search-chart-hit-skeleton__thumbnail" />
        <div className="search-chart-hit-skeleton__content">
            <div className="search-chart-hit-skeleton__title" />
            <div className="search-chart-hit-skeleton__subtitle" />
            <div className="search-chart-hit-skeleton__description" />
        </div>
    </div>
)
