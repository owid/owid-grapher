import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"

export const SearchWritingResultsSkeleton = () => {
    return (
        <section className="search-writing-results-skeleton animate-pulse col-start-2 span-cols-12">
            <SearchResultHeaderSkeleton />
            <div className="search-writing-results__grid">
                <div className="search-writing-results__articles">
                    <SearchArticleHitSkeleton />
                    <SearchArticleHitSkeleton />
                    <SearchArticleHitSkeleton />
                </div>
                <div className="search-writing-results__topics">
                    <SearchTopicPageHitSkeleton />
                    <SearchTopicPageHitSkeleton />
                </div>
            </div>
        </section>
    )
}

const SearchArticleHitSkeleton = () => (
    <div className="search-flat-article-hit-skeleton">
        <div className="search-flat-article-hit-skeleton__image" />
        <div className="search-flat-article-hit-skeleton__text">
            <div className="search-flat-article-hit-skeleton__date" />
            <div className="search-flat-article-hit-skeleton__title" />
            <div className="search-flat-article-hit-skeleton__authors-and-excerpt" />
        </div>
    </div>
)

const SearchTopicPageHitSkeleton = () => (
    <div className="search-topic-page-hit-skeleton" />
)
