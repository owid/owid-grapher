import { PlacedCategory } from "./CausesOfDeathCategoryAnnotationsHelpers.js"
import { BezierArrow } from "./Arrow"

export function CategoryAnnotations({
    placedAnnotations,
}: {
    placedAnnotations: PlacedCategory[]
}): React.ReactElement | null {
    if (placedAnnotations.length === 0) return null

    return (
        <g className="category-annotations">
            {placedAnnotations.map((placedAnnotation) => (
                <CategoryAnnotation
                    key={placedAnnotation.name}
                    placedAnnotation={placedAnnotation}
                />
            ))}
        </g>
    )
}

function CategoryAnnotation({
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
        dominantBaseline: position === "bottom" ? "hanging" : undefined,
    }

    const arrowStart: [number, number] = [
        x + (isEndAnchored ? 3 : -3),
        y - direction * (fontSize / 2),
    ]
    const arrowEnd: [number, number] = [
        isEndAnchored ? bounds.right - 11 : bounds.left + 11,
        position === "top" ? bounds.bottom - 3 : bounds.top + 3,
    ]

    const horizontalSign = isEndAnchored ? 1 : -1
    const verticalSign = -direction
    const arrowStartHandleOffset: [number, number] = [
        horizontalSign * 20,
        verticalSign * 5,
    ]
    const arrowEndHandleOffset: [number, number] = [
        horizontalSign * -5,
        verticalSign * 20,
    ]

    return (
        <g>
            <text x={x} y={y} style={textStyle}>
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
                headAngle={45}
            />
        </g>
    )
}
