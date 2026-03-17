import { useMemo } from "react"

import { useParentSize } from "@visx/responsive"
import { Group } from "@visx/group"

import { Bounds } from "@ourworldindata/utils"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { ArrowExamples } from "./ArrowExamples.js"

export function Chart() {
    const { parentRef, width, height } = useParentSize()

    return (
        <Frame className="example-chart">
            <ChartHeader
                title="Example chart"
                subtitle="This is an example chart using @visx components."
            />
            <div className="example-chart__area" ref={parentRef}>
                <ChartArea width={width} height={height} />
            </div>
            <ChartFooter source="Example data source" note="Example note" />
        </Frame>
    )
}

function ChartArea({ width, height }: { width: number; height: number }) {
    if (width <= 0 || height <= 0) return null

    // Bounds of the entire SVG
    const bounds = new Bounds(0, 0, width, height)

    // Bounds of the plotting area (typically without axes, legends, etc.)
    const innerBounds = bounds.pad(32)

    // Bounds for the arrow box
    const arrowBounds = innerBounds.pad(32).set({
        width: innerBounds.width / 3,
    })

    return (
        <svg width={width} height={height} viewBox={bounds.toViewBox()}>
            <LabeledBox
                bounds={bounds}
                label="Bounds"
                color={OwidDistinctColors.Denim}
            />

            <Group left={innerBounds.left} top={innerBounds.top}>
                <LabeledBox
                    bounds={innerBounds}
                    label="Inner Bounds"
                    color={OwidDistinctColors.Maroon}
                />
            </Group>

            <Group left={arrowBounds.left} top={arrowBounds.top}>
                <LabeledBox
                    bounds={arrowBounds}
                    label="Arrow examples"
                    color={OwidDistinctColors.OliveGreen}
                />

                <ArrowExamples bounds={arrowBounds} />
            </Group>
        </svg>
    )
}

function LabeledBox({
    bounds,
    label,
    color,
    strokeWidth = 2,
}: {
    bounds: Bounds
    label: string
    color: string
    strokeWidth?: number
}) {
    const textWrap = useMemo(
        () =>
            new TextWrap({
                text: label.toUpperCase(),
                maxWidth: bounds.width,
                fontSize: 11,
                fontWeight: 700,
            }),
        [label, bounds.width]
    )

    const labelX = 0
    const labelY = 0
    const labelPadding = 2

    const labelBackgroundBounds = new Bounds(
        labelX,
        labelY,
        textWrap.width + labelPadding * 2,
        textWrap.height + labelPadding * 2
    )

    const halfStroke = strokeWidth / 2

    return (
        <>
            <rect
                x={halfStroke}
                y={halfStroke}
                width={bounds.width - strokeWidth}
                height={bounds.height - strokeWidth}
                fill="white"
            />
            <rect
                x={halfStroke}
                y={halfStroke}
                width={bounds.width - strokeWidth}
                height={bounds.height - strokeWidth}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={strokeWidth}
            />
            <rect {...labelBackgroundBounds.toProps()} fill={color} />
            <TextWrapSvg
                textWrap={textWrap}
                x={labelX + labelPadding}
                y={labelY + labelPadding}
                fill="white"
            />
        </>
    )
}
