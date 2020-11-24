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

export interface ExplorerChoice {
    title: string
    displayTitle?: string
    options: ExplorerChoiceOption[]
    value: string
    type: ExplorerControlType
}

export interface ExplorerChoiceOption {
    label: string
    available: boolean
    value: string
    checked?: boolean
}

export const UNSAVED_EXPLORER_DRAFT = "UNSAVED_EXPLORER_DRAFT"
export const UNSAVED_EXPLORER_PREVIEW_PATCH = "UNSAVED_EXPLORER_PREVIEW_PATCH"

export const EMBEDDED_EXPLORER_DELIMITER = "\n//EMBEDDED_EXPLORER\n"
export const EMBEDDED_EXPLORER_GRAPHER_CONFIGS =
    "\n//EMBEDDED_EXPLORER_GRAPHER_CONFIGS\n"

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
