import { SerializedGridProgram } from "explorer/gridLang/SerializedGridProgram"

export enum ExplorerControlType {
    Radio = "Radio",
    Checkbox = "Checkbox",
    Dropdown = "Dropdown",
}

export const DefaultNewExplorerSlug = "new"

export const ExplorerControlTypeRegex = new RegExp(
    " (" + Object.values(ExplorerControlType).join("|") + ")$"
)

export interface ExplorerControlOption {
    label: string
    available: boolean
    value: string
    checked?: boolean
}

export const UNSAVED_EXPLORER_DRAFT = "UNSAVED_EXPLORER_DRAFT"
export const UNSAVED_EXPLORER_PREVIEW_QUERY_STRING =
    "UNSAVED_EXPLORER_PREVIEW_PARAMS"

export const ExplorerContainerId = "explorerContainer"

export const ExplorersRoute = "allExplorersForAdminListPage.json"
export const ExplorersRouteGrapherConfigs =
    "allGrapherConfigsNeedForThisExplorer.json"
export const ExplorersRouteQueryParam = "grapherIds"
export const ExplorersPreviewRoute = "explorers/preview"

export interface ExplorersRouteResponse {
    success: boolean
    errorMessage?: string
    needsPull: boolean
    gitCmsBranchName: string
    explorers: SerializedGridProgram[]
}
