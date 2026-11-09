import { useMemo } from "react"
import cx from "clsx"

import { Tippy } from "@ourworldindata/utils"

import { useTippyContainer } from "../../hooks/useTippyContainer.js"
import { useUserCountryInformation } from "../../hooks/useUserCountryInformation.js"
import {
    AreaAudience,
    AreaComparison,
    audienceForCountry,
    describeArea,
    describeAreaBriefly,
} from "./areaYardstick.js"

/** Metric units and European references, or for US visitors imperial units
 *  and American ones. Needs a react-query `QueryClientProvider` above. */
export function useAreaAudience(): AreaAudience {
    const { data: userCountry } = useUserCountryInformation()
    return useMemo(
        () => audienceForCountry(userCountry?.short_code),
        [userCountry?.short_code]
    )
}

/**
 * An area in hectares, e.g. "119,000 hectares" in a chart title, underlined
 * like a details-on-demand term. Hovering, focusing or tapping it shows what
 * the area compares to: a square of the same area and a familiar place of
 * about the same size.
 */
export function AreaYardstick({
    hectares,
    note,
    children,
}: {
    hectares: number
    /** Small print under the comparisons, e.g. a caveat about the data */
    note?: React.ReactNode
    /** The formatted area as it reads in the text */
    children: React.ReactNode
}): React.ReactElement {
    const audience = useAreaAudience()
    const { ref, getTippyContainer } = useTippyContainer<HTMLSpanElement>()
    const description = useMemo(
        () => describeArea(hectares, audience),
        [hectares, audience]
    )

    if (!description) return <>{children}</>

    const { squareSide, count, comparison, acres } = description

    const content = (
        <div className="area-yardstick">
            <p className="area-yardstick__heading">
                {children} is roughly the area of…
            </p>
            <ul className="area-yardstick__list">
                <li className="area-yardstick__item">
                    a square{" "}
                    <strong>
                        {squareSide} × {squareSide}
                    </strong>
                </li>
                {count && (
                    <li className="area-yardstick__item">
                        <strong>{count}</strong>
                    </li>
                )}
                {comparison && (
                    <li className="area-yardstick__item">
                        {comparison.phrase}{" "}
                        <strong>{comparison.reference.name}</strong>
                    </li>
                )}
            </ul>
            {comparison && <ToScale comparison={comparison} />}
            {acres && (
                <p className="area-yardstick__conversion">That is {acres}.</p>
            )}
            {note && <p className="area-yardstick__note">{note}</p>}
        </div>
    )

    return (
        <Tippy
            content={content}
            appendTo={getTippyContainer}
            interactive
            theme="light"
            placement="bottom"
            maxWidth={300}
        >
            <span ref={ref} className="area-yardstick__trigger" tabIndex={0}>
                {children}
            </span>
        </Tippy>
    )
}

/** A one-line comparison for tight spaces like chart tooltips, e.g. "That's
 *  about the size of Belgium" */
export function AreaHint({
    hectares,
    className,
}: {
    hectares: number
    className?: string
}): React.ReactElement | null {
    const audience = useAreaAudience()
    const text = describeAreaBriefly(hectares, audience)
    if (!text) return null
    return <p className={cx("area-hint", className)}>That's {text}</p>
}

const TO_SCALE_MAX_SIDE = 56
const TO_SCALE_MIN_SIDE = 3
const TO_SCALE_GAP = 24
const TO_SCALE_LABEL_HEIGHT = 18

/** The area and the reference place as two squares, drawn to scale */
function ToScale({
    comparison,
}: {
    comparison: AreaComparison
}): React.ReactElement {
    // Square sides scale with the square root of the areas
    const sideRatio = Math.sqrt(comparison.ratio)
    const [areaSide, referenceSide] =
        sideRatio >= 1
            ? [TO_SCALE_MAX_SIDE, TO_SCALE_MAX_SIDE / sideRatio]
            : [TO_SCALE_MAX_SIDE * sideRatio, TO_SCALE_MAX_SIDE]
    const squares = [
        {
            side: Math.max(areaSide, TO_SCALE_MIN_SIDE),
            label: "This area",
            className: "area-yardstick__square--area",
        },
        {
            side: Math.max(referenceSide, TO_SCALE_MIN_SIDE),
            label: capitalize(comparison.reference.name),
            className: "area-yardstick__square--reference",
        },
    ]
    const columnWidth = 120
    const width = columnWidth * 2 + TO_SCALE_GAP
    const height = TO_SCALE_MAX_SIDE + TO_SCALE_LABEL_HEIGHT

    return (
        <figure className="area-yardstick__to-scale">
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`To scale: this area and ${comparison.reference.name}`}
            >
                {squares.map((square, i) => {
                    const x = i * (columnWidth + TO_SCALE_GAP)
                    return (
                        <g key={square.label}>
                            <rect
                                className={square.className}
                                x={x + (columnWidth - square.side) / 2}
                                y={TO_SCALE_MAX_SIDE - square.side}
                                width={square.side}
                                height={square.side}
                            />
                            <text
                                className="area-yardstick__square-label"
                                x={x + columnWidth / 2}
                                y={height - 4}
                                textAnchor="middle"
                            >
                                {square.label}
                            </text>
                        </g>
                    )
                })}
            </svg>
            <figcaption className="area-yardstick__to-scale-caption">
                Drawn to scale
            </figcaption>
        </figure>
    )
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}
