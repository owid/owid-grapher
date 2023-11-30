import { TooltipManager } from "../tooltip/TooltipProps"
import { GrapherInterface } from "../core/GrapherInterface"
import { ActionButtonsManager } from "../controls/ActionButtons"
import { GrapherExportMode } from "../core/GrapherConstants"

export interface FooterManager extends TooltipManager, ActionButtonsManager {
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    originUrlWithProtocol?: string
    details?: GrapherInterface["details"]
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
    isSourcesModalOpen?: boolean
    isSmall?: boolean
    isMedium?: boolean
    framePaddingHorizontal?: number
    exportMode?: GrapherExportMode
    fontSize?: number
    isInFullScreenMode?: boolean
    isEmbeddedInAnOwidPage?: boolean
    isEmbeddedInADataPage?: boolean
}
