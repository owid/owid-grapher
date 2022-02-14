import { Position } from "../../clientUtils/owidTypes.js"
import { FacetAxisDomain, ScaleType } from "../core/GrapherConstants.js"

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
     * The *preferred* orientation of the axis.
     * If the orientation is not supported by the axis, this parameter will be ignored.
     */
    orient?: Position

    /**
     * Whether the axis domain should be the same across faceted charts (if possible)
     */
    facetDomain?: FacetAxisDomain

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

    /**
     * The (rough) maximum number of ticks to show. Not a strict limit, more ticks may be shown.
     * See: https://github.com/d3/d3-scale#continuous_ticks
     */
    maxTicks?: number

    /**
     * Whether to use short labels, e.g. "5k" instead of "5,000".
     */
    compactLabels?: boolean
}
