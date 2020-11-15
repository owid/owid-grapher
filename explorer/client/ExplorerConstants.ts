import { SerializedGridProgram } from "../gridLang/SerializedGridProgram"

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

export const ExplorersRoute = "explorers.json"

export interface ExplorersRouteResponse {
    success: boolean
    errorMessage?: string
    needsPull: boolean
    gitCmsBranchName: string
    explorers: SerializedGridProgram[]
}
