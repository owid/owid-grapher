import { TooltipManager } from "../tooltip/TooltipProps"
import { GrapherInterface } from "../core/GrapherInterface"

export interface FooterManager extends TooltipManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    originUrlWithProtocol?: string
    details?: GrapherInterface["details"]
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
}
