export const SearchDataTopicsResultsSkeleton = () => {
    return (
        <>
            <div className="search-data-topics-results span-cols-14 grid grid-cols-12-full-width">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <DataTopicSkeleton key={i} />
                ))}
            </div>
        </>
    )
}

const SearchChartSkeleton = () => (
    <li className="search-chart-skeleton span-cols-1">
        <div className="search-chart-skeleton__thumbnail" />
        <div className="search-chart-skeleton__title" />
        <div className="search-chart-skeleton__title" />
    </li>
)

const DataTopicSkeleton = () => (
    <div className="search-data-topic--skeleton span-cols-12 col-start-2">
        <div className="search-data-topic__header--skeleton"></div>
        <ul className="search-data-topic__list--skeleton grid grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
                <SearchChartSkeleton key={i} />
            ))}
        </ul>
        <div className="search-data-topic__see-all-button--skeleton" />
    </div>
)
