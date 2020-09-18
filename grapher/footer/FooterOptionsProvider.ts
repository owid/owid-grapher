import { TooltipProps } from "grapher/tooltip/TooltipProps"

export interface FooterOptionsProvider {
    baseFontSize?: number
    sourcesLine?: string
    note?: string
    hasOWIDLogo?: boolean
    isNativeEmbed?: boolean
    originUrlWithProtocol: string
    isMediaCard?: boolean
    currentTab?: string
    tooltip?: TooltipProps
}
