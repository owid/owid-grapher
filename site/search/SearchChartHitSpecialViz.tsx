import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import {
    SearchChartHitComponentVariant,
    SearchSpecialVizHit,
} from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import { constructChartUrl } from "./searchUtils.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"

export const SPECIAL_VIZ_TYPE = "specialViz"

/**
 * A data search result for one of our special bespoke visualization projects.
 * Unlike regular chart hits, it links to the article embedding the
 * visualization and shows the article's featured image instead of live chart
 * previews. It keeps the container dimensions of the equivalent chart hit
 * variant, but uses a gold background to stand out.
 */
export function SearchChartHitSpecialViz({
    hit,
    onClick,
    variant,
}: {
    hit: SearchSpecialVizHit
    onClick: (vizType: string | null) => void
    variant: SearchChartHitComponentVariant
}) {
    const url = constructChartUrl({ hit })
    const isLarge = variant === "large"
    const hasThumbnail = variant !== "small" && !!hit.thumbnailUrl

    return (
        <article
            className={cx(
                "search-chart-hit-special-viz",
                `search-chart-hit-special-viz--${variant}`
            )}
        >
            <div className="search-chart-hit-special-viz__header">
                <div className="search-chart-hit-special-viz__header-content">
                    <div className="search-chart-hit-special-viz__kicker">
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                        Interactive visualization
                    </div>
                    <SearchChartHitHeader
                        hit={hit}
                        url={url}
                        isLarge={isLarge}
                        onClick={onClick}
                    />
                </div>
                {variant !== "small" && (
                    <div className="search-chart-hit-special-viz__header-actions">
                        <Button
                            text="Explore this visualization"
                            className="search-chart-hit-special-viz__button"
                            theme="solid-dark-blue"
                            href={url}
                            icon={faArrowRight}
                            dataTrackNote="search-special-viz-explore"
                        />
                    </div>
                )}
            </div>
            {hasThumbnail && (
                <a
                    className="search-chart-hit-special-viz__thumbnail"
                    href={url}
                    onClick={() => onClick(SPECIAL_VIZ_TYPE)}
                >
                    <img
                        src={hit.thumbnailUrl}
                        alt={hit.title}
                        loading="lazy"
                    />
                </a>
            )}
        </article>
    )
}
