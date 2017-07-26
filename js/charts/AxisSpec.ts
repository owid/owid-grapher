/* AxisSpec.ts
 * ================
 *
 * This represents a finalized version of the axis configuration
 * that is ready to go into rendering-- no unfilled nulls.
 */

import ScaleType from './ScaleType'

interface AxisSpec {
    label: string
    tickFormat: (d: number) => string
    domain: [number, number]
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[],
    isDiscrete?: boolean
}

export default AxisSpec

