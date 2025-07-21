import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"
import { SearchChartHitMediumSkeleton } from "./SearchDataTopicsResultsSkeleton.js"

export const SearchDataResultsSkeleton = () => {
    return (
        <div className="search-data-results__hits span-cols-12 col-start-2 animate-pulse">
            <SearchResultHeaderSkeleton />
            <ul className="search-data-results__list">
                <li className="search-data-results__hit">
                    <SearchChartHitMediumSkeleton />
                </li>
                <li className="search-data-results__hit">
                    <SearchChartHitMediumSkeleton />
                </li>
                <li className="search-data-results__hit">
                    <SearchChartHitMediumSkeleton />
                </li>
            </ul>
        </div>
    )
}
