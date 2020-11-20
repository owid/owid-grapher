import {
    ExplorerControlType,
    ExplorerControlOption,
} from "explorer/client/ExplorerConstants"

export interface ExplorerChoice {
    title: string
    options: ExplorerControlOption[]
    value: string
    type: ExplorerControlType
}
