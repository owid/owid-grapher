import { SearchResultHeaderSkeleton } from "./SearchResultHeaderSkeleton.js"

export const SearchWritingResultsSkeleton = () => {
    return (
        <div className="animate-pulse">
            <SearchResultHeaderSkeleton />
            <div className="search-writing-results-skeleton search-writing-results__grid">
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
        </div>
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
