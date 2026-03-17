import { Group } from "@visx/group"
import { scaleBand } from "@visx/scale"

import { Bounds } from "@ourworldindata/utils/src/Bounds.js"
import { GRAPHER_DARK_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { VerticalAlign } from "@ourworldindata/types"

import { BezierArrow } from "../../../../components/BezierArrow/BezierArrow.js"

const examples = [
    { label: "Straight", props: {} },
    {
        label: "Curved",
        props: { startHandleOffset: [30, -20], endHandleOffset: [-30, -20] },
    },
    {
        label: "Bidirectional",
        props: {
            headAnchor: "both",
            startHandleOffset: [30, 20],
            endHandleOffset: [-30, 20],
        },
    },
    {
        label: "Custom\n(drag handles & check console)",
        props: {
            debug: true,
            startHandleOffset: [30, -20],
            endHandleOffset: [-20, 30],
        },
    },
] as const

export function ArrowExamples({ bounds }: { bounds: Bounds }) {
    const innerBounds = bounds
        .set({ x: 0, y: 0 })
        .pad({ top: 18, right: 12, bottom: 4, left: 12 })

    const yScale = scaleBand({
        domain: examples.map((e) => e.label),
        range: [0, innerBounds.height],
    })

    const arrowStartX = (2 / 3) * innerBounds.width

    return (
        <Group top={innerBounds.top} left={innerBounds.left}>
            {examples.map(({ label, props }) => {
                const y = (yScale(label) ?? 0) + yScale.bandwidth() / 2

                const start: [number, number] = [arrowStartX, y]
                const end: [number, number] = [innerBounds.width, y]

                const textWrap = new TextWrap({
                    text: label,
                    maxWidth: arrowStartX - 12,
                    fontSize: 11,
                    verticalAlign: VerticalAlign.middle,
                })

                return (
                    <g key={label}>
                        <TextWrapSvg
                            x={0}
                            y={y}
                            textWrap={textWrap}
                            fill={GRAPHER_DARK_TEXT}
                        />
                        <BezierArrow start={start} end={end} {...props} />
                    </g>
                )
            })}
        </Group>
    )
}
