import { ChartSkeleton } from "./ChartSkeleton.js"

// 💀 Beware! Spooky skeletons for the data catalog 💀
export const DataCatalogResultsSkeleton = () => {
    return (
        <div className="data-catalog-results-skeleton grid grid-cols-12-full-width span-cols-14">
            <div className="search-topics-refinement-list search-topics-refinement-list--skeleton span-cols-12 col-start-2" />
            <div className="span-cols-12 col-start-2 data-catalog-search-hits">
                <span className="data-catalog-search-list__results-count--skeleton body-3-medium" />
                <ul className="data-catalog-search-list grid grid-cols-4 grid-sm-cols-1">
                    {[...Array(20)].map((_, i) => (
                        <ChartSkeleton key={i} />
                    ))}
                </ul>
            </div>
        </div>
    )
}
