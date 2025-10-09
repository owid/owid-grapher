export const SearchWritingTopicsResultsSkeleton = () => {
    return (
        <div className="search-writing-topics-results span-cols-12 col-start-2">
            <SearchWritingTopicSkeleton />
            <SearchWritingTopicSkeleton />
            <SearchWritingTopicSkeleton />
        </div>
    )
}

const SearchWritingTopicSkeleton = () => (
    <section className="search-writing-topic span-cols-12 col-start-2">
        <div className="search-writing-topic__header--skeleton animate-pulse">
            <div className="search-writing-topic__title--skeleton" />
            <div className="search-writing-topic__count--skeleton" />
        </div>
        <div className="search-writing-topic__content animate-pulse">
            <div className="search-writing-topic__featured-articles--skeleton">
                <div className="search-writing-topic__sub-title--skeleton" />
                <div className="search-writing-featured-articles__list">
                    <SearchStackedArticleHitSkeleton />
                    <SearchStackedArticleHitSkeleton />
                    <SearchStackedArticleHitSkeleton />
                </div>
            </div>
            <div className="search-writing-topic__featured-topic-pages">
                <div className="search-writing-topic__sub-title--skeleton" />
                <ul className="search-writing-featured-topics__list">
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                    <SearchWritingTopicLinkSkeleton />
                </ul>
            </div>
        </div>
    </section>
)

const SearchStackedArticleHitSkeleton = () => (
    <div className="search-stacked-article-hit-skeleton">
        <div className="search-stacked-article-hit-skeleton__image" />
        <div className="search-stacked-article-hit-skeleton__title" />
        <div className="search-stacked-article-hit-skeleton__excerpt" />
    </div>
)

const SearchWritingTopicLinkSkeleton = () => (
    <li className="search-writing-topic-link-skeleton" />
)
