export const SearchDataTopicsResultsSkeleton = () => {
    return (
        <>
            <div className="search-data-topics-results span-cols-14 grid grid-cols-12-full-width">
                <SearchChartHitMediumSkeleton />
                <SearchChartHitMediumSkeleton />
                <SearchChartHitMediumSkeleton />
            </div>
        </>
    )
}

export const SearchChartHitMediumSkeleton = () => (
    <div className="search-data-topic--skeleton span-cols-14">
        <div className="search-data-topic__header--skeleton animate-pulse"></div>
        <ul className="search-data-topic__list--skeleton grid grid-cols-4">
            <CaptionedThumbnailSkeleton />
            <CaptionedThumbnailSkeleton />
            <CaptionedThumbnailSkeleton />
            <CaptionedThumbnailSkeleton />
        </ul>
        <div className="search-data-topic__see-all-button--skeleton" />
    </div>
)

const CaptionedThumbnailSkeleton = () => (
    <li className="search-chart-skeleton animate-pulse span-cols-1">
        <div className="search-chart-skeleton__thumbnail" />
        <div className="search-chart-skeleton__title" />
        <div className="search-chart-skeleton__title" />
    </li>
)
