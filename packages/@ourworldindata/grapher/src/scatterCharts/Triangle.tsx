import * as React from "react"
import * as _ from "lodash-es"

type TriangleProps = Readonly<{
    cx: number
    cy: number
    r: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    rotation?: number
}> &
    React.SVGProps<SVGPolygonElement>

export const Triangle = (props: TriangleProps): React.ReactElement => {
    const { cx, cy, r, rotation } = props
    const x = cx - r,
        y = cy - r
    const points = [
        [x, y + r * 2],
        [x + (r * 2) / 2, y],
        [x + r * 2, y + r * 2],
    ]
    const rotationRounded = rotation
        ? [rotation, cx, cy].map((v) => _.round(v, 2))
        : undefined

    return (
        <polygon
            points={points
                .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
                .join(" ")}
            transform={
                rotationRounded
                    ? `rotate(${rotationRounded.join(", ")})`
                    : undefined
            }
            {..._.omit(props, "rotation")}
        />
    )
}
