import { SerializedGridProgram } from "explorer/gridLang/SerializedGridProgram"

export enum ExplorerControlType {
    Radio = "Radio",
    Checkbox = "Checkbox",
    Dropdown = "Dropdown",
}

export const DefaultNewExplorerSlug = "untitled"

export const ExplorerControlTypeRegex = new RegExp(
    " (" + Object.values(ExplorerControlType).join("|") + ")$"
)

export interface ExplorerControlOption {
    label: string
    available: boolean
    value: string
    checked?: boolean
}

export const ExplorerContainerId = "explorerContainer"

export const ExplorersRoute = "allExplorersForAdminListPage.json"
export const ExplorersRouteGrapherConfigs =
    "allGrapherConfigsNeedForThisExplorer.json"
export const ExplorersRouteQueryParam = "grapherIds"

export interface ExplorersRouteResponse {
    success: boolean
    errorMessage?: string
    needsPull: boolean
    gitCmsBranchName: string
    explorers: SerializedGridProgram[]
}
