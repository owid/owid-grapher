import cx from "classnames"
import { Button } from "@ourworldindata/components"
import { useState } from "react"
import { useTimeout } from "usehooks-ts"

export function SearchHorizontalDivider({
    className,
    hasButton,
    isLoading,
    onClick,
}: {
    className?: string
    hasButton?: boolean
    isLoading?: boolean
    onClick?: () => void
}) {
    // Don't flash the loading text when the loading is fast.
    const [showLoadingText, setShowLoadingText] = useState(false)
    useTimeout(() => setShowLoadingText(true), isLoading ? 200 : null)

    // Reset immediately when not loading.
    if (!isLoading && showLoadingText) {
        setShowLoadingText(false)
    }

    return (
        <div
            className={cx(
                "search-horizontal-divider",
                {
                    "search-horizontal-divider--has-button": hasButton,
                },
                className
            )}
        >
            {hasButton && (
                <Button
                    className="search-horizontal-divider__button"
                    theme="solid-light-blue"
                    icon={null}
                    text={showLoadingText ? "Loading..." : "Show more"}
                    onClick={onClick}
                    disabled={isLoading}
                    ariaLabel="Load more results"
                />
            )}
        </div>
    )
}
