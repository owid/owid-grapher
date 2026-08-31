import * as _ from "lodash-es"
import * as R from "remeda"
import { Bounds, EntityName } from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { Emphasis } from "../interaction/Emphasis"
import {
    MarimekkoLabelCandidate,
    MarimekkoNoDataArea,
    MarimekkoSeries,
    PlacedMarimekkoSeries,
    RenderMarimekkoSeries,
} from "./MarimekkoChartConstants"

function noDataAreaHeight(): number {
    return Bounds.forText("no data").height + 10
}

export function toPlacedMarimekkoSeries(
    sortedSeries: readonly MarimekkoSeries[],
    { x0, y0, dualAxis }: { x0: number; y0: number; dualAxis: DualAxis }
): PlacedMarimekkoSeries[] {
    const { horizontalAxis, verticalAxis } = dualAxis
    const originX = horizontalAxis.place(x0)
    const barY = verticalAxis.place(y0)

    // One screen pixel expressed in domain space, so a tiny but non-zero value
    // still paints a visible sliver
    const onePixelInDomain =
        verticalAxis.invert(barY - 1) - verticalAxis.invert(barY)
    const placeholderHeight = noDataAreaHeight()

    const placedSeries: PlacedMarimekkoSeries[] = []
    let xOffset = 0
    for (const series of sortedSeries) {
        const xValue = series.xPoint?.value ?? 1 // one is the default here because if no x dim is given we make all bars the same width
        const barWidth = horizontalAxis.place(xValue) - originX
        const barHeight =
            series.yPoint !== undefined
                ? barY -
                  verticalAxis.place(
                      Math.max(series.yPoint.value, onePixelInDomain)
                  )
                : placeholderHeight

        placedSeries.push({
            ...series,
            barX: originX + xOffset,
            barY,
            barWidth,
            barHeight,
        })
        xOffset += barWidth
    }
    return placedSeries
}

export function toRenderMarimekkoSeries(
    placedSeries: readonly PlacedMarimekkoSeries[],
    {
        hoveredEntityName,
        selectedEntityNames,
        focusColorBin,
    }: {
        hoveredEntityName?: EntityName
        selectedEntityNames: Set<EntityName>
        focusColorBin?: ColorScaleBin
    }
): RenderMarimekkoSeries[] {
    const hasSelection = placedSeries.some((series) =>
        selectedEntityNames.has(series.entityName)
    )

    const renderSeries = placedSeries.map((series): RenderMarimekkoSeries => {
        const isHovered = series.entityName === hoveredEntityName
        const isSelected = selectedEntityNames.has(series.entityName)
        const isMuted =
            series.focus.background ||
            (focusColorBin !== undefined &&
                !focusColorBin.contains(
                    series.entityColor?.colorDomainValue
                )) ||
            (focusColorBin === undefined && hasSelection && !isSelected) ||
            (!isHovered && !isSelected && hoveredEntityName !== undefined)

        const emphasis = isHovered
            ? Emphasis.Highlighted
            : isMuted
              ? Emphasis.Muted
              : Emphasis.Default

        return {
            ...series,
            emphasis,
            isMuted,
            isOutlined: isHovered || isSelected,
        }
    })

    // Adjacent Marimekko bars share an edge, so an outlined bar has to paint after
    // its neighbours for its thicker stroke to sit on top
    const [outlined, plain] = _.partition(
        renderSeries,
        (series) => series.isOutlined
    )
    return [...plain, ...outlined]
}

export function toMarimekkoNoDataArea(
    placedSeries: readonly PlacedMarimekkoSeries[]
): MarimekkoNoDataArea | undefined {
    const firstWithoutValue = placedSeries.findIndex(
        (series) => series.yPoint === undefined
    )
    if (firstWithoutValue === -1) return undefined

    // sortedSeries puts every entity without a value last, so one band covers them all
    const anyValueAfterFirstGap = placedSeries
        .slice(firstWithoutValue)
        .some((series) => series.yPoint !== undefined)
    if (anyValueAfterFirstGap)
        console.error("Found Non-NAN values after NAN value!")

    const first = placedSeries[firstWithoutValue]
    const last = R.last(placedSeries)!
    const x = first.barX
    const width = last.barX + last.barWidth - x
    const height = noDataAreaHeight()

    return {
        x,
        y: first.barY - height,
        width,
        height,
        labelX: x + width / 2,
        labelY: first.barY - Bounds.forText("no data").width,
    }
}

/** This function splits label candidates into N groups so that each group has approximately
the same sum of x value metric. This is useful for picking labels because we want to have e.g.
20 labels relatively evenly spaced (in x domain space) and this function gives us 20 groups that
are roughly of equal size and then we can pick the largest of each group */
export function splitIntoEqualDomainSizeChunks(
    series: readonly MarimekkoSeries[],
    candidates: readonly MarimekkoLabelCandidate[],
    numChunks: number
): MarimekkoLabelCandidate[][] {
    // candidates contains all entities available in the chart for some time
    // series is just the entities for the currently selected time, so can be a way smaller subset
    const validEntityNames = new Set(series.map(({ entityName }) => entityName))

    // filter the list to remove any candidates that are not currently visible
    // all further calculations are then done only with validCandidates
    const validCandidates = candidates.filter((candidate) =>
        validEntityNames.has(candidate.entityName)
    )

    const chunks: MarimekkoLabelCandidate[][] = []
    let currentChunk: MarimekkoLabelCandidate[] = []
    let domainSizeOfChunk = 0
    const domainSizeThreshold = Math.ceil(
        _.sumBy(validCandidates, (candidate) => candidate.xValue) / numChunks
    )
    for (const candidate of validCandidates) {
        while (domainSizeOfChunk > domainSizeThreshold) {
            chunks.push(currentChunk)
            currentChunk = []
            domainSizeOfChunk -= domainSizeThreshold
        }
        domainSizeOfChunk += candidate.xValue
        currentChunk.push(candidate)
    }
    chunks.push(currentChunk)

    return chunks.filter((chunk) => chunk.length > 0)
}
