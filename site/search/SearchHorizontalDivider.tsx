import cx from "clsx"
import { Button } from "@ourworldindata/components"
import { useSpinDelay } from "@ourworldindata/utils"

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
    const showLoadingText = useSpinDelay(!!isLoading, {
        delay: 200,
        ssr: false,
    })

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
                    disabled={isLoading || showLoadingText}
                    ariaLabel="Load more results"
                />
            )}
        </div>
    )
}
