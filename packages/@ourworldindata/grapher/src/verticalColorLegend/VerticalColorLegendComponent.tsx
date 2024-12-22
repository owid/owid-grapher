import React from "react"

import { Color, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { VerticalColorLegend } from "./VerticalColorLegend"

interface VerticalColorLegendComponentProps {
    legend: VerticalColorLegend

    // positioning
    x?: number
    y?: number

    // state
    activeColors?: Color[] // inactive colors are grayed out
    focusColors?: Color[] // focused colors are bolded

    // interaction
    onClick?: (color: string) => void
    onMouseOver?: (color: string) => void
    onMouseLeave?: () => void
}

export function VerticalColorLegendComponent({
    legend,
    x = 0,
    y = 0,
    activeColors,
    focusColors,
    onClick,
    onMouseOver,
    onMouseLeave,
}: VerticalColorLegendComponentProps): React.ReactElement {
    const isInteractive = onClick || onMouseOver || onMouseLeave

    return (
        <g
            id={makeIdForHumanConsumption("vertical-color-legend")}
            className="ScatterColorLegend clickable"
        >
            {legend.title &&
                legend.title.render(x, y, {
                    textProps: {
                        fontWeight: 700,
                    },
                })}
            <Labels legend={legend} x={x} y={y} focusColors={focusColors} />
            <Swatches legend={legend} x={x} y={y} activeColors={activeColors} />
            {isInteractive && (
                <InteractiveElement
                    legend={legend}
                    x={x}
                    y={y}
                    onClick={onClick}
                    onMouseOver={onMouseOver}
                    onMouseLeave={onMouseLeave}
                />
            )}
        </g>
    )
}

function Labels({
    legend,
    x,
    y,
    focusColors,
}: {
    legend: VerticalColorLegend
    x: number
    y: number
    focusColors?: Color[]
}): React.ReactElement {
    return (
        <g id={makeIdForHumanConsumption("labels")}>
            {legend.placedBins.map((series) => {
                const isFocus = focusColors?.includes(series.color) ?? false

                const textX = x + legend.swatchSize + legend.swatchMarginRight
                const textY = y + series.yOffset

                return (
                    <React.Fragment key={series.textWrap.text}>
                        {series.textWrap.render(
                            textX,
                            textY,
                            isFocus
                                ? {
                                      textProps: {
                                          style: { fontWeight: "bold" },
                                      },
                                  }
                                : undefined
                        )}
                    </React.Fragment>
                )
            })}
        </g>
    )
}

function Swatches({
    legend,
    x,
    y,
    activeColors,
}: {
    legend: VerticalColorLegend
    x: number
    y: number
    activeColors?: Color[]
}): React.ReactElement {
    return (
        <g>
            {legend.placedBins.map((series) => {
                const isActive = activeColors?.includes(series.color)

                const textX = x + legend.swatchSize + legend.swatchMarginRight
                const textY = y + series.yOffset

                const renderedTextPosition =
                    series.textWrap.getPositionForSvgRendering(textX, textY)

                return (
                    <rect
                        id={makeIdForHumanConsumption(series.textWrap.text)}
                        key={series.textWrap.text}
                        x={x}
                        y={renderedTextPosition[1] - legend.swatchSize}
                        width={legend.swatchSize}
                        height={legend.swatchSize}
                        fill={isActive ? series.color : "#ccc"}
                    />
                )
            })}
        </g>
    )
}

function InteractiveElement({
    x,
    y,
    legend,
    onClick,
    onMouseOver,
    onMouseLeave,
}: {
    x: number
    y: number
    legend: VerticalColorLegend
    onClick?: (color: string) => void
    onMouseOver?: (color: string) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    return (
        <g>
            {legend.placedBins.map((series) => {
                const mouseOver = onMouseOver
                    ? (): void => onMouseOver(series.color)
                    : undefined
                const mouseLeave = onMouseLeave
                const click = onClick
                    ? (): void => onClick(series.color)
                    : undefined

                const cursor = click ? "pointer" : "default"

                return (
                    <g
                        key={series.textWrap.text}
                        className="legendMark"
                        onMouseOver={mouseOver}
                        onMouseLeave={mouseLeave}
                        onClick={click}
                        style={{ cursor }}
                    >
                        <rect
                            x={x}
                            y={
                                y +
                                series.yOffset -
                                legend.verticalBinMargin / 2
                            }
                            width={series.width}
                            height={series.height + legend.verticalBinMargin}
                            fill="#fff"
                            fillOpacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
