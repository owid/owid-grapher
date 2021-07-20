import { ScaleType } from "../core/GrapherConstants"

// Represents the actual entered configuration state in the editor
export interface AxisConfigInterface {
    scaleType?: ScaleType
    label?: string
    min?: number
    max?: number
    canChangeScaleType?: boolean
    removePointsOutsideDomain?: boolean
    hideAxis?: boolean

    /**
     * Minimum pixels to take up.
     * Dictates the minimum height for a HorizontalAxis, minimum width for a VerticalAxis.
     */
    minSize?: number

    /**
     * The padding between:
     * - an axis tick and an axis gridline
     * - an axis label and an axis tick
     */
    labelPadding?: number

    /**
     * Extend scale to start & end on "nicer" round values.
     * See: https://github.com/d3/d3-scale#continuous_nice
     */
    nice?: boolean
}
