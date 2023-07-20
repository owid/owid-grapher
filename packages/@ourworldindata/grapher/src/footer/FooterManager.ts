import { TooltipManager } from "../tooltip/TooltipProps"
import { Bounds } from "@ourworldindata/utils"
import { GrapherInterface } from "../core/GrapherInterface"
import {
    GrapherTabOption,
    GrapherTabOverlayOption,
} from "../core/GrapherConstants"

export interface FooterManager {
    fontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    originUrlWithProtocol?: string
    currentTab?: GrapherTabOption | GrapherTabOverlayOption
    tooltips?: TooltipManager["tooltips"]
    tabBounds?: Bounds
    details?: GrapherInterface["details"]
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
}
