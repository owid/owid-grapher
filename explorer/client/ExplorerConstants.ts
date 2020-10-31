export enum ExplorerControlType {
    Radio = "Radio",
    Checkbox = "Checkbox",
    Dropdown = "Dropdown",
}

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
