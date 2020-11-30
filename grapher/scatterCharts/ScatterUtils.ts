import { Bounds } from "clientUtils/Bounds"
import { PointVector } from "clientUtils/PointVector"
import { last, maxBy } from "clientUtils/Util"
import {
    ScatterLabel,
    ScatterRenderPoint,
    ScatterRenderSeries,
    ScatterLabelFontFamily as fontFamily,
} from "./ScatterPlotChartConstants"

export const labelPriority = (label: ScatterLabel) => {
    let priority = label.fontSize

    if (label.series.isHover) priority += 10000
    if (label.series.isFocus) priority += 1000
    if (label.isEnd) priority += 100

    return priority
}

// Create the start year label for a series
export const makeStartLabel = (
    series: ScatterRenderSeries,
    isSubtleForeground: boolean
): ScatterLabel | undefined => {
    // No room to label the year if it's a single point
    if (!series.isForeground || series.points.length <= 1) return undefined

    const fontSize = series.isForeground ? (isSubtleForeground ? 8 : 9) : 7
    const firstValue = series.points[0]
    const nextValue = series.points[1]
    const nextSegment = nextValue.position.subtract(firstValue.position)

    const pos = firstValue.position.subtract(nextSegment.normalize().times(5))
    let bounds = Bounds.forText(firstValue.label, {
        x: pos.x,
        y: pos.y,
        fontSize: fontSize,
        fontFamily,
    })
    if (pos.x < firstValue.position.x)
        bounds = new Bounds(
            bounds.x - bounds.width + 2,
            bounds.y,
            bounds.width,
            bounds.height
        )
    if (pos.y > firstValue.position.y)
        bounds = new Bounds(
            bounds.x,
            bounds.y + bounds.height / 2,
            bounds.width,
            bounds.height
        )

    return {
        text: firstValue.label,
        fontSize,
        fontWeight: 400,
        color: firstValue.color,
        bounds,
        series,
        isStart: true,
    }
}

// Make labels for the points between start and end on a series
// Positioned using normals of the line segments
export const makeMidLabels = (
    series: ScatterRenderSeries,
    isSubtleForeground: boolean
): ScatterLabel[] => {
    if (
        !series.isForeground ||
        series.points.length <= 1 ||
        (!series.isHover && isSubtleForeground)
    )
        return []

    const fontSize = series.isForeground ? (isSubtleForeground ? 8 : 9) : 7
    const fontWeight = 400

    return series.points.slice(1, -1).map((v, i) => {
        const prevPos = i > 0 && series.points[i - 1].position
        const prevSegment = prevPos && v.position.subtract(prevPos)
        const nextPos = series.points[i + 1].position
        const nextSegment = nextPos.subtract(v.position)

        let pos = v.position
        if (prevPos && prevSegment) {
            const normals = prevSegment
                .add(nextSegment)
                .normalize()
                .normals()
                .map((x) => x.times(5))
            const potentialSpots = normals.map((n) => v.position.add(n))
            pos = maxBy(potentialSpots, (p) => {
                return (
                    PointVector.distance(p, prevPos) +
                    PointVector.distance(p, nextPos)
                )
            }) as PointVector
        } else {
            pos = v.position.subtract(nextSegment.normalize().times(5))
        }

        let bounds = Bounds.forText(v.label, {
            x: pos.x,
            y: pos.y,
            fontSize: fontSize,
            fontWeight: fontWeight,
            fontFamily,
        })
        if (pos.x < v.position.x)
            bounds = new Bounds(
                bounds.x - bounds.width + 2,
                bounds.y,
                bounds.width,
                bounds.height
            )
        if (pos.y > v.position.y)
            bounds = new Bounds(
                bounds.x,
                bounds.y + bounds.height / 2,
                bounds.width,
                bounds.height
            )

        return {
            text: v.label,
            fontSize,
            fontWeight,
            color: v.color,
            bounds,
            series,
            isMid: true,
        }
    })
}

// Make the end label (entity label) for a series. Will be pushed
// slightly out based on the direction of the series if multiple values
// are present
// This is also the one label in the case of a single point
export const makeEndLabel = (
    series: ScatterRenderSeries,
    isSubtleForeground: boolean,
    hideLines: boolean
): ScatterLabel => {
    const lastValue = last(series.points) as ScatterRenderPoint
    const lastPos = lastValue.position
    const fontSize = hideLines
        ? series.isForeground
            ? isSubtleForeground
                ? 8
                : 9
            : 7
        : lastValue.fontSize *
          (series.isForeground ? (isSubtleForeground ? 1.2 : 1.3) : 1.1)
    const fontWeight = series.isForeground ? 700 : 400

    let offsetVector = PointVector.up
    if (series.points.length > 1) {
        const prevValue = series.points[series.points.length - 2]
        const prevPos = prevValue.position
        offsetVector = lastPos.subtract(prevPos)
    }
    series.offsetVector = offsetVector

    const labelPos = lastPos.add(
        offsetVector
            .normalize()
            .times(series.points.length === 1 ? lastValue.size + 1 : 5)
    )

    let labelBounds = Bounds.forText(series.text, {
        x: labelPos.x,
        y: labelPos.y,
        fontSize: fontSize,
        fontFamily,
    })

    if (labelPos.x < lastPos.x)
        labelBounds = labelBounds.extend({
            x: labelBounds.x - labelBounds.width,
        })
    if (labelPos.y > lastPos.y)
        labelBounds = labelBounds.extend({
            y: labelBounds.y + labelBounds.height / 2,
        })

    return {
        text: hideLines && series.isForeground ? lastValue.label : series.text,
        fontSize,
        fontWeight,
        color: lastValue.color,
        bounds: labelBounds,
        series,
        isEnd: true,
    }
}
