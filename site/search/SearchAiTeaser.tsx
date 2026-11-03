import { useState } from "react"
import cx from "clsx"
import {
    faArrowRight,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

// Design variants under comparison, picked with teaser=<variant> in a link
// (read once, since the search page drops params it doesn't know)
const TEASER_VARIANTS = ["banner", "inline", "explained", "accent"] as const
type TeaserVariant = (typeof TEASER_VARIANTS)[number]

const readTeaserVariant = (): TeaserVariant => {
    const param =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("teaser")
            : null
    return TEASER_VARIANTS.find((variant) => variant === param) ?? "banner"
}

const BetaBadge = () => <span className="search-ai-teaser__beta">Beta</span>

const Icon = () => (
    <FontAwesomeIcon
        className="search-ai-teaser__icon"
        icon={faWandMagicSparkles}
    />
)

/** Offers AI search for the query above the standard results */
export const SearchAiTeaser = ({
    query,
    onStart,
}: {
    query: string
    onStart: () => void
}) => {
    const [variant] = useState(readTeaserVariant)
    const className = cx(
        "search-ai-teaser",
        `search-ai-teaser--${variant}`,
        "col-start-2 span-cols-12"
    )

    if (variant === "inline")
        return (
            <div className={className}>
                <Icon />
                <span>
                    See our work on <strong>“{query}”</strong> grouped by theme
                </span>
                <button
                    type="button"
                    className="search-ai-teaser__link"
                    onClick={onStart}
                >
                    Try AI search <FontAwesomeIcon icon={faArrowRight} />
                </button>
                <BetaBadge />
            </div>
        )

    if (variant === "explained")
        return (
            <div className={className}>
                <Icon />
                <div className="search-ai-teaser__text">
                    <p className="search-ai-teaser__title">
                        See our work on <strong>“{query}”</strong> grouped by
                        theme <BetaBadge />
                    </p>
                    <p className="search-ai-teaser__note">
                        AI picks the most relevant charts and articles from the
                        results below and arranges them into sections. It takes
                        about ten seconds.
                    </p>
                </div>
                <button
                    type="button"
                    className="search-ai-teaser__button"
                    onClick={onStart}
                >
                    Try AI search
                </button>
            </div>
        )

    // "banner" (the first design) and "accent" share their markup
    return (
        <div className={className}>
            <Icon />
            <span>
                See our work on <strong>“{query}”</strong> grouped by theme
            </span>
            <BetaBadge />
            <button
                type="button"
                className="search-ai-teaser__button"
                onClick={onStart}
            >
                Try AI search
            </button>
        </div>
    )
}
