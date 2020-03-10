/* AxisSpec.ts
 * ================
 *
 * This represents a finalized version of the axis configuration
 * that is ready to go into rendering-- no unfilled nulls.
 */

import { ScaleType } from "./ScaleType"
import { TickFormattingOptions } from "./TickFormattingOptions"

export interface AxisSpec {
    label: string
    tickFormat: (d: number, options?: TickFormattingOptions) => string
    domain: [number, number]
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    hideFractionalTicks?: boolean
    hideGridlines?: boolean
}
