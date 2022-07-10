import { TooltipManager } from "../tooltip/TooltipProps.js"
import { Bounds } from "../../clientUtils/Bounds.js"
import { GrapherInterface } from "../core/GrapherInterface.js"

export interface FooterManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    shouldLinkToOwid?: boolean
    originUrlWithProtocol?: string
    isMediaCard?: boolean
    currentTab?: string
    tooltips?: TooltipManager["tooltips"]
    tabBounds?: Bounds
    details?: GrapherInterface["details"]
}
