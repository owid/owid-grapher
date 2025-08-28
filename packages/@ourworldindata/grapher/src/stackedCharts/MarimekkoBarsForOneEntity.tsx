import { makeIdForHumanConsumption } from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import {
    Bar,
    BarShape,
    EntityColorData,
    MarimekkoBarProps,
} from "./MarimekkoChartConstants"
import { InteractionState } from "../interaction/InteractionState.js"

interface MarimekkoBarsProps {
    entityName: string
    bars: Bar[]
    entityColor: EntityColorData | undefined
    isFaint: boolean
    isHovered: boolean
    isSelected: boolean
    focus: InteractionState
    barWidth: number
    currentX: number
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
    labelYOffset: number
    y0: number
    noDataHeight: number
    dualAxis: DualAxis
}

export function MarimekkoBarsForOneEntity(
    props: MarimekkoBarsProps
): React.ReactElement {
    const {
        entityName,
        bars,
        entityColor,
        isFaint,
        isHovered,
        isSelected,
        focus,
        barWidth,
        currentX,
        onEntityClick,
        onEntityMouseLeave,
        onEntityMouseOver,
        labelYOffset,
        y0,
        noDataHeight,
        dualAxis,
    } = props

    const content = bars.length ? (
        bars.map((bar) => (
            <MarimekkoBar
                key={`${entityName}-${bar.seriesName}`}
                bar={bar}
                barWidth={barWidth}
                isHovered={isHovered}
                isSelected={isSelected}
                focus={focus}
                isFaint={isFaint}
                entityColor={entityColor?.color}
                y0={y0}
                dualAxis={dualAxis}
            />
        ))
    ) : (
        <MarimekkoBar
            key={`${entityName}-placeholder`}
            bar={{
                kind: BarShape.BarPlaceholder,
                seriesName: entityName,
                height: noDataHeight,
            }}
            barWidth={barWidth}
            isHovered={isHovered}
            isSelected={isSelected}
            focus={focus}
            isFaint={isFaint}
            entityColor={entityColor?.color}
            y0={y0}
            dualAxis={dualAxis}
        />
    )

    return (
        <g
            key={entityName}
            id={makeIdForHumanConsumption("bar", entityName)}
            className="bar"
            transform={`translate(${currentX}, ${labelYOffset})`}
            onMouseOver={(ev): void => onEntityMouseOver?.(entityName, ev)}
            onMouseLeave={(): void => onEntityMouseLeave?.()}
            onClick={(): void => onEntityClick?.(entityName)}
        >
            {content}
        </g>
    )
}

function MarimekkoBar({
    bar,
    barWidth,
    isHovered,
    isSelected,
    focus,
    isFaint,
    entityColor,
    y0,
    dualAxis,
}: MarimekkoBarProps): React.ReactElement {
    const { seriesName } = bar
    const isPlaceholder = bar.kind === BarShape.BarPlaceholder
    const barBaseColor =
        entityColor ?? (bar.kind === BarShape.Bar ? bar.color : "#555")

    const barColor = focus.background
        ? "#DADADA"
        : bar.kind === BarShape.BarPlaceholder
          ? "#555"
          : barBaseColor
    const strokeColor = barColor
    const strokeWidth = isHovered || isSelected ? 1 : 0.5
    const strokeOpacity = isPlaceholder ? 0.8 : isFaint ? 0.2 : 1.0
    const fillOpacity = isHovered
        ? 0.7
        : isFaint
          ? 0.2
          : isSelected
            ? isPlaceholder
                ? 0.3
                : 0.7
            : 0.7
    const overalOpacity = isPlaceholder ? 0.2 : 1.0

    let barY: number = 0
    let barHeight: number = 0
    if (bar.kind === BarShape.Bar) {
        barY = dualAxis.verticalAxis.place(y0 + bar.yPoint.valueOffset)
        barHeight =
            dualAxis.verticalAxis.place(y0) -
            dualAxis.verticalAxis.place(bar.yPoint.value)
    } else {
        barY = dualAxis.verticalAxis.place(y0)
        barHeight = bar.height
    }
    const barX = 0

    return (
        <g key={seriesName}>
            <rect
                x={0}
                y={0}
                transform={`translate(${barX}, ${barY - barHeight})`}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                opacity={overalOpacity}
                style={{ transition: "translate 200ms ease" }}
            />
        </g>
    )
}
