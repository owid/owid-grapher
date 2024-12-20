import React from "react"

import { Color, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { VerticalColorLegend } from "./VerticalColorLegend"

export function VerticalColorLegendComponent({
    legend,
    x = 0,
    y = 0,
    activeColors,
    focusColors,
    onLegendClick,
    onLegendMouseOver,
    onLegendMouseLeave,
}: {
    legend: VerticalColorLegend
    x?: number
    y?: number
    activeColors?: Color[] // inactive colors are grayed out
    focusColors?: Color[] // focused colors are bolded
    onLegendClick?: (color: string) => void
    onLegendMouseOver?: (color: string) => void
    onLegendMouseLeave?: () => void
}): React.ReactElement {
    const isInteractive =
        onLegendClick || onLegendMouseOver || onLegendMouseLeave

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
            <Swatches x={x} y={y} legend={legend} activeColors={activeColors} />
            {isInteractive && (
                <InteractiveElement
                    x={x}
                    y={y}
                    legend={legend}
                    onLegendClick={onLegendClick}
                    onLegendMouseOver={onLegendMouseOver}
                    onLegendMouseLeave={onLegendMouseLeave}
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
            {legend.series.map((series) => {
                const isFocus = focusColors?.includes(series.color) ?? false

                const textX = x + legend.rectSize + legend.rectPadding
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
            {legend.series.map((series) => {
                const isActive = activeColors?.includes(series.color)

                const textX = x + legend.rectSize + legend.rectPadding
                const textY = y + series.yOffset

                const renderedTextPosition =
                    series.textWrap.getPositionForSvgRendering(textX, textY)

                return (
                    <rect
                        id={makeIdForHumanConsumption(series.textWrap.text)}
                        key={series.textWrap.text}
                        x={x}
                        y={renderedTextPosition[1] - legend.rectSize}
                        width={legend.rectSize}
                        height={legend.rectSize}
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
    onLegendClick,
    onLegendMouseOver,
    onLegendMouseLeave,
}: {
    x: number
    y: number
    legend: VerticalColorLegend
    onLegendClick?: (color: string) => void
    onLegendMouseOver?: (color: string) => void
    onLegendMouseLeave?: () => void
}): React.ReactElement {
    return (
        <g>
            {legend.series.map((series) => {
                const mouseOver = onLegendMouseOver
                    ? (): void => onLegendMouseOver(series.color)
                    : undefined
                const mouseLeave = onLegendMouseLeave
                const click = onLegendClick
                    ? (): void => onLegendClick(series.color)
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
                            y={y + series.yOffset - legend.lineHeight / 2}
                            width={series.width}
                            height={series.height + legend.lineHeight}
                            fill="#fff"
                            fillOpacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
