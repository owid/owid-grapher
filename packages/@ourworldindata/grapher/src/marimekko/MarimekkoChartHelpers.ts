import * as _ from "lodash-es"
import * as R from "remeda"
import {
    Bounds,
    Color,
    EntityName,
    excludeUndefined,
    SortOrder,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { DualAxis } from "../axis/Axis"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { Emphasis } from "../interaction/Emphasis"
import { FocusArray } from "../focus/FocusArray"
import { getShortNameForEntity } from "../chart/ChartUtils"
import {
    EntityColorData,
    LABEL_ANGLE_IN_DEGREES,
    MarimekkoLabelCandidate,
    MarimekkoLabelMeasurements,
    MarimekkoNoDataArea,
    MarimekkoSeries,
    PlacedMarimekkoLabel,
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

/** Vertical gap between two stacked entity labels */
const LABEL_SPACING = 5

const MAX_LABEL_COUNT = 20

/**
 * Picks the entities to label under the x axis. Candidates are taken from the latest
 * time point rather than the selected one, so the labels stay put as the user drags
 * the timeline.
 */
export function pickMarimekkoLabelCandidates({
    series,
    xColumnAtLastTimePoint,
    yColumnAtLastTimePoint,
    selectedEntityNames,
    focusArray,
    sortOrder,
    availableWidth,
    fontSize,
}: {
    series: readonly MarimekkoSeries[]
    xColumnAtLastTimePoint: CoreColumn | undefined
    yColumnAtLastTimePoint: CoreColumn | undefined
    selectedEntityNames: Set<EntityName>
    focusArray: FocusArray
    sortOrder: SortOrder | undefined
    availableWidth: number
    fontSize: number
}): MarimekkoLabelCandidate[] {
    if (yColumnAtLastTimePoint === undefined) return []

    const ySizeMap: Map<string, number> = new Map(
        yColumnAtLastTimePoint.owidRows.map((row) => [
            row.entityName,
            row.value,
        ])
    )

    const labelCandidateSource =
        xColumnAtLastTimePoint ?? yColumnAtLastTimePoint

    // Measured before any rotation, just normal horizontal labels
    let candidates: MarimekkoLabelCandidate[] =
        labelCandidateSource.owidRows.map((row) => {
            const text = getShortNameForEntity(row.entityName) ?? row.entityName
            return {
                entityName: row.entityName,
                text,
                bounds: Bounds.forText(text, { fontSize }),
                xValue: xColumnAtLastTimePoint !== undefined ? row.value : 1,
                ySortValue: ySizeMap.get(row.entityName),
                isSelected: selectedEntityNames.has(row.entityName),
            }
        })

    // If focus mode is active, only label focused series
    if (focusArray.hasFocusedSeries)
        candidates = candidates.filter((candidate) =>
            focusArray.has(candidate.entityName)
        )

    if (candidates.length === 0) return []

    candidates.sort((a, b) => {
        const yValueForA = a.ySortValue
        const yValueForB = b.ySortValue

        if (yValueForA !== undefined && yValueForB !== undefined) {
            const diff = yValueForB - yValueForA
            if (diff !== 0) return diff
            else return b.entityName.localeCompare(a.entityName)
        } else if (yValueForA === undefined && yValueForB !== undefined)
            return -1
        else if (yValueForA !== undefined && yValueForB === undefined) return 1
        // (yValueForA === undefined && yValueForB === undefined)
        else return 0
    })

    const isDescending = sortOrder === SortOrder.desc
    if (isDescending) candidates.reverse()

    const picked = new Set<EntityName>(
        candidates
            .filter((candidate) => candidate.isSelected)
            .map((candidate) => candidate.entityName)
    )

    const [withValues, withoutValues] = _.partition(
        candidates,
        (candidate) =>
            candidate.ySortValue !== 0 && candidate.ySortValue !== undefined
    )

    // Both ends of the sort always get a label
    if (withValues.length) {
        picked.add(R.first(withValues)!.entityName)
        picked.add(R.last(withValues)!.entityName)
    }
    if (withoutValues.length)
        picked.add(
            isDescending
                ? R.first(withoutValues)!.entityName
                : R.last(withoutValues)!.entityName
        )

    const labelHeight = candidates[0].bounds.height
    const numLabelsToAdd = Math.floor(
        Math.min(
            availableWidth / (labelHeight + LABEL_SPACING) / 3, // factor 3 is arbitrary to taste
            MAX_LABEL_COUNT
        )
    )

    // Spread the rest evenly by labelling the widest bar of each chunk
    const chunks = splitIntoEqualDomainSizeChunks(
        series,
        candidates,
        numLabelsToAdd
    )
    for (const chunk of chunks) {
        if (chunk.some((candidate) => picked.has(candidate.entityName)))
            continue
        const widest = _.maxBy(chunk, (candidate) => candidate.xValue)
        if (widest) picked.add(widest.entityName)
    }

    return candidates.filter((candidate) => picked.has(candidate.entityName))
}

/**
 * A label's rotated extent is derived from its unrotated width alone, treating the
 * text as a line rather than a box, then floored at the font size as a rough proxy
 * for the second dimension.
 */
export function measureMarimekkoLabels(
    candidates: readonly MarimekkoLabelCandidate[],
    { fontSize }: { fontSize: number }
): MarimekkoLabelMeasurements {
    const unrotatedMaxWidth = Math.max(
        ...candidates.map((candidate) => candidate.bounds.width)
    )
    const unrotatedMaxHeight = Math.max(
        ...candidates.map((candidate) => candidate.bounds.height)
    )
    const angleInRadians = (LABEL_ANGLE_IN_DEGREES * Math.PI) / 180

    return {
        unrotatedMaxWidth,
        unrotatedMaxHeight,
        rotatedMaxWidth: Math.max(
            fontSize,
            unrotatedMaxWidth * Math.abs(Math.cos(angleInRadians))
        ),
        rotatedMaxHeight: Math.max(
            fontSize,
            unrotatedMaxWidth * Math.abs(Math.sin(angleInRadians))
        ),
    }
}

export function toPlacedMarimekkoLabels(
    candidates: readonly MarimekkoLabelCandidate[],
    {
        placedSeriesByEntityName,
        domainColorForEntityMap,
        fallbackColor,
        measurements,
        dualAxis,
        x0,
    }: {
        placedSeriesByEntityName: Map<EntityName, PlacedMarimekkoSeries>
        domainColorForEntityMap: Map<EntityName, EntityColorData>
        fallbackColor: Color
        measurements: MarimekkoLabelMeasurements
        dualAxis: DualAxis
        x0: number
    }
): PlacedMarimekkoLabel[] {
    const labels: PlacedMarimekkoLabel[] = excludeUndefined(
        candidates.map((candidate) => {
            const series = placedSeriesByEntityName.get(candidate.entityName)
            if (!series) {
                console.error("Could not find series", candidate.entityName)
                return undefined
            }

            const centreX = series.barX + series.barWidth / 2
            const domainColor = domainColorForEntityMap.get(
                candidate.entityName
            )
            return {
                entityName: candidate.entityName,
                text: candidate.text,
                color: domainColor?.color ?? fallbackColor,
                isSelected: candidate.isSelected,
                preferredX: centreX,
                correctedX: centreX,
            }
        })
    )

    // This collision detection code is optimized for the particular
    // case of distributing items in 1D, knowing that we picked a low
    // enough number of labels that we will be able to fit all labels.
    // The algorithm iterates the list twice, i.e. works in linear time
    // with the number of labels to show
    // The logic in pseudo code:
    // for current, next in iterate-left-to-right-pairs:
    //   if next.x < current.x + label-width:
    //      next.x = current.x + label-width
    // last.x = Math.min(last.x, max-x)
    // for current, prev in iterate-right-to-left-pairs:
    //   if prev.x > current.x - label-width:
    //      prev.x = current.x - label-width

    // The label width is uniform for now and starts with
    // the height of a label when printed in normal horizontal layout
    // Since labels are rotated we need to make a bit more space so that they
    // stack correctly. Consider:
    //     ╱---╱ ╱---╱
    //    ╱   ╱ ╱   ╱
    //   ╱   ╱ ╱   ╱
    //  ╱---╱ ╱---╱
    // If we would just use exactly the label width then the flatter the angle
    // the more they would actually overlap so we need a correction factor. It turns
    // out than tan(angle) is the correction factor we want, although for horizontal
    // labels we don't want to use +infinity :) so we Math.min it with the longest label width
    if (labels.length === 0) return []

    labels.sort((a, b) => {
        const diff = a.preferredX - b.preferredX
        if (diff !== 0) return diff
        else return a.entityName.localeCompare(b.entityName)
    })

    const labelWidth = measurements.unrotatedMaxHeight
    const correctionFactor =
        1 +
        Math.min(
            measurements.unrotatedMaxWidth / labelWidth,
            Math.abs(Math.tan(LABEL_ANGLE_IN_DEGREES))
        )
    const correctedLabelWidth = labelWidth * correctionFactor

    for (let i = 0; i < labels.length - 1; i++) {
        const current = labels[i]
        const next = labels[i + 1]
        const minNextX = current.correctedX + correctedLabelWidth
        if (next.correctedX < minNextX) next.correctedX = minNextX
    }
    const last = R.last(labels)!
    last.correctedX = Math.min(
        last.correctedX,
        dualAxis.horizontalAxis.rangeSize + dualAxis.horizontalAxis.place(x0)
    )
    for (let i = labels.length - 1; i > 0; i--) {
        const current = labels[i]
        const previous = labels[i - 1]
        const maxPreviousX = current.correctedX - correctedLabelWidth
        if (previous.correctedX > maxPreviousX)
            previous.correctedX = maxPreviousX
    }

    return labels
}

/**
 * Runs of consecutive labels that the collision pass had to shift. Each run
 * shares out the marker area's height so their connector lines don't overlap.
 */
export function toShiftedLabelRuns(
    placedLabels: readonly PlacedMarimekkoLabel[]
): PlacedMarimekkoLabel[][] {
    const runs: PlacedMarimekkoLabel[][] = []
    let startNewRun = true
    for (const label of placedLabels) {
        if (label.preferredX === label.correctedX) {
            startNewRun = true
        } else if (startNewRun) {
            runs.push([label])
            startNewRun = false
        } else {
            R.last(runs)!.push(label)
        }
    }
    return runs
}

/** This function splits label candidates into N groups so that each group has approximately
the same sum of x value metric. This is useful for picking labels because we want to have e.g.
20 labels relatively evenly spaced (in x domain space) and this function gives us 20 groups that
are roughly of equal size and then we can pick the largest of each group */
function splitIntoEqualDomainSizeChunks(
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
