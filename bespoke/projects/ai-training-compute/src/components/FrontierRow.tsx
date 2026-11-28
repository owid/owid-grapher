import { Bounds } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils.js"
import {
    GRAY_100,
    GRAY_70,
    GRAY_80,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { AiModel, ColorScheme } from "../core/constants.js"
import { getGroupColor } from "../core/colorSchemes.js"
import { LeaderSegment } from "../core/eci.js"
import { formatFlopInWords } from "../core/formatFlop.js"

/** Height the row takes from the top of the plot, including its gap */
export const FRONTIER_ROW_SPACE = 48
const BAR_HEIGHT = 14
const NAME_FONT_SIZE = 10
const GAP = 1

export interface FrontierBar {
    segment: LeaderSegment
    x0: number
    x1: number
    /** The model's dot on the scatter, when it's plotted and in view */
    model?: AiModel
    name?: string
}

/**
 * Bars for the models that led the Epoch Capabilities Index, on the
 * scatter's own time axis so each sits above the time it led. A name is
 * shown inside its bar when it fits.
 */
export function layoutFrontierRow({
    segments,
    models,
    xScale,
    timeRange,
}: {
    segments: LeaderSegment[]
    /** The scatter's visible models, to connect leaders that are plotted */
    models: AiModel[]
    xScale: (year: number) => number
    timeRange: [number, number]
}): FrontierBar[] {
    const [startYear, endYear] = timeRange
    return segments.flatMap((segment) => {
        const from = Math.max(segment.startYear, startYear)
        const to = Math.min(segment.endYear, endYear)
        if (to <= from) return []
        const x0 = xScale(from) + GAP / 2
        const x1 = xScale(to) - GAP / 2
        const name = shortName(segment.score.displayName)
        const fits =
            x1 - x0 >=
            Bounds.forText(name, {
                fontSize: NAME_FONT_SIZE,
                fontWeight: 700,
            }).width +
                6
        return [
            {
                segment,
                x0,
                x1,
                model: models.find((m) => m.model === segment.score.model),
                name: fits ? name : undefined,
            },
        ]
    })
}

export function FrontierRow({
    bars,
    plot,
    colorScheme,
    hoveredSegment,
    getDotPosition,
}: {
    bars: FrontierBar[]
    plot: Bounds
    colorScheme: ColorScheme
    hoveredSegment?: LeaderSegment
    getDotPosition: (model: AiModel) => { x: number; y: number }
}) {
    const barY = getBarY(plot)
    return (
        <g className="frontier-row">
            <RowLabel plot={plot} bars={bars} />

            {/* Lines from a plotted leader down to its dot */}
            {bars
                .filter((bar) => bar.model)
                .map((bar) => {
                    const dot = getDotPosition(bar.model!)
                    const color = getGroupColor(
                        colorScheme,
                        bar.model!.groups[colorScheme]
                    )
                    return (
                        <line
                            key={`connector-${bar.segment.score.model}`}
                            x1={Math.min(Math.max(dot.x, bar.x0), bar.x1)}
                            y1={barY + BAR_HEIGHT}
                            x2={dot.x}
                            y2={dot.y}
                            stroke={color}
                            strokeWidth={1}
                            strokeDasharray="3,2"
                            pointerEvents="none"
                        />
                    )
                })}

            {bars.map((bar) => {
                // Always by compute estimate status: the point of the row is which
                // leaders have no estimate, whatever the dots are colored by
                const color = getGroupColor(
                    "computeStatus",
                    bar.segment.computeStatus
                )
                const isHovered = hoveredSegment === bar.segment
                return (
                    <g key={bar.segment.score.model}>
                        <rect
                            x={bar.x0}
                            y={barY}
                            width={Math.max(bar.x1 - bar.x0, 1.5)}
                            height={BAR_HEIGHT}
                            fill={color}
                            fillOpacity={bar.model ? 0.35 : 1}
                            stroke={isHovered ? GRAY_100 : "none"}
                            strokeWidth={1.5}
                        />
                        {bar.name && (
                            <text
                                x={(bar.x0 + bar.x1) / 2}
                                y={barY + BAR_HEIGHT / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={NAME_FONT_SIZE}
                                fontWeight={700}
                                fill={
                                    bar.model
                                        ? GRAY_100
                                        : isDarkColor(color)
                                          ? "white"
                                          : GRAY_100
                                }
                                pointerEvents="none"
                            >
                                {bar.name}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

export function findFrontierBar(
    bars: FrontierBar[],
    plot: Bounds,
    position: { x: number; y: number }
): FrontierBar | undefined {
    const barY = getBarY(plot)
    if (position.y < barY - 3 || position.y > barY + BAR_HEIGHT + 3)
        return undefined
    return bars.find(
        (bar) => position.x >= bar.x0 - 1 && position.x <= bar.x1 + 1
    )
}

/** "GPT-4 Turbo (Nov 2023)" → "GPT-4 Turbo" for labels; tooltips keep it */
function shortName(name: string): string {
    return name.replace(/ \([A-Z][a-z]{2} \d{4}\)$/, "")
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
})

export function FrontierTooltip({
    segment,
    isPlotted,
    common,
}: {
    segment: LeaderSegment
    isPlotted: boolean
    common: {
        id: string
        x: number
        y: number
        offsetX: number
        offsetY: number
        containerBounds?: { width: number; height: number }
        anchor?: GrapherTooltipAnchor
        style: React.CSSProperties
    }
}) {
    const { score } = segment
    const color = getGroupColor("computeStatus", segment.computeStatus)
    const led = `${DATE_FORMAT.format(segment.start)} – ${
        segment.isOngoing ? "today" : DATE_FORMAT.format(segment.end)
    }`
    return (
        <TooltipCard
            {...common}
            title={score.displayName}
            subtitle={score.organization ?? undefined}
        >
            <TooltipValue
                label="Most capable model released so far (by ECI score)"
                value={led}
                detail={`${segment.days} day${segment.days === 1 ? "" : "s"}${segment.isOngoing ? " so far" : ""}`}
                color={color}
            />
            <TooltipValue
                label="Epoch Capabilities Index score"
                value={score.eci.toFixed(1)}
                detail={
                    score.eciLow !== null && score.eciHigh !== null
                        ? `90% range ${score.eciLow.toFixed(1)}–${score.eciHigh.toFixed(1)}`
                        : "Fixed: Epoch anchors the index to this model's score"
                }
                color={color}
            />
            <TooltipValue
                label="Training computation"
                value={
                    score.trainingComputeFlop
                        ? `${formatFlopInWords(score.trainingComputeFlop)} FLOP`
                        : "No published estimate"
                }
                detail={
                    isPlotted
                        ? `${segment.computeStatus}, shown on the chart`
                        : score.trainingComputeFlop
                          ? `${segment.computeStatus}, but not among Epoch's notable models`
                          : "Epoch has no estimate for it"
                }
                color={isPlotted ? color : GRAY_70}
            />
        </TooltipCard>
    )
}

const ROW_LABEL = "Missing frontier models"
const ROW_LABEL_FONT_SIZE = NAME_FONT_SIZE + 1

/**
 * Above the bars, starting where they start (clamped so it stays inside the
 * plot when the bars sit at its right edge)
 */
function RowLabel({ plot, bars }: { plot: Bounds; bars: FrontierBar[] }) {
    const width = Bounds.forText(ROW_LABEL, {
        fontSize: ROW_LABEL_FONT_SIZE,
        fontWeight: 700,
    }).width
    const start = bars[0]?.x0 ?? plot.left
    return (
        <text
            x={Math.max(plot.left, Math.min(start, plot.right - width))}
            y={getBarY(plot) - 4}
            fontSize={ROW_LABEL_FONT_SIZE}
            fontWeight={700}
            fill={GRAY_80}
        >
            {ROW_LABEL}
        </text>
    )
}

function getBarY(plot: Bounds): number {
    return plot.top - FRONTIER_ROW_SPACE + ROW_LABEL_FONT_SIZE + 4
}
