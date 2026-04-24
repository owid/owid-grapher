import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { Bounds } from "@ourworldindata/utils"
import {
    ComparisonLineConfig,
    VerticalComparisonLineConfig,
    VerticalComparisonLineLabelPlacement,
} from "@ourworldindata/types"
import { isValidVerticalComparisonLineConfig } from "./ComparisonLineHelpers"
import { GRAPHER_FONT_SCALE_10_5 } from "../core/GrapherConstants.js"
import type { DualAxis } from "../axis/Axis"

/** Manages comparison line configs and their layout */
export class ComparisonLines {
    private readonly dualAxis: DualAxis
    readonly lines: ComparisonLineConfig[]
    private readonly baseFontSize: number

    constructor(
        lines: ComparisonLineConfig[],
        options: { fontSize: number; dualAxis: DualAxis }
    ) {
        makeObservable(this)

        this.lines = lines
        this.dualAxis = options.dualAxis
        this.baseFontSize = options.fontSize
    }

    @computed get fontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_10_5 * this.baseFontSize)
    }

    /** Space reserved above the chart area for vertical comparison line labels */
    @computed get topPadding(): number {
        const hasVerticalComparisonLines = this.lines.some((line) =>
            isValidVerticalComparisonLineConfig(line)
        )

        if (!hasVerticalComparisonLines) return 0

        return this.fontSize
    }

    @computed get verticalLineLabelPlacements(): Map<
        number,
        VerticalComparisonLineLabelPlacement | undefined
    > {
        // Line label placements keyed by the xEquals
        const placements = new Map<
            number,
            VerticalComparisonLineLabelPlacement | undefined
        >()

        // Get unique vertical lines by xEquals (lines with the same xEquals are ignored)
        const verticalLines = _.uniqBy(
            this.lines.filter((line): line is VerticalComparisonLineConfig =>
                isValidVerticalComparisonLineConfig(line)
            ),
            (line) => line.xEquals
        )

        if (verticalLines.length === 0) return placements

        const { horizontalAxis, innerBounds } = this.dualAxis
        const [minX, maxX] = horizontalAxis.domain
        const fontSize = this.fontSize
        const padding = 4

        // Sort by x position and filter to lines within bounds
        const sortedLines = _.sortBy(
            verticalLines.filter(
                (line) => line.xEquals >= minX && line.xEquals <= maxX
            ),
            (line) => line.xEquals
        )

        // Track the rightmost x-coordinate already claimed by a placed label
        let occupiedRight = innerBounds.left

        for (let i = 0; i < sortedLines.length; i++) {
            const line = sortedLines[i]

            const x = horizontalAxis.place(line.xEquals)

            // No need to place a label if there isn't one, but we still
            // need to prevent future labels from overlapping the line itself
            if (!line.label) {
                occupiedRight = Math.max(occupiedRight, x)
                continue
            }

            const labelWidth = Bounds.forText(line.label, { fontSize }).width

            // Right boundary: next line's position, or chart edge
            const nextLineX =
                i < sortedLines.length - 1
                    ? horizontalAxis.place(sortedLines[i + 1].xEquals)
                    : innerBounds.right

            const rightBound = Math.min(nextLineX, innerBounds.right)
            const leftBound = Math.max(occupiedRight, innerBounds.left)

            const availableRight = rightBound - x - 2 * padding
            const availableLeft = x - leftBound - 2 * padding

            if (labelWidth <= availableRight) {
                // Prefer placing the label to the right of the line, if there's space
                placements.set(line.xEquals, {
                    x: x + padding,
                    anchor: "start",
                })

                // Claim the space this label occupies
                occupiedRight = x + padding + labelWidth + padding
            } else if (labelWidth <= availableLeft) {
                // Otherwise, if there's space on the left, place it there
                placements.set(line.xEquals, { x: x - padding, anchor: "end" })

                // Prevent future labels from overlapping the line itself
                occupiedRight = Math.max(occupiedRight, x)
            } else {
                // Prevent future labels from overlapping the line itself
                occupiedRight = Math.max(occupiedRight, x)
            }
        }

        return placements
    }
}
