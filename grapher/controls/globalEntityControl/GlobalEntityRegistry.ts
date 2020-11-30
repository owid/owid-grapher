import { SelectionArray } from "../selection/SelectionArray"

export const GlobalEntityRegistry = new Set<{ selection: SelectionArray }>()
