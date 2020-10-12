export enum ExplorerControlType {
    Radio = "Radio",
    Checkbox = "Checkbox",
    Dropdown = "Dropdown",
}

export interface ExplorerControlOption {
    label: string
    available: boolean
    value: string
    checked?: boolean
}
