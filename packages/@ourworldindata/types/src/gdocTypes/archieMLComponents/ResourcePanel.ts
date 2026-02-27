import {
    EnrichedBlockWithParseErrors,
    EnrichedHybridLink,
    RawHybridLink,
} from "./generic.js"

export type RawBlockResourcePanel = {
    type: "resource-panel"
    value?: {
        icon?: string
        kicker?: string
        title?: string
        links?: RawHybridLink[]
        buttonText?: string
    }
}

export const resourcePanelIcons = ["chart"] as const

export type ResourcePanelIcon = (typeof resourcePanelIcons)[number]

export type EnrichedBlockResourcePanel = {
    type: "resource-panel"
    icon?: ResourcePanelIcon
    kicker?: string
    title: string
    links: EnrichedHybridLink[]
    buttonText?: string
} & EnrichedBlockWithParseErrors
