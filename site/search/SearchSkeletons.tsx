import cx from "classnames"

// 💀 Beware! Spooky skeletons for the data catalog 💀
export const ChartSkeleton = () => (
    <li className="data-catalog-search-hit--skeleton span-cols-1">
        <div className="data-catalog-search-hit__thumbnail--skeleton" />
        <div className="data-catalog-search-hit__thumbnail-title--skeleton" />
        <div className="data-catalog-search-hit__thumbnail-title--skeleton" />
    </li>
)

export const LandingPageRefinementsHeading = ({
    topics,
}: {
    topics: Set<string>
}) => {
    if (topics.size) return null
    return (
        <h3 className="data-catalog-ribbons__refinements-heading h5-black-caps span-cols-12 col-start-2">
            All areas of research
        </h3>
    )
}

export const DataCatalogRibbonViewSkeleton = ({
    topics,
}: {
    topics: Set<string>
}) => {
    const RibbonSkeleton = () => (
        <div className="data-catalog-ribbon span-cols-12 col-start-2">
            <div className="data-catalog-ribbon__header--skeleton"></div>
            <ul className="data-catalog-ribbon-list data-catalog-ribbon-list--skeleton grid grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <ChartSkeleton key={i} />
                ))}
            </ul>
            <div className="data-catalog-ribbon__see-all-button--skeleton" />
        </div>
    )
    return (
        <>
            <LandingPageRefinementsHeading topics={topics} />
            <div
                className={cx(
                    "data-catalog-refinement-list data-catalog-refinement-list--skeleton span-cols-12 col-start-2",
                    {
                        "data-catalog-refinement-list--skeleton-large":
                            topics.size,
                    }
                )}
            />
            <div className="data-catalog-ribbons span-cols-14 grid grid-cols-12-full-width">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <RibbonSkeleton key={i} />
                ))}
            </div>
        </>
    )
}

export const DataCatalogResultsSkeleton = () => {
    return (
        <div className="data-catalog-results-skeleton grid grid-cols-12-full-width span-cols-14">
            <div className="data-catalog-refinement-list data-catalog-refinement-list--skeleton span-cols-12 col-start-2" />
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
