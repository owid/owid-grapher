import cx from "classnames"
import { SearchAsDraft } from "./SearchAsDraft.js"

export const SearchShowMore = ({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: {
    hasNextPage: boolean | undefined
    isFetchingNextPage: boolean
    fetchNextPage: () => void
}) => {
    if (!hasNextPage) return null

    return (
        <SearchAsDraft name="Show More" className="span-cols-12 col-start-2">
            <div className="search-show-more span-cols-12 col-start-2">
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
