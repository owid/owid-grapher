import { useState } from "react"
import { useIsClient } from "usehooks-ts"
import cx from "clsx"
import GrapherImage from "./GrapherImage.js"
import { DataPerspective } from "./dataPerspectivesFixtures.js"
import {
    DataPerspectivesVariant,
    thumbQueryString,
} from "./dataPerspectivesVariant.js"
import { DataPerspectivesSwipeDeck } from "./DataPerspectivesSwipeDeck.js"
import { DataPerspectivesPageSwipe } from "./DataPerspectivesPageSwipe.js"

/**
 * Prototype: an array of alternative views ("data perspectives" / "data
 * nuggets") shown alongside the data page's own grapher.
 *
 * Everything the Prague group was undecided about is a switchable variant,
 * read from the URL, so the options can be compared live rather than argued
 * about in the abstract:
 *
 *   ?dp=left|right|above|below|off   where the array sits (default: left)
 *   ?dpLayout=rail|strip|grid        vertical / horizontal / wrapped
 *   ?dpDensity=thumb|title|full|detail   how much of each item is rendered
 *   ?dpN=<number>                    how many items to show
 *
 * Densities:
 *   thumb   thumbnail only; title appears on hover/focus
 *   title   thumbnail + title
 *   full    thumbnail + title + text
 *   detail  thumbnails only, with the selected item's title + text in one
 *           shared box below the array
 */

export function DataPerspectives({
    slug,
    perspectives,
    variant,
    onSelect,
    onReset,
    narrativeStale,
    onRestoreNarrative,
    heading = "Other ways to look at this data",
}: {
    slug: string
    perspectives: DataPerspective[]
    variant: DataPerspectivesVariant
    onSelect: (href: string, index: number) => void
    onReset: () => void
    narrativeStale?: boolean
    onRestoreNarrative?: () => void
    heading?: string
}) {
    const [selected, setSelected] = useState<number | null>(null)
    // The variant is read from window.location, which the server doesn't have.
    // Rendering client-side only avoids both a hydration mismatch and a flash
    // of the default variant before the requested one appears.
    const isClient = useIsClient()

    if (!isClient) return null
    if (variant.position === "off" || perspectives.length === 0) return null
    // A perspectives drawer replaces the inline array entirely.
    if (variant.drawer === "perspectives") return null

    const items = variant.count
        ? perspectives.slice(0, variant.count)
        : perspectives
    const { layout, density, position, chrome } = variant
    const showTitleInline = density === "title" || density === "full"
    const showTextInline = density === "full"

    const handleClick = (p: DataPerspective, index: number) => {
        setSelected(index)
        onSelect(`/grapher/${slug}?${p.queryParams}`, index)
    }

    const handleReset = () => {
        setSelected(null)
        onReset()
    }

    const selectedPerspective = selected !== null ? items[selected] : undefined

    return (
        <aside
            className={cx(
                "data-perspectives",
                `data-perspectives--${position}`,
                `data-perspectives--layout-${layout}`,
                `data-perspectives--density-${density}`
            )}
            aria-label={heading}
        >
            {/* Pageswipe labels itself ("Data perspective") inside its card,
                so the generic heading would be a second label. */}
            {layout !== "pageswipe" && (
                <div className="data-perspectives__header">
                    <h3 className="data-perspectives__heading">{heading}</h3>
                    {selected !== null && (
                        <button
                            type="button"
                            className="data-perspectives__reset"
                            onClick={handleReset}
                        >
                            Back to the default view
                        </button>
                    )}
                </div>
            )}

            {layout === "pageswipe" ? (
                <DataPerspectivesPageSwipe
                    slug={slug}
                    perspectives={items}
                    hintDelayMs={variant.hintDelayMs}
                    hintRepeatDays={variant.hintRepeatDays}
                    hintReset={variant.hintReset}
                    style={variant.style}
                    narrativeStale={narrativeStale}
                    narrativeStaleMode={variant.narrativeStale}
                    onRestoreNarrative={onRestoreNarrative}
                    onSelect={(href, i) => {
                        setSelected(i)
                        onSelect(href, i)
                    }}
                />
            ) : layout === "swipe" ? (
                <DataPerspectivesSwipeDeck
                    slug={slug}
                    perspectives={items}
                    thumbQueryString={(queryParams) =>
                        thumbQueryString(queryParams, chrome)
                    }
                    onSelect={(href, i) => {
                        setSelected(i)
                        onSelect(href, i)
                    }}
                />
            ) : (
                <ol className="data-perspectives__list">
                    {items.map((p, index) => {
                        const isSelected = selected === index
                        const label = p.title ?? "Another view of this data"
                        return (
                            <li
                                className="data-perspectives__item"
                                key={p.queryParams}
                            >
                                <button
                                    type="button"
                                    className={cx("data-perspectives__button", {
                                        "data-perspectives__button--selected":
                                            isSelected,
                                    })}
                                    aria-current={isSelected || undefined}
                                    onClick={() => handleClick(p, index)}
                                    onMouseEnter={
                                        density === "detail"
                                            ? undefined
                                            : undefined
                                    }
                                    title={
                                        density === "thumb" ? label : undefined
                                    }
                                >
                                    <span className="data-perspectives__thumb">
                                        <GrapherImage
                                            slug={slug}
                                            queryString={thumbQueryString(
                                                p.queryParams,
                                                chrome
                                            )}
                                            alt={label}
                                            noFormatting
                                        />
                                        {density === "thumb" && p.title && (
                                            <span className="data-perspectives__hover-title">
                                                {p.title}
                                            </span>
                                        )}
                                    </span>
                                    {showTitleInline && p.title && (
                                        <span className="data-perspectives__title">
                                            {p.title}
                                        </span>
                                    )}
                                    {showTextInline && p.text && (
                                        <span className="data-perspectives__text">
                                            {p.text}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ol>
            )}

            {layout !== "swipe" &&
                layout !== "pageswipe" &&
                density === "detail" && (
                    <div
                        className="data-perspectives__detail"
                        aria-live="polite"
                    >
                        {selectedPerspective ? (
                            <>
                                {selectedPerspective.title && (
                                    <p className="data-perspectives__detail-title">
                                        {selectedPerspective.title}
                                    </p>
                                )}
                                {selectedPerspective.text && (
                                    <p className="data-perspectives__detail-text">
                                        {selectedPerspective.text}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="data-perspectives__detail-placeholder">
                                Pick a view to see what it shows.
                            </p>
                        )}
                    </div>
                )}
        </aside>
    )
}
