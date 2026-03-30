import { useParentSize } from "@visx/responsive"
import { Group } from "@visx/group"

import { Bounds } from "@ourworldindata/utils"
import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAY_100,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import "./Chart.scss"

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

    return (
        <svg width={width} height={height} viewBox={bounds.toViewBox()}>
            <LabeledBox
                bounds={bounds}
                label="Bounds"
                description="Full SVG area"
                color={OwidDistinctColors.Denim}
            />

            <Group left={innerBounds.left} top={innerBounds.top}>
                <LabeledBox
                    bounds={innerBounds}
                    label="Inner Bounds"
                    description="Plotting area, after reserving space for axes, legends, etc."
                    color={OwidDistinctColors.Maroon}
                />
            </Group>
        </svg>
    )
}

function LabeledBox({
    bounds,
    label,
    description,
    color,
}: {
    bounds: Bounds
    label: string
    description: string
    color: string
}) {
    const labelX = 0
    const labelY = 0
    const labelPadding = 8
    const strokeWidth = 3
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
            <text
                x={labelX + labelPadding}
                y={labelY + labelPadding}
                fill={GRAY_100}
                dominantBaseline="hanging"
                fontSize={13}
                fontWeight={700}
            >
                {label}
                <tspan
                    dx="0.5em"
                    fontWeight={400}
                    fill={GRAY_90}
                    fontStyle="italic"
                >
                    {description}
                </tspan>
            </text>
        </>
    )
}
