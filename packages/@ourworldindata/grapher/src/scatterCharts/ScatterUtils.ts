import * as _ from "lodash-es"
import * as R from "remeda"
import { Bounds, PointVector } from "@ourworldindata/utils"
import {
    SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES,
    ScatterLabel,
    ScatterRenderPoint,
    ScatterRenderSeries,
} from "./ScatterPlotChartConstants"
import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"

export const labelPriority = (label: ScatterLabel): number => {
    let priority = label.fontSize

    if (label.series.isHover) priority += 10000
    if (label.series.isFocus) priority += 1000
    if (label.isEnd) priority += 100

    return priority
}

// Create the start year label for a series
export const makeStartLabel = (
    series: ScatterRenderSeries,
    isSubtleForeground: boolean,
    hideConnectedScatterLines: boolean,
    baseFontSize: number
): ScatterLabel | undefined => {
    // No room to label the year if it's a single point
    if (!series.isForeground || series.points.length <= 1) return undefined

    const fontSize = hideConnectedScatterLines
        ? SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES * baseFontSize
        : series.isForeground
          ? isSubtleForeground
              ? (8 / BASE_FONT_SIZE) * baseFontSize
              : (9 / BASE_FONT_SIZE) * baseFontSize
          : (7 / BASE_FONT_SIZE) * baseFontSize
    const firstValue = series.points[0]
    const nextValue = series.points[1]
    const nextSegment = nextValue.position.subtract(firstValue.position)

    const pos = firstValue.position.subtract(nextSegment.normalize().times(5))
    let bounds = Bounds.forText(firstValue.label, {
        x: pos.x,
        y: pos.y,
        fontSize: fontSize,
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
    isSubtleForeground: boolean,
    hideConnectedScatterLines: boolean,
    baseFontSize: number
): ScatterLabel[] => {
    if (
        !series.isForeground ||
        series.points.length <= 1 ||
        (!series.isHover && isSubtleForeground)
    )
        return []

    const fontSize = hideConnectedScatterLines
        ? SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES * baseFontSize
        : series.isForeground
          ? isSubtleForeground
              ? (8 / BASE_FONT_SIZE) * baseFontSize
              : (9 / BASE_FONT_SIZE) * baseFontSize
          : (7 / BASE_FONT_SIZE) * baseFontSize
    const fontWeight = 400

    // label all the way to the end for the tooltip series, otherwise to n-1
    const lastIndex = series.isTooltip && !series.isFocus ? Infinity : -1

    return series.points.slice(1, lastIndex).map((v, i) => {
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
            pos = _.maxBy(potentialSpots, (p) => {
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
    hideConnectedScatterLines: boolean,
    baseFontSize: number
): ScatterLabel => {
    const lastValue = R.last(series.points) as ScatterRenderPoint
    const lastPos = lastValue.position
    const fontSize = hideConnectedScatterLines
        ? SCATTER_LABEL_FONT_SIZE_FACTOR_WHEN_HIDDEN_LINES * baseFontSize
        : series.fontSize *
          (series.isForeground ? (isSubtleForeground ? 1.2 : 1.3) : 1.1)
    const fontWeight =
        series.isForeground && !hideConnectedScatterLines ? 700 : 400

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
    })

    if (labelPos.x < lastPos.x)
        labelBounds = labelBounds.set({
            x: labelBounds.x - labelBounds.width,
        })
    if (labelPos.y > lastPos.y)
        labelBounds = labelBounds.set({
            y: labelBounds.y + labelBounds.height / 2,
        })

    return {
        text:
            hideConnectedScatterLines && series.isForeground
                ? lastValue.label
                : series.isTooltip && !series.isFocus
                  ? "" // don't doubly label the series name when the tooltip is visible
                  : series.text,
        fontSize,
        fontWeight,
        color: lastValue.color,
        bounds: labelBounds,
        series,
        isEnd: true,
    }
}
