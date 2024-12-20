import React from "react"

import { isEmpty, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { VerticalColorLegend } from "./VerticalColorLegend"

export function VerticalColorLegendComponent({
    state,
    x = 0,
    y = 0,
    eventListeners,
}: {
    state: VerticalColorLegend
    x?: number
    y?: number
    eventListeners?: {
        onLegendMouseOver?: (color: string) => void
        onLegendClick?: (color: string) => void
        onLegendMouseLeave?: () => void
    }
}): React.ReactElement {
    return (
        <g
            id={makeIdForHumanConsumption("vertical-color-legend")}
            className="ScatterColorLegend clickable"
        >
            {state.title &&
                state.title.render(x, y, {
                    textProps: {
                        fontWeight: 700,
                    },
                })}
            <Labels x={x} y={y} state={state} />
            <Swatches x={x} y={y} state={state} />
            {eventListeners && !isEmpty(eventListeners) && (
                <InteractiveElement
                    x={x}
                    y={y}
                    state={state}
                    eventListeners={eventListeners}
                />
            )}
        </g>
    )
}

function Labels({
    x,
    y,
    state,
}: {
    x: number
    y: number
    state: VerticalColorLegend
}): React.ReactElement {
    return (
        <g id={makeIdForHumanConsumption("labels")}>
            {state.series.map((series) => {
                const isFocus =
                    state.props.focusColors?.includes(series.color) ?? false

                const textX = x + state.rectSize + state.rectPadding
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
    x,
    y,
    state,
}: {
    x: number
    y: number
    state: VerticalColorLegend
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => {
                const isActive = state.props.activeColors?.includes(
                    series.color
                )

                const textX = x + state.rectSize + state.rectPadding
                const textY = y + series.yOffset

                const renderedTextPosition =
                    series.textWrap.getPositionForSvgRendering(textX, textY)

                return (
                    <rect
                        id={makeIdForHumanConsumption(series.textWrap.text)}
                        key={series.textWrap.text}
                        x={x}
                        y={renderedTextPosition[1] - state.rectSize}
                        width={state.rectSize}
                        height={state.rectSize}
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
    state,
    eventListeners,
}: {
    x: number
    y: number
    state: VerticalColorLegend
    eventListeners?: {
        onLegendMouseOver?: (color: string) => void
        onLegendClick?: (color: string) => void
        onLegendMouseLeave?: () => void
    }
}): React.ReactElement {
    const { onLegendMouseOver, onLegendMouseLeave, onLegendClick } =
        eventListeners ?? {}
    return (
        <g>
            {state.series.map((series) => {
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
                            y={y + series.yOffset - state.lineHeight / 2}
                            width={series.width}
                            height={series.height + state.lineHeight}
                            fill="#fff"
                            fillOpacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
