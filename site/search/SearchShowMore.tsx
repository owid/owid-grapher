import cx from "classnames"
import { Button } from "@ourworldindata/components"
import { useState } from "react"
import { useTimeout } from "usehooks-ts"

export const SearchShowMore = ({
    className,
    isLoading,
    onClick,
}: {
    className?: string
    isLoading: boolean
    onClick: () => void
}) => {
    // Don't flash the loading text when the loading is fast.
    const [showLoadingText, setShowLoadingText] = useState(false)
    useTimeout(() => setShowLoadingText(true), isLoading ? 200 : null)

    // Reset immediately when not loading.
    if (!isLoading && showLoadingText) {
        setShowLoadingText(false)
    }

    return (
        <div className={cx("search-show-more", className)}>
            <Button
                className="search-show-more__button"
                theme="solid-light-blue"
                icon={null}
                text={showLoadingText ? "Loading..." : "Show more"}
                onClick={onClick}
                disabled={isLoading}
                ariaLabel="Load more results"
            />
        </div>
    )
}
