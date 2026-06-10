import { BezierArrow, BezierArrowProps } from "./BezierArrow.js"

export function HorizontalArrow(
    props: Omit<BezierArrowProps, "start" | "end"> & {
        y: number
        startX: number
        endX: number
    }
): React.ReactElement {
    const { y, startX, endX, ...arrowProps } = props

    return (
        <BezierArrow
            start={{ x: startX, y }}
            end={{ x: endX, y }}
            {...arrowProps}
        />
    )
}
