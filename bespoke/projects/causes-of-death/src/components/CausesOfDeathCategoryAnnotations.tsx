import { dyFromAlign, Point, VerticalAlign } from "@ourworldindata/utils"

import { PlacedCategory } from "../helpers/CausesOfDeathCategoryAnnotationsHelpers.js"

import { BezierArrow } from "@ourworldindata/grapher"

export function CausesOfDeathCategoryAnnotations({
    placedAnnotations,
}: {
    placedAnnotations: PlacedCategory[]
}): React.ReactElement | null {
    if (placedAnnotations.length === 0) return null

    return (
        <g className="category-annotations">
            {placedAnnotations.map((placedAnnotation) => (
                <CausesOfDeathCategoryAnnotation
                    key={placedAnnotation.name}
                    placedAnnotation={placedAnnotation}
                />
            ))}
        </g>
    )
}

function CausesOfDeathCategoryAnnotation({
    placedAnnotation: {
        textAnchor: anchor,
        placement: position,
        bounds,
        textFragments,
        fontSize,
    },
    color = "#2d2e2d",
    arrowWidth = 50,
}: {
    placedAnnotation: PlacedCategory
    color?: string
    arrowWidth?: number
}) {
    const isEndAnchored = anchor === "end"

    const direction = position === "top" ? 1 : -1

    const x = isEndAnchored
        ? bounds.right - arrowWidth
        : bounds.left + arrowWidth
    const y = position === "top" ? bounds.bottom - 12 : bounds.top + 12 // space between annotation and treemap

    const textStyle: React.CSSProperties = {
        fontSize,
        fill: color,
        textAnchor: anchor,
    }

    // Use dy instead of dominant-baseline: hanging, which Safari doesn't support
    const dy =
        position === "bottom" ? dyFromAlign(VerticalAlign.bottom) : undefined

    const arrowStart: Point = {
        x: x + (isEndAnchored ? 3 : -3),
        y: y - direction * (fontSize / 2),
    }
    const arrowEnd: Point = {
        x: isEndAnchored ? bounds.right - 11 : bounds.left + 11,
        y: position === "top" ? bounds.bottom - 3 : bounds.top + 3,
    }

    const horizontalSign = isEndAnchored ? 1 : -1
    const verticalSign = -direction
    const arrowStartHandleOffset: Point = {
        x: horizontalSign * 20,
        y: verticalSign * 5,
    }
    const arrowEndHandleOffset: Point = {
        x: horizontalSign * -5,
        y: verticalSign * 20,
    }

    return (
        <g>
            <text x={x} y={y} dy={dy} style={textStyle}>
                {textFragments.map(({ text, style }) => (
                    <tspan key={text} {...style}>
                        {text}
                    </tspan>
                ))}
            </text>

            <BezierArrow
                start={arrowStart}
                end={arrowEnd}
                startHandleOffset={arrowStartHandleOffset}
                endHandleOffset={arrowEndHandleOffset}
                color={color}
                width={1}
                opacity={0.7}
                headLength={6}
            />
        </g>
    )
}
