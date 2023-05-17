import { TooltipManager } from "../tooltip/TooltipProps"
import { Bounds } from "@ourworldindata/utils"
import { GrapherInterface } from "../core/GrapherInterface"

export interface FooterManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    originUrlWithProtocol?: string
    isMediaCard?: boolean
    currentTab?: string
    tooltips?: TooltipManager["tooltips"]
    tabBounds?: Bounds
    details?: GrapherInterface["details"]
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
}
