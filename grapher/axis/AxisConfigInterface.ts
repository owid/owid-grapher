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
}
