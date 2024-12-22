import React from "react"

import { Color, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { PlacedBin, VerticalColorLegend } from "./VerticalColorLegend"

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
                legend.title.render(x, y, { textProps: { fontWeight: 700 } })}

            <g id={makeIdForHumanConsumption("labels")}>
                {legend.placedBins.map((bin) => (
                    <Label
                        key={bin.textWrap.text}
                        x={x}
                        y={y}
                        bin={bin}
                        swatchSize={legend.swatchSize}
                        swatchMarginRight={legend.swatchMarginRight}
                        focusColors={focusColors}
                    />
                ))}
            </g>

            <g>
                {legend.placedBins.map((bin) => (
                    <Swatch
                        key={bin.textWrap.text}
                        bin={bin}
                        x={x}
                        y={y}
                        swatchSize={legend.swatchSize}
                        swatchMarginRight={legend.swatchMarginRight}
                        activeColors={activeColors}
                    />
                ))}
            </g>

            {isInteractive && (
                <g>
                    {legend.placedBins.map((bin) => (
                        <InteractiveElement
                            key={bin.textWrap.text}
                            bin={bin}
                            x={x}
                            y={y}
                            verticalBinMargin={legend.verticalBinMargin}
                            onClick={onClick}
                            onMouseOver={onMouseOver}
                            onMouseLeave={onMouseLeave}
                        />
                    ))}
                </g>
            )}
        </g>
    )
}

function Label({
    bin,
    x,
    y,
    focusColors,
    swatchSize,
    swatchMarginRight,
}: {
    bin: PlacedBin
    x: number
    y: number
    swatchSize: number
    swatchMarginRight: number
    focusColors?: Color[]
}): React.ReactElement {
    const isFocus = focusColors?.includes(bin.color) ?? false

    const textX = x + swatchSize + swatchMarginRight
    const textY = y + bin.yOffset

    return bin.textWrap.render(
        textX,
        textY,
        isFocus
            ? {
                  textProps: {
                      style: { fontWeight: "bold" },
                  },
              }
            : undefined
    )
}

function Swatch({
    bin,
    x,
    y,
    swatchSize,
    swatchMarginRight,
    activeColors,
}: {
    bin: PlacedBin
    x: number
    y: number
    swatchSize: number
    swatchMarginRight: number
    activeColors?: Color[]
}): React.ReactElement {
    const isActive = activeColors?.includes(bin.color)

    const textX = x + swatchSize + swatchMarginRight
    const textY = y + bin.yOffset

    const renderedTextPosition = bin.textWrap.getPositionForSvgRendering(
        textX,
        textY
    )

    return (
        <rect
            id={makeIdForHumanConsumption(bin.textWrap.text)}
            x={x}
            y={renderedTextPosition[1] - swatchSize}
            width={swatchSize}
            height={swatchSize}
            fill={isActive ? bin.color : "#ccc"}
        />
    )
}

function InteractiveElement({
    bin,
    x,
    y,
    verticalBinMargin,
    onClick,
    onMouseOver,
    onMouseLeave,
}: {
    bin: PlacedBin
    x: number
    y: number
    verticalBinMargin: number
    onClick?: (color: string) => void
    onMouseOver?: (color: string) => void
    onMouseLeave?: () => void
}): React.ReactElement {
    const mouseOver = onMouseOver
        ? (): void => onMouseOver(bin.color)
        : undefined
    const mouseLeave = onMouseLeave
    const click = onClick ? (): void => onClick(bin.color) : undefined

    const cursor = click ? "pointer" : "default"

    return (
        <g
            className="legendMark"
            onMouseOver={mouseOver}
            onMouseLeave={mouseLeave}
            onClick={click}
            style={{ cursor }}
        >
            <rect
                x={x}
                y={y + bin.yOffset - verticalBinMargin / 2}
                width={bin.width}
                height={bin.height + verticalBinMargin}
                fill="#fff"
                fillOpacity={0}
            />
        </g>
    )
}
