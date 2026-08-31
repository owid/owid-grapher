import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import {
    MarimekkoNoDataArea,
    RenderMarimekkoSeries,
} from "./MarimekkoChartConstants"
import { GRAPHER_FONT_SCALE_12, Patterns } from "../core/GrapherConstants"
import { Emphasis, OPACITY_BY_EMPHASIS } from "../interaction/Emphasis.js"

const PLACEHOLDER_COLOR = "#555"
const BACKGROUNDED_COLOR = "#DADADA"

interface MarimekkoBarsProps {
    series: RenderMarimekkoSeries[]
    noDataArea?: MarimekkoNoDataArea
    fontSize: number
    isFocusModeActive?: boolean
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
}

export function MarimekkoBars({
    series,
    noDataArea,
    fontSize,
    isFocusModeActive,
    onEntityClick,
    onEntityMouseLeave,
    onEntityMouseOver,
}: MarimekkoBarsProps): React.ReactElement {
    return (
        <>
            {noDataArea && (
                <rect
                    key="noDataArea"
                    x={noDataArea.x}
                    y={noDataArea.y}
                    width={noDataArea.width}
                    height={noDataArea.height}
                    fill={`url(#${Patterns.noDataPattern})`}
                    opacity={0.5}
                ></rect>
            )}
            {series.map((series) => (
                <MarimekkoBar
                    key={series.entityName}
                    series={series}
                    onEntityClick={onEntityClick}
                    onEntityMouseLeave={onEntityMouseLeave}
                    onEntityMouseOver={onEntityMouseOver}
                />
            ))}
            {!isFocusModeActive && noDataArea && (
                <text
                    key={`noDataArea-label`}
                    transform={`translate(${noDataArea.labelX}, ${noDataArea.labelY}) rotate(-90)`}
                    fontWeight={700}
                    fill="#666"
                    fontSize={GRAPHER_FONT_SCALE_12 * fontSize}
                    textAnchor="middle"
                    dy={dyFromAlign(VerticalAlign.middle)}
                    style={{ pointerEvents: "none" }}
                >
                    no data
                </text>
            )}
        </>
    )
}

interface MarimekkoBarProps {
    series: RenderMarimekkoSeries
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
}

function MarimekkoBar({
    series,
    onEntityClick,
    onEntityMouseLeave,
    onEntityMouseOver,
}: MarimekkoBarProps): React.ReactElement {
    const {
        entityName,
        emphasis,
        isMuted,
        isOutlined,
        focus,
        barX,
        barY,
        barWidth,
        barHeight,
    } = series
    const isPlaceholder = series.yPoint === undefined

    const barColor = focus.background
        ? BACKGROUNDED_COLOR
        : isPlaceholder
          ? PLACEHOLDER_COLOR
          : series.color

    // The one case the emphasis map cannot express, a selected placeholder being
    // neither hovered nor faded but still picked out
    const fillOpacity =
        emphasis === Emphasis.Default && isOutlined && isPlaceholder
            ? 0.3
            : OPACITY_BY_EMPHASIS[emphasis]

    return (
        <g
            id={makeFigmaId("bar", entityName)}
            className="bar"
            transform={`translate(${barX}, 0)`}
            onMouseOver={(ev): void => onEntityMouseOver?.(entityName, ev)}
            onMouseLeave={(): void => onEntityMouseLeave?.()}
            onClick={(): void => onEntityClick?.(entityName)}
        >
            <rect
                x={0}
                y={barY - barHeight}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                fillOpacity={fillOpacity}
                stroke={barColor}
                strokeWidth={isOutlined ? 1 : 0.5}
                strokeOpacity={isPlaceholder ? 0.8 : isMuted ? 0.2 : 1.0}
                opacity={isPlaceholder ? 0.2 : 1.0}
            />
        </g>
    )
}
