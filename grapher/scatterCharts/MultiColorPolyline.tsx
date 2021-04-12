import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { last } from "../../clientUtils/Util"

interface MultiColorPolylinePoint {
    readonly x: number
    readonly y: number
    readonly color: string
}

interface Point {
    readonly x: number
    readonly y: number
}

interface Segment {
    readonly points: Point[]
    readonly color: string
}

function getMidpoint(a: Point, b: Point) {
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
    points: readonly MultiColorPolylinePoint[]
): Segment[] {
    const segments: Segment[] = []
    points.forEach((currentPoint) => {
        const currentSegment = segments[segments.length - 1]
        if (!currentSegment) {
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

function toSvgPoints(points: readonly Point[]): string {
    return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")
}

type MultiColorPolylineProps = Omit<
    React.SVGProps<SVGPolylineElement>,
    "fill" | "stroke" | "points" | "strokeLinecap"
> & {
    points: readonly MultiColorPolylinePoint[]
}

@observer
export class MultiColorPolyline extends React.Component<
    MultiColorPolylineProps
> {
    @computed get segments(): Segment[] {
        return getSegmentsFromPoints(this.props.points)
    }

    render() {
        const {
            markerStart,
            markerMid,
            markerEnd,
            ...polylineProps
        } = this.props
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
