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

export const EXPLORER_EMBEDDED_FIGURE_SELECTOR = "data-explorer-src"

export const ExplorerContainerId = "explorerContainer"

export const ExplorersRoute = "allExplorersForAdminListPage.json"
export const ExplorersRouteGrapherConfigs =
    "allGrapherConfigsNeedForThisExplorer.json"
export const ExplorersRouteQueryParam = "grapherIds"

export const EXPLORERS_ROUTE_FOLDER = "explorers" // Url path: http://owid.org/{explorers}
export const EXPLORERS_GIT_CMS_FOLDER = "explorers" // Disk path: /home/owid/git-content/{explorers}
export const EXPLORERS_PREVIEW_ROUTE = `${EXPLORERS_ROUTE_FOLDER}/preview`

export interface ExplorersRouteResponse {
    success: boolean
    errorMessage?: string
    needsPull: boolean
    gitCmsBranchName: string
    explorers: SerializedGridProgram[]
}
