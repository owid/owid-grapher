import { ScaleType } from "grapher/core/GrapherConstants"

// Represents the actual entered configuration state in the editor
export interface AxisConfigInterface {
    scaleType?: ScaleType
    label?: string
    min?: number
    max?: number
    canChangeScaleType?: true
    removePointsOutsideDomain?: true
}
