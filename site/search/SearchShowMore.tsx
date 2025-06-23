import cx from "classnames"
import { SearchAsDraft } from "./SearchAsDraft.js"

export const SearchShowMore = ({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    className,
}: {
    hasNextPage: boolean | undefined
    isFetchingNextPage: boolean
    fetchNextPage: () => void
    className?: string
}) => {
    if (!hasNextPage) return null

    return (
        <SearchAsDraft name="Show More" className={className}>
            <div className="search-show-more">
                <button
                    className={cx("search-show-more__button", {
                        "search-show-more__button--loading": isFetchingNextPage,
                    })}
                    onClick={fetchNextPage}
                    disabled={isFetchingNextPage}
                    aria-label="Load more results"
                >
                    {isFetchingNextPage ? "Loading..." : "Show more"}
                </button>
            </div>
        </SearchAsDraft>
    )
}
