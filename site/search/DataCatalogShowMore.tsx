import cx from "classnames"

export const DataCatalogShowMore = ({
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
        <div className="search-show-more span-cols-12 col-start-2">
            <button
                className={cx("search-show-more__button", {
                    "search-show-more__button--loading": isFetchingNextPage,
                })}
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
                aria-label="Load more results"
            >
                {isFetchingNextPage ? "Loading more..." : "Show more"}
            </button>
        </div>
    )
}
