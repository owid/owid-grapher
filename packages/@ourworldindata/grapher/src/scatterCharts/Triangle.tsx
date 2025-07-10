import * as React from "react"

type TriangleProps = Readonly<{
    cx: number
    cy: number
    r: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    transform?: string
}> &
    React.SVGProps<SVGPolygonElement>

export const Triangle = (props: TriangleProps): React.ReactElement => {
    const { cx, cy, r } = props
    const x = cx - r,
        y = cy - r
    const points = [
        [x, y + r * 2],
        [x + (r * 2) / 2, y],
        [x + r * 2, y + r * 2],
    ]

    return (
        <polygon
            points={points
                .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
                .join(" ")}
            {...props}
        />
    )
}
