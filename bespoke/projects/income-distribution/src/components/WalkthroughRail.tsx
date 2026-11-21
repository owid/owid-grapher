import { memo, useEffect, useMemo, useRef } from "react"
import cx from "clsx"
import { scaleLinear, scaleLog } from "@visx/scale"
import { area, curveMonotoneX } from "d3-shape"
import { faLightbulb, faPlay, faStop } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import {
    GRAPHER_DENIM,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { buildChartModel } from "../core/chartModel.js"
import type { IncomeDistributionYear } from "../core/types.js"
import type { Walkthrough } from "../core/walkthroughs.js"
import { WalkthroughLabel } from "./Walkthrough.js"

const THUMBNAIL_WIDTH = 177
const THUMBNAIL_HEIGHT = 99
/** Room above the tallest peak for the marker's dot */
const THUMBNAIL_TOP = 10

const CATEGORY_LABELS: Record<Walkthrough["category"], string> = {
    tip: "Tip",
    insight: "Insight",
}

/** Where the reader is with each walkthrough */
export interface WalkthroughProgress {
    /** The walkthrough playing, if any */
    activeId: string | null
    /** 1-based, of the active walkthrough */
    slide: number
    watchedIds: ReadonlySet<string>
}

function statusLine(
    walkthrough: Walkthrough,
    progress: WalkthroughProgress
): string {
    const count = walkthrough.slides.length
    if (progress.activeId === walkthrough.id)
        return `${progress.slide} of ${count} slides`
    if (progress.watchedIds.has(walkthrough.id)) return "Watched"
    return `${count} slides`
}

/**
 * Wide charts: the walkthroughs as cards left of the chart, each with a
 * miniature of what it's about. Clicking a card plays it, or stops it while
 * it's playing.
 */
export function WalkthroughRail({
    walkthroughs,
    progress,
    yearData,
    onToggle,
}: {
    walkthroughs: Walkthrough[]
    progress: WalkthroughProgress
    yearData: IncomeDistributionYear
    onToggle: (id: string) => void
}): React.ReactElement {
    return (
        <nav
            className="income-distribution-tutorial-rail"
            aria-label="Tips and insights"
        >
            {walkthroughs.map((walkthrough) => {
                const isActive = progress.activeId === walkthrough.id
                return (
                    <button
                        key={walkthrough.id}
                        type="button"
                        className={cx("income-distribution-tutorial-card", {
                            "income-distribution-tutorial-card--active":
                                isActive,
                        })}
                        aria-pressed={isActive}
                        onClick={() => onToggle(walkthrough.id)}
                    >
                        <span className="income-distribution-tutorial-card__thumbnail">
                            <WalkthroughThumbnail
                                walkthrough={walkthrough}
                                yearData={yearData}
                            />
                            <span
                                className="income-distribution-tutorial-card__play"
                                aria-hidden
                            >
                                <FontAwesomeIcon
                                    icon={isActive ? faStop : faPlay}
                                />
                            </span>
                        </span>
                        <span className="income-distribution-tutorial-card__body">
                            <WalkthroughLabel className="income-distribution-tutorial-card__category">
                                {CATEGORY_LABELS[walkthrough.category]}
                            </WalkthroughLabel>
                            <span className="income-distribution-tutorial-card__title">
                                {walkthrough.title}
                            </span>
                            <span className="income-distribution-tutorial-card__status">
                                {statusLine(walkthrough, progress)}
                            </span>
                        </span>
                    </button>
                )
            })}
        </nav>
    )
}

/**
 * Narrow charts: one pill per walkthrough in a row that scrolls sideways,
 * after `leading` (the "Configure the data" or "Exit tutorial" button, which
 * stays in view while the pills scroll under it). The playing one is
 * filled and kept in view.
 */
export function WalkthroughPills({
    walkthroughs,
    progress,
    onSelect,
    leading,
}: {
    walkthroughs: Walkthrough[]
    progress: WalkthroughProgress
    /** Opens a walkthrough; the playing one stays open */
    onSelect: (id: string) => void
    leading?: React.ReactNode
}): React.ReactElement {
    const rowRef = useRef<HTMLDivElement>(null)
    const { activeId } = progress
    useEffect(() => {
        const row = rowRef.current
        if (!row || !activeId) return
        const active = row.querySelector<HTMLElement>(
            `[data-walkthrough="${activeId}"]`
        )
        if (!active) return
        // Right after the leading button, which stays put while the pills
        // scroll under it
        const leading = row.querySelector<HTMLElement>(
            ".income-distribution-tutorial-pills__leading"
        )
        const leadingWidth = leading ? leading.offsetWidth : 0
        // Scroll the row only, not the page
        row.scrollTo({
            left: active.offsetLeft - row.offsetLeft - leadingWidth,
            behavior: "smooth",
        })
    }, [activeId])

    return (
        <div ref={rowRef} className="income-distribution-tutorial-pills">
            {leading && (
                <div className="income-distribution-tutorial-pills__leading">
                    {leading}
                </div>
            )}
            {walkthroughs.map((walkthrough) => {
                const isActive = progress.activeId === walkthrough.id
                return (
                    <button
                        key={walkthrough.id}
                        type="button"
                        className={cx("income-distribution-tutorial-pill", {
                            "income-distribution-tutorial-pill--active":
                                isActive,
                        })}
                        aria-pressed={isActive}
                        data-walkthrough={walkthrough.id}
                        onClick={() => {
                            if (!isActive) onSelect(walkthrough.id)
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faLightbulb}
                            className="income-distribution-tutorial-pill__icon"
                            aria-hidden
                        />
                        {walkthrough.title}
                    </button>
                )
            })}
        </div>
    )
}

/**
 * A miniature of the chart a walkthrough is about, drawn from the data: the
 * global stack or the compared curves, tinted, with a marker line at the
 * stack's peak or at the poverty line
 */
const WalkthroughThumbnail = memo(function WalkthroughThumbnail({
    walkthrough,
    yearData,
}: {
    walkthrough: Walkthrough
    yearData: IncomeDistributionYear
}): React.ReactElement {
    const { thumbnail } = walkthrough
    const drawing = useMemo(() => {
        const model = buildChartModel({
            year: yearData,
            view: thumbnail.view,
            selectedCountries: thumbnail.countries ?? [],
        })
        const incomes = model.grid.incomes
        const x = scaleLog<number>({
            domain: [incomes[0], incomes[incomes.length - 1]],
            range: [0, THUMBNAIL_WIDTH],
        })
        const y = scaleLinear<number>({
            domain: [0, model.yMax > 0 ? model.yMax : 1],
            range: [THUMBNAIL_HEIGHT, THUMBNAIL_TOP],
        })
        const paths = model.series.map((series) => ({
            key: series.key,
            color: series.color,
            d:
                area<number>()
                    .x((_, i) => x(incomes[i]))
                    .y0((_, i) => y(series.y0[i]))
                    .y1((_, i) => y(series.y1[i]))
                    .curve(curveMonotoneX)(series.y1) ?? "",
        }))
        let markerX: number | undefined
        if (thumbnail.povertyLine !== undefined)
            markerX = x(thumbnail.povertyLine)
        else if (thumbnail.peakMarker && model.series.length > 0) {
            const top = model.series[model.series.length - 1].y1
            const peak = top.reduce(
                (best, value, i) => (value > top[best] ? i : best),
                0
            )
            markerX = x(incomes[peak])
        }
        return { paths, markerX, isStacked: model.regionBands.length > 0 }
    }, [yearData, thumbnail])

    return (
        <svg
            className="income-distribution-tutorial-thumbnail"
            width={THUMBNAIL_WIDTH}
            height={THUMBNAIL_HEIGHT}
            viewBox={`0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`}
            aria-hidden
        >
            {drawing.paths.map((path) => (
                <path
                    key={path.key}
                    d={path.d}
                    fill={path.color}
                    fillOpacity={drawing.isStacked ? 1 : 0.55}
                    stroke={path.color}
                    strokeWidth={drawing.isStacked ? 0 : 0.75}
                />
            ))}
            {/* A tint over everything, so the thumbnails read as previews */}
            <rect
                width={THUMBNAIL_WIDTH}
                height={THUMBNAIL_HEIGHT}
                fill={GRAPHER_DENIM}
                opacity={0.3}
            />
            {drawing.markerX !== undefined && (
                <g>
                    <line
                        x1={drawing.markerX}
                        x2={drawing.markerX}
                        y1={THUMBNAIL_TOP - 4}
                        y2={THUMBNAIL_HEIGHT}
                        stroke={GRAY_90}
                        strokeWidth={1}
                        strokeDasharray={drawing.isStacked ? "2,2" : undefined}
                    />
                    <circle
                        cx={drawing.markerX}
                        cy={THUMBNAIL_TOP - 4}
                        r={2.5}
                        fill={GRAY_90}
                    />
                </g>
            )}
        </svg>
    )
})
