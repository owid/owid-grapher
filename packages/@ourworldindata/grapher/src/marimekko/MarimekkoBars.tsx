import {
    VerticalAlign,
    dyFromAlign,
    makeFigmaId,
    roundForSvg,
} from "@ourworldindata/utils"
import {
    MARIMEKKO_BAR_STYLE,
    MarimekkoNoDataArea,
    RenderMarimekkoSeries,
} from "./MarimekkoChartConstants"
import { Patterns } from "../core/GrapherConstants"
import { scaleFontSize } from "../chart/ChartUtils"

const PLACEHOLDER_COLOR = "#555"

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
                    x={roundForSvg(noDataArea.x)}
                    y={roundForSvg(noDataArea.y)}
                    width={roundForSvg(noDataArea.width)}
                    height={roundForSvg(noDataArea.height)}
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
                    transform={`translate(${roundForSvg(
                        noDataArea.labelX
                    )}, ${roundForSvg(noDataArea.labelY)}) rotate(-90)`}
                    fontWeight={700}
                    fill="#666"
                    fontSize={scaleFontSize(12, fontSize)}
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
    const { entityName, emphasis, barX, barY, barWidth, barHeight } = series
    const isPlaceholder = series.yPoint === undefined

    const barColor = isPlaceholder ? PLACEHOLDER_COLOR : series.color
    const { fillOpacity, strokeOpacity, strokeWidth } =
        MARIMEKKO_BAR_STYLE[emphasis]

    return (
        <g
            id={makeFigmaId("bar", entityName)}
            className="bar"
            transform={`translate(${roundForSvg(barX)}, 0)`}
            onMouseOver={(ev): void => onEntityMouseOver?.(entityName, ev)}
            onMouseLeave={(): void => onEntityMouseLeave?.()}
            onClick={(): void => onEntityClick?.(entityName)}
        >
            <rect
                x={0}
                y={roundForSvg(barY - barHeight)}
                width={roundForSvg(barWidth)}
                height={roundForSvg(barHeight)}
                fill={barColor}
                fillOpacity={fillOpacity}
                stroke={barColor}
                strokeWidth={strokeWidth}
                strokeOpacity={isPlaceholder ? 0.8 : strokeOpacity}
                opacity={isPlaceholder ? 0.2 : 1.0}
            />
        </g>
    )
}
