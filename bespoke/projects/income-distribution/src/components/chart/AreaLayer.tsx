import { Fragment, memo } from "react"
import type { ScaleLogarithmic } from "d3-scale"

import {
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import type { ChartSeries } from "../../core/chartModel.js"
import type { CurveLabelLayout } from "../../core/curveLabels.js"

export const COUNTRY_LABEL_FONT_WEIGHT = 700
/** Series and labels other than the hovered entity's */
const DIMMED_OPACITY = 0.3

/**
 * The series' areas, each a path carrying its key for the delegated hover
 * handlers. Memoised: its props only change with the model, the size or the
 * hovered entity, so pointer moves don't redraw the paths.
 */
export const AreaLayer = memo(function AreaLayer({
    series,
    paths,
    isStacked,
    highlightedKeys,
    xScale,
    plotTop,
    plotBottom,
    maskIdBase,
}: {
    series: ChartSeries[]
    paths: string[]
    isStacked: boolean
    highlightedKeys: Set<string> | undefined
    xScale: ScaleLogarithmic<number, number>
    plotTop: number
    plotBottom: number
    /** Unique in the document; the tail fades' masks are named from it */
    maskIdBase: string
}): React.ReactElement {
    // A long tail fades out towards the edge: the curve is drawn through a
    // mask that goes from opaque at the fade's inner end to clear at its outer
    // end (see tails.ts)
    const [x0, x1] = xScale.range()
    const fadeMasks = new Map(
        series.flatMap((s, i) => {
            const { left, right } = s.fades ?? {}
            if (!left && !right) return []
            const stops: { x: number; opacity: number }[] = [
                { x: x0, opacity: left ? 0 : 1 },
                ...(left
                    ? [
                          { x: xScale(left.from), opacity: 0 },
                          { x: xScale(left.to), opacity: 1 },
                      ]
                    : []),
                ...(right
                    ? [
                          { x: xScale(right.to), opacity: 1 },
                          { x: xScale(right.from), opacity: 0 },
                      ]
                    : []),
                { x: x1, opacity: right ? 0 : 1 },
            ]
            return [[i, { id: `${maskIdBase}-${i}`, stops }]]
        })
    )
    return (
        <>
            {fadeMasks.size > 0 && (
                <defs>
                    {[...fadeMasks.values()].map(({ id, stops }) => (
                        <Fragment key={id}>
                            <linearGradient
                                id={`${id}-gradient`}
                                gradientUnits="userSpaceOnUse"
                                x1={x0}
                                x2={x1}
                                y1={0}
                                y2={0}
                            >
                                {stops.map((stop, j) => (
                                    <stop
                                        key={j}
                                        offset={(stop.x - x0) / (x1 - x0)}
                                        stopColor="white"
                                        stopOpacity={stop.opacity}
                                    />
                                ))}
                            </linearGradient>
                            <mask id={id} maskUnits="userSpaceOnUse">
                                <rect
                                    x={x0 - 4}
                                    y={plotTop - 4}
                                    width={x1 - x0 + 8}
                                    height={plotBottom - plotTop + 8}
                                    fill={`url(#${id}-gradient)`}
                                />
                            </mask>
                        </Fragment>
                    ))}
                </defs>
            )}
            {series.map((s, i) => {
                const isHighlighted = highlightedKeys?.has(s.key) ?? false
                const isDimmed = highlightedKeys !== undefined && !isHighlighted
                const maskId = fadeMasks.get(i)?.id
                return (
                    <path
                        key={s.key}
                        data-key={s.key}
                        mask={maskId ? `url(#${maskId})` : undefined}
                        d={paths[i]}
                        fill={s.color}
                        fillOpacity={isStacked ? 1 : 0.5}
                        stroke={isStacked ? GRAPHER_BACKGROUND : s.color}
                        strokeWidth={
                            isStacked
                                ? isHighlighted
                                    ? 1
                                    : 0.5
                                : isHighlighted
                                  ? 2.5
                                  : 1.5
                        }
                        strokeLinejoin="round"
                        opacity={isDimmed ? DIMMED_OPACITY : 1}
                    />
                )
            })}
        </>
    )
})

/**
 * The country names above their curves, in the curves' colours. Memoised
 * like AreaLayer, so pointer moves don't redraw them.
 */
export const CountryLabelLayer = memo(function CountryLabelLayer({
    labels,
    colors,
    fontSize,
    highlightedKeys,
}: {
    labels: CurveLabelLayout["labels"]
    colors: Map<string, string>
    fontSize: number
    highlightedKeys: Set<string> | undefined
}): React.ReactElement {
    return (
        <>
            {labels.map((label) => {
                const color = colors.get(label.key) ?? GRAPHER_DARK_TEXT
                const isDimmed =
                    highlightedKeys !== undefined &&
                    !highlightedKeys.has(label.key)
                return (
                    <text
                        key={label.key}
                        data-key={label.key}
                        className="income-distribution-chart__country-label"
                        x={label.x}
                        y={label.y}
                        // The box's bottom is the text's descent line
                        dy="-0.25em"
                        textAnchor="middle"
                        fontSize={fontSize}
                        fontWeight={COUNTRY_LABEL_FONT_WEIGHT}
                        fill={darkenColorForText(color)}
                        opacity={isDimmed ? DIMMED_OPACITY : 1}
                    >
                        {label.key}
                    </text>
                )
            })}
        </>
    )
})

/** The series a delegated pointer event landed on, from the path's or label's data attribute */
export function seriesKeyOf(target: EventTarget): string | null {
    if (!(target instanceof Element)) return null
    return target.getAttribute("data-key")
}
