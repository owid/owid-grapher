import cx from "classnames"
import { Button } from "@ourworldindata/components"

export const SearchShowMore = ({
    className,
    isLoading,
    onClick,
}: {
    className?: string
    isLoading: boolean
    onClick: () => void
}) => {
    return (
        <div className={cx("search-show-more", className)}>
            <Button
                className="search-show-more__button"
                theme="solid-light-blue"
                icon={null}
                text={isLoading ? "Loading..." : "Show more"}
                onClick={onClick}
                disabled={isLoading}
                ariaLabel="Load more results"
            />
        </div>
    )
}
