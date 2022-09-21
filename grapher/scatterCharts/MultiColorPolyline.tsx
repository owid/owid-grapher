import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"

import { last } from "../../clientUtils/Util.js"

interface MultiColorPolylinePoint {
    x: number
    y: number
    color: string
}

interface Point {
    x: number
    y: number
}

interface Segment {
    points: Point[]
    color: string
}

function getMidpoint(a: Point, b: Point): Point {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    }
}

function toPoint(point: MultiColorPolylinePoint): Point {
    return {
        x: point.x,
        y: point.y,
    }
}

export function getSegmentsFromPoints(
    points: MultiColorPolylinePoint[]
): Segment[] {
    const segments: Segment[] = []
    points.forEach((currentPoint) => {
        const currentSegment = last(segments)
        if (currentSegment === undefined) {
            segments.push({
                points: [toPoint(currentPoint)],
                color: currentPoint.color,
            })
        } else if (currentSegment.color === currentPoint.color) {
            currentSegment.points.push(toPoint(currentPoint))
        } else {
            const midPoint = getMidpoint(
                last(currentSegment.points)!,
                currentPoint
            )
            currentSegment.points.push(midPoint)
            segments.push({
                points: [midPoint, toPoint(currentPoint)],
                color: currentPoint.color,
            })
        }
    })
    return segments
}

function toSvgPoints(points: Point[]): string {
    // TODO round to 1 decimal place to decrease SVG size?
    return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")
}

type MultiColorPolylineProps = Omit<
    React.SVGProps<SVGPolylineElement>,
    "fill" | "stroke" | "points" | "strokeLinecap"
> & {
    points: MultiColorPolylinePoint[]
}

// The current approach constructs multiple polylines and joins them together at midpoints.
// Joining at midpoints allows clean miter joints, since we're joining two lines at an identical
// angle.
//
// The benefit of this approach is that it generalises to work in most cases. Where it breaks:
// - When a color transition happening at a midpoint is misleading.
// - stroke-dasharray isn't handled well because the pattern restarts on every new line. This could
//   be improved by specifying a `stroke-dashoffset` automatically.
//   We can approximate the line length pretty well without rendering:
//   https://observablehq.com/@danielgavrilov/does-gettotallength-of-polyline-path-equal-the-sum-of-coord
//
// Alternative approaches considered:
// - Single line, color by gradient: this works if the line is monotonically increasing in one axis
//   (X or Y), but otherwise doesn't (a spiral for example doesn't work).
// - Compute meter joints ourselves (https://bl.ocks.org/mbostock/4163057): this results in the most
//   accurate output, but is most complex & slow.
//
export const MultiColorPolyline = observer(
    class MultiColorPolyline extends React.Component<MultiColorPolylineProps> {
        constructor(props: MultiColorPolylineProps) {
            super(props)

            makeObservable(this, {
                segments: computed,
            })
        }

        get segments(): Segment[] {
            return getSegmentsFromPoints(this.props.points)
        }

        render(): JSX.Element {
            const { markerStart, markerMid, markerEnd, ...polylineProps } =
                this.props
            return (
                <>
                    {this.segments.map((group, index) => (
                        <polyline
                            {...polylineProps}
                            key={index}
                            points={toSvgPoints(group.points)}
                            stroke={group.color}
                            fill="none"
                            strokeLinecap="butt" // `butt` allows us to have clean miter joints
                            markerStart={index === 0 ? markerStart : undefined}
                            markerMid={markerMid}
                            markerEnd={
                                index === this.segments.length - 1
                                    ? markerEnd
                                    : undefined
                            }
                        />
                    ))}
                </>
            )
        }
    }
)
