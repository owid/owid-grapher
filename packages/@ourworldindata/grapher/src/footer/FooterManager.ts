import { TooltipManager } from "../tooltip/TooltipProps"
import { GrapherInterface } from "../core/GrapherInterface"
import { ActionButtonsManager } from "../controls/ActionButtons"
import { SizeVariant } from "../core/GrapherConstants"

export interface FooterManager extends TooltipManager, ActionButtonsManager {
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    originUrlWithProtocol?: string
    details?: GrapherInterface["details"]
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
    sizeVariant?: SizeVariant
    isSourcesModalOpen?: boolean
}
